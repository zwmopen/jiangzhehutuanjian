import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchListing, enrichItem, mapLimit } from './radar-lite/source.mjs';
import { scoreHeuristic, aiRerank } from './radar-lite/score.mjs';
import { renderHtml } from './radar-lite/render.mjs';

const ROOT = process.cwd();
const MAX_DETAILS = 54;
const TOP_N = 5;
const MIN_TOP_SCORE = 55;
const MAX_PER_LIVE_SOURCE_IN_TOP = 2;
const MAX_DEMAND_IN_TOP = 3;

function currentMonthShanghai() {
  return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',month:'numeric'}).format(new Date()));
}

function demandCandidates(seedConfig) {
  const month = currentMonthShanghai();
  return (seedConfig.items || []).filter(function (x) { return (x.months || []).includes(month); }).map(function (x) {
    return {
      id:'demand-' + x.id,
      url:'',
      title:x.title,
      publishedAt:null,
      sourceId:'demand-seed',
      sourceName:'长期需求池·季节窗口',
      tier:'internal',
      sourceTags:['长期需求','季节窗口'].concat(x.regions || []),
      excerpt:'',
      heuristicScore:x.score,
      score:x.score,
      reason:'长期高价值问题 · 当前月份进入生产窗口',
      angle:x.angle,
      decision:x.decision,
      strongSignal:true,
      noise:0,
      signalType:'demand'
    };
  });
}

function pickTop(items) {
  const picked = [], sourceCounts = new Map();
  for (const x of items) {
    if (x.score < MIN_TOP_SCORE) continue;
    const count = sourceCounts.get(x.sourceId) || 0;
    const limit = x.sourceId === 'demand-seed' ? MAX_DEMAND_IN_TOP : MAX_PER_LIVE_SOURCE_IN_TOP;
    if (count >= limit) continue;
    picked.push(x);
    sourceCounts.set(x.sourceId, count + 1);
    if (picked.length >= TOP_N) break;
  }
  return picked;
}

async function main() {
  const config = JSON.parse(await fs.readFile(path.join(ROOT,'industry','sources.json'),'utf8'));
  const demand = JSON.parse(await fs.readFile(path.join(ROOT,'industry','demand-seeds.json'),'utf8'));
  const sources = (config.sources || []).filter(function (s) { return s.kind === 'web_list' && s.participation_mode === 'editorial' && s.enabled !== false; });
  const status = [], all = [];
  for (const source of sources) {
    try {
      const result = await fetchListing(source);
      const items = result.items;
      status.push({id:source.id,name:source.name,ok:true,count:items.length,via:result.via});
      all.push.apply(all, items);
    } catch (error) {
      status.push({id:source.id,name:source.name,ok:false,count:0,error:String(error && error.message || error).slice(0,220)});
    }
  }
  const unique = Array.from(new Map(all.map(function (x) { return [x.url,x]; })).values()).sort(function (a,b) { return (b.publishedAt ? Date.parse(b.publishedAt):0) - (a.publishedAt ? Date.parse(a.publishedAt):0); });
  const enriched = await mapLimit(unique.slice(0,MAX_DETAILS),6,enrichItem);
  const base = enriched.map(function (x) {
    const h = scoreHeuristic(x);
    return Object.assign({},x,{heuristicScore:h.score,score:h.score,reason:h.reason,angle:h.angle,decision:h.decision,strongSignal:h.strongSignal,noise:h.noise,signalType:'live'});
  }).sort(function(a,b){return b.score-a.score;});
  const reranked = await aiRerank(base, path.join(ROOT,'industry','prompts','lite-rerank.md'));
  const seeds = demandCandidates(demand);
  const candidates = reranked.items.concat(seeds).sort(function(a,b){return b.score-a.score;});
  const top5 = pickTop(candidates);
  const generatedAt = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','T') + '+08:00';
  const report = {
    meta:{
      generatedAt,
      sourceCount:sources.length,
      candidateCount:candidates.length,
      liveCandidateCount:reranked.items.length,
      demandSeedCount:seeds.length,
      topThreshold:MIN_TOP_SCORE
    },
    mode:reranked.mode,
    top5,
    candidates:candidates.slice(0,30),
    sources:status
  };
  const out = path.join(ROOT,'radar'); await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'latest.json'),JSON.stringify(report,null,2)+'\n');
  await fs.writeFile(path.join(out,'index.html'),renderHtml(report));
  console.log('Radar Lite: ' + sources.length + ' sources -> ' + reranked.items.length + ' live + ' + seeds.length + ' demand -> ' + report.top5.length + ' top items (' + report.mode + ')');
}
main().catch(function (error) { console.error(error); process.exitCode=1; });
