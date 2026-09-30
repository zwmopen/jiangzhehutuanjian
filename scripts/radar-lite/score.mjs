import fs from 'node:fs/promises';

const REGION = ['杭州','上海','苏州','宁波','嘉兴','绍兴','湖州','金华','义乌','无锡','常州','南京','桐庐','临安','富阳','青山湖','安吉','莫干山','千岛湖','舟山','嵊泗','枸杞岛','西山岛','溧阳','浙江','江苏'];
const TEAM = ['团建','企业','公司','团队','会议','年会','员工','工会','职工','团体'];
const OPS = ['开放','恢复开放','闭园','暂停开放','预约','限流','营业','交通','高速','地铁','大巴','停车','住宿','酒店','会议室','餐饮','天气','台风','暴雨','高温','安全','线路','路线','活动','上新','新开','推出','消费券','优惠'];
const PLAY = ['露营','徒步','漂流','玩水','海岛','骑行','飞盘','卡丁车','温泉','农庄','营地','度假区','户外','运动会'];
const DEMAND = ['游客','客流','市场','增长','热门','需求','数据','订单','消费','假期','秋游','春游','暑期'];
const NOISE = ['党建','表彰大会','学习教育','网络安全宣传周','理论学习','干部培训','艺术创作座谈'];
const AI_POOL = 24;

function hits(text, words) { return words.filter(function (w) { return text.includes(w); }); }
function freshness(iso) {
  if (!iso) return 4;
  const days = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 2) return 20; if (days <= 7) return 16; if (days <= 14) return 11; if (days <= 30) return 7; if (days <= 60) return 3; return 0;
}

export function scoreHeuristic(item) {
  const text = item.title + '\n' + (item.excerpt || '');
  const region = hits(text, REGION), team = hits(text, TEAM), ops = hits(text, OPS), play = hits(text, PLAY), demand = hits(text, DEMAND), noise = hits(text, NOISE);
  let score = 18;
  score += Math.min(18, region.length * 6) + Math.min(18, team.length * 6) + Math.min(22, ops.length * 4) + Math.min(14, play.length * 4) + Math.min(10, demand.length * 2) + freshness(item.publishedAt);
  if (item.tier === 'T1') score += 7;
  score -= Math.min(30, noise.length * 15);
  score = Math.max(0, Math.min(100, score));
  const reasons = [];
  if (region.length) reasons.push('地域：' + region.slice(0, 3).join('、'));
  if (ops.length) reasons.push('可执行变化：' + ops.slice(0, 3).join('、'));
  if (team.length) reasons.push('企业场景：' + team.slice(0, 2).join('、'));
  if (play.length) reasons.push('玩法：' + play.slice(0, 3).join('、'));
  if (demand.length) reasons.push('需求信号：' + demand.slice(0, 2).join('、'));
  if (!reasons.length) reasons.push('官方文旅信号，待进一步判断团建迁移价值');
  let angle = '目的地 / 场地机会';
  if (/(闭园|暂停开放|台风|暴雨|高温|安全)/.test(text)) angle = '风险提醒 / 雨天备选';
  else if (/(开放|上新|新开|推出|线路|路线|活动)/.test(text)) angle = '新玩法 / 路线更新';
  else if (/(数据|增长|客流|市场|订单|需求)/.test(text)) angle = '趋势 / 需求判断';
  else if (/(优惠|消费券)/.test(text)) angle = '预算 / 性价比';
  return { score, reason: reasons.join(' · '), angle, decision: team.length || ops.length ? '可转成 HR/行政决策型内容' : '先作为选题信号观察' };
}

function extractJson(text) {
  const s = String(text || '').replace(/^\x60{3}(?:json)?/i, '').replace(/\x60{3}$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('model returned no JSON object');
  return JSON.parse(s.slice(a, b + 1));
}

export async function aiRerank(items, promptFile) {
  const base = (process.env.LLM_BASE_URL || '').trim(), key = (process.env.LLM_API_KEY || '').trim(), model = (process.env.LLM_MODEL || '').trim();
  if (!base || !key || !model) return { items, mode: 'rules' };
  const system = await fs.readFile(promptFile, 'utf8');
  const compact = items.slice(0, AI_POOL).map(function (x) {
    return { id:x.id, title:x.title, source:x.sourceName, publishedAt:x.publishedAt, excerpt:(x.excerpt || '').slice(0, 900), heuristicScore:x.heuristicScore };
  });
  const user = '请评估以下候选。只返回提示词约定的 JSON。\n\n' + JSON.stringify(compact);
  try {
    const res = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method:'POST', headers:{ authorization:'Bearer ' + key, 'content-type':'application/json' },
      body:JSON.stringify({ model, messages:[{role:'system',content:system},{role:'user',content:user}], temperature:0.1, max_tokens:5000 }),
      signal:AbortSignal.timeout(120000)
    });
    if (!res.ok) throw new Error('LLM HTTP ' + res.status + ': ' + (await res.text()).slice(0, 240));
    const data = await res.json(); const parsed = extractJson(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '');
    const byId = new Map((parsed.items || []).map(function (x) { return [String(x.id), x]; }));
    const merged = items.map(function (x) {
      const ai = byId.get(x.id); if (!ai || !Number.isFinite(Number(ai.score))) return x;
      const aiScore = Math.max(0, Math.min(100, Number(ai.score)));
      return Object.assign({}, x, { score:Math.round(aiScore * 0.78 + x.heuristicScore * 0.22), aiScore,
        reason:String(ai.reason || x.reason).slice(0,120), angle:String(ai.angle || x.angle).slice(0,80), decision:String(ai.decision || x.decision).slice(0,120) });
    });
    return { items:merged, mode:'ai+rules' };
  } catch (error) {
    console.warn('AI rerank failed, fallback to rules: ' + String(error && error.message || error));
    return { items, mode:'rules-fallback' };
  }
}
