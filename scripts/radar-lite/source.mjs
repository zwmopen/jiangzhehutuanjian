import crypto from 'node:crypto';

const UA = 'JZHTeamRadarLite/0.1';
const MAX_PER_SOURCE = 16;

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); });
}

export function cleanText(s) {
  return decodeEntities(String(s || ''))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function normalizeTitle(s) {
  return cleanText(s).replace(/[0-9a-f]{24,}$/i, '').replace(/^(更多|详情|查看详情|阅读更多)$/i, '').trim();
}

function absUrl(href, base) {
  try {
    const u = new URL(decodeEntities(href), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}

function allowed(url, config) {
  const allow = config.allowUrlPrefixes || [];
  const deny = config.denyUrlPrefixes || [];
  if (deny.some(function (p) { return url.startsWith(p); })) return false;
  return allow.length === 0 || allow.some(function (p) { return url.startsWith(p); });
}

function parseDate(text) {
  const m = String(text || '').match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const pad = function (v) { return String(v).padStart(2, '0'); };
  const iso = m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + 'T' + pad(m[4] || '00') + ':' + pad(m[5] || '00') + ':' + pad(m[6] || '00') + '+08:00';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchText(url, timeoutMs) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs || 20000), redirect: 'follow'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

export function parseListing(html, source) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absUrl(m[2], source.config.url);
    if (!url || seen.has(url) || !allowed(url, source.config)) continue;
    const title = normalizeTitle(m[3]);
    if (title.length < 6 || title.length > 180) continue;
    if (/^(首页|更多|政务公开|机构概况|通知公告|活动信息|文旅要闻|网站地图|公众监督)$/.test(title)) continue;
    const around = cleanText(html.slice(Math.max(0, m.index - 180), Math.min(html.length, re.lastIndex + 180)));
    const date = parseDate(around);
    seen.add(url);
    out.push({
      id: crypto.createHash('sha1').update(url).digest('hex').slice(0, 12), url, title,
      publishedAt: date ? date.toISOString() : null, sourceId: source.id, sourceName: source.name,
      tier: source.tier || 'T2', sourceTags: source.tags || [], excerpt: ''
    });
    if (out.length >= MAX_PER_SOURCE) break;
  }
  return out;
}

export async function enrichItem(item) {
  try {
    const html = await fetchText(item.url, 18000);
    const d1 = /<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html);
    const d2 = /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i.exec(html);
    const dateMeta = /(?:datePublished|article:published_time)["']?\s*(?:content=|:)\s*["']([^"']+)/i.exec(html)?.[1] || '';
    const body = cleanText(html.replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ').replace(/<header\b[\s\S]*?<\/header>/gi, ' ').replace(/<footer\b[\s\S]*?<\/footer>/gi, ' '));
    const date = item.publishedAt ? new Date(item.publishedAt) : (parseDate(dateMeta) || parseDate(body.slice(0, 1400)));
    return Object.assign({}, item, {
      publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : item.publishedAt,
      excerpt: cleanText((d1 && d1[1]) || (d2 && d2[1]) || '') || body.slice(0, 2200)
    });
  } catch (error) {
    return Object.assign({}, item, { fetchError: String(error && error.message || error) });
  }
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
