import fs from 'node:fs/promises';

const REGION = ['杭州','上海','苏州','宁波','嘉兴','绍兴','湖州','金华','义乌','无锡','常州','南京','桐庐','临安','富阳','青山湖','安吉','莫干山','千岛湖','舟山','嵊泗','枸杞岛','西山岛','溧阳','浙江','江苏'];
const TEAM = ['团建','企业团体','团队活动','公司活动','年会','会议团建','员工活动','工会活动'];
const DECISION = ['预约','限流','闭园','暂停开放','恢复开放','开放时间','营业时间','停车','大巴','接驳','住宿','酒店','会议室','餐饮','容量','团体','交通调整','线路调整','开通'];
const PLAY = ['露营','徒步','漂流','玩水','海岛','骑行','飞盘','卡丁车','温泉','农庄','营地','度假区','户外','趣味运动'];
const ROUTE = ['线路','路线','一日游','两天一夜','2天1夜','三天两夜','3天2夜','旅游专线','直达专线'];
const SEASON = ['秋游','春游','暑期','赏秋','红叶','银杏','花期','玩水季','漂流季','温泉季','采摘','露营季'];
const RISK = ['台风','暴雨','高温','寒潮','大风','天气','防汛','安全提示','临时关闭'];
const DEMAND = ['搜索量','预订','订单','客流','需求','同比增长','热门目的地','过夜游','酒店预订'];
const GENERIC_GOV = ['推介会','座谈会','论证会','成立','揭牌','签约','获奖','表彰','工作会议','党代会','调研','交流活动','考察','新闻发布会'];
const GENERIC_CULTURE = ['文博会','艺术节','展览','特展','画展','演出','颁奖','花车','文艺','博物馆'];
const POST_EVENT = ['综述','接待游客','假日市场','黄金周','热力全开','圆满落幕','顺利举行','精彩亮相','绘就','集结号'];
const AI_POOL = 24;

function hits(text, words) { return words.filter(function (w) { return text.includes(w); }); }
function ageDays(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 86400000) : null;
}
function freshness(iso) {
  const days = ageDays(iso);
  if (days === null) return 2;
  if (days <= 2) return 18;
  if (days <= 7) return 14;
  if (days <= 14) return 9;
  if (days <= 30) return 4;
  if (days <= 45) return 1;
  return 0;
}

function inferDecision(text) {
  if (/(闭园|暂停开放|恢复开放|开放时间|营业时间|预约|限流)/.test(text)) return '影响日期选择、场地可用性与预约安排';
  if (/(交通|大巴|停车|接驳|专线|开通|线路调整)/.test(text)) return '影响大巴、通勤时间与交通组织';
  if (/(住宿|酒店|会议室|餐饮)/.test(text)) return '影响2天1夜或“会议+团建”的配套选择';
  if (/(台风|暴雨|高温|寒潮|大风|天气|临时关闭)/.test(text)) return '影响户外项目与雨天/极端天气备选';
  if (/(线路|路线|徒步|骑行|漂流|露营|海岛|温泉|营地|度假区)/.test(text)) return '可转成路线、玩法或目的地选择内容';
  if (/(搜索量|预订|订单|热门目的地|酒店预订|需求)/.test(text)) return '可作为近期需求变化的验证信号';
  return '先作为选题信号观察';
}

export function scoreHeuristic(item) {
  const title = item.title || '';
  const lead = (item.excerpt || '').slice(0, 850);
  const text = title + '\n' + lead;

  const regionTitle = hits(title, REGION);
  const regionLead = hits(lead, REGION);
  const teamTitle = hits(title, TEAM);
  const teamLead = hits(lead, TEAM);
  const decisionTitle = hits(title, DECISION);
  const decisionLead = hits(lead, DECISION);
  const playTitle = hits(title, PLAY);
  const playLead = hits(lead, PLAY);
  const routeTitle = hits(title, ROUTE);
  const routeLead = hits(lead, ROUTE);
  const seasonTitle = hits(title, SEASON);
  const riskTitle = hits(title, RISK);
  const riskLead = hits(lead, RISK);
  const demandTitle = hits(title, DEMAND);
  const demandLead = hits(lead, DEMAND);
  const govNoise = hits(title, GENERIC_GOV);
  const cultureNoise = hits(title, GENERIC_CULTURE);
  const postNoise = hits(title, POST_EVENT);

  const strongOperational = decisionTitle.length + routeTitle.length + riskTitle.length + seasonTitle.length + playTitle.length;
  const titleSignal = strongOperational + teamTitle.length + demandTitle.length;

  let score = 8;
  score += Math.min(14, regionTitle.length * 7 + regionLead.length * 2);
  score += Math.min(22, decisionTitle.length * 11 + decisionLead.length * 2);
  score += Math.min(18, routeTitle.length * 10 + routeLead.length * 2);
  score += Math.min(15, playTitle.length * 7 + playLead.length * 2);
  score += Math.min(12, seasonTitle.length * 8);
  score += Math.min(16, riskTitle.length * 10 + riskLead.length * 2);
  score += Math.min(14, teamTitle.length * 10 + teamLead.length * 2);
  score += Math.min(10, demandTitle.length * 7 + demandLead.length);
  score += freshness(item.publishedAt);
  if (item.tier === 'T1') score += 3;

  // 正文里偶然出现“企业/会议/酒店”不能把一篇泛政务稿抬成高价值团建机会。
  if (titleSignal === 0) score = Math.min(score, 48);
  if (govNoise.length) score -= 28;
  if (cultureNoise.length && strongOperational === 0) score -= 18;
  if (postNoise.length && strongOperational === 0) score -= 20;

  const days = ageDays(item.publishedAt);
  if (days !== null && days > 30 && strongOperational === 0) score = Math.min(score, 42);
  if (days !== null && days > 45) score = Math.min(score, strongOperational ? 58 : 32);

  // 真正“可以立刻拿来做”的标题信号。
  if (/(恢复开放|暂停开放|闭园|预约|限流|交通调整|线路调整|旅游专线|直达专线|正式开通|试营业|正式营业)/.test(title)) score += 16;
  if (/(新线路|新路线|新场地|新开|上新|新增).*(露营|徒步|漂流|骑行|营地|度假区|温泉|景区|公园|酒店)/.test(title)) score += 12;
  if (/(团建|团队|年会|会议团建|企业活动)/.test(title)) score += 18;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const reasons = [];
  if (decisionTitle.length) reasons.push('决策变化：' + decisionTitle.slice(0, 3).join('、'));
  if (routeTitle.length) reasons.push('路线：' + routeTitle.slice(0, 2).join('、'));
  if (riskTitle.length) reasons.push('风险：' + riskTitle.slice(0, 2).join('、'));
  if (seasonTitle.length) reasons.push('季节：' + seasonTitle.slice(0, 2).join('、'));
  if (playTitle.length) reasons.push('玩法：' + playTitle.slice(0, 3).join('、'));
  if (teamTitle.length) reasons.push('企业场景：' + teamTitle.slice(0, 2).join('、'));
  if (demandTitle.length) reasons.push('需求：' + demandTitle.slice(0, 2).join('、'));
  if (regionTitle.length) reasons.push('地域：' + regionTitle.slice(0, 3).join('、'));
  if (!reasons.length && strongOperational) reasons.push('存在可执行团建信号');
  if (!reasons.length) reasons.push('泛文旅信息，团建迁移价值有限');

  let angle = '观察 / 暂不优先生产';
  if (riskTitle.length || /(闭园|暂停开放|临时关闭)/.test(title)) angle = '风险提醒 / 备选方案';
  else if (decisionTitle.length) angle = '决策清单 / 执行变化';
  else if (routeTitle.length) angle = '路线更新 / 行程参考';
  else if (playTitle.length || seasonTitle.length) angle = '季节玩法 / 目的地选择';
  else if (demandTitle.length) angle = '趋势 / 搜索需求';
  else if (teamTitle.length) angle = '企业团队场景';

  return {
    score,
    reason: reasons.join(' · '),
    angle,
    decision: inferDecision(text),
    strongSignal: titleSignal > 0,
    noise: govNoise.length + cultureNoise.length + postNoise.length
  };
}

function extractJson(text) {
  const s = String(text || '').replace(/^\x60{3}(?:json)?/i, '').replace(/\x60{3}$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('model returned no JSON object');
  return JSON.parse(s.slice(a, b + 1));
}

export async function aiRerank(items, promptFile) {
  const base = (process.env.LLM_BASE_URL || '').trim(), key = (process.env.LLM_API_KEY || '').trim(), model = (process.env.LLM_MODEL || '').trim();
  if (!base || !key || !model) return { items, mode: 'rules-v2' };
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
      return Object.assign({}, x, { score:Math.round(aiScore * 0.8 + x.heuristicScore * 0.2), aiScore,
        reason:String(ai.reason || x.reason).slice(0,120), angle:String(ai.angle || x.angle).slice(0,80), decision:String(ai.decision || x.decision).slice(0,120) });
    });
    return { items:merged, mode:'ai+rules-v2' };
  } catch (error) {
    console.warn('AI rerank failed, fallback to rules: ' + String(error && error.message || error));
    return { items, mode:'rules-v2-fallback' };
  }
}
