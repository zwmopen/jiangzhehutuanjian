export const SITE = {
  name: "江浙沪团建雷达",
  subject: "团建",
  homeTitle: "江浙沪团建雷达 — 私人内容机会与需求情报",
  description: "自动收集江浙沪团建相关信号，按客资潜力、搜索需求、HR决策价值和时效性筛选，每天留下少量真正值得生产的内容机会。",
  tagline: "今天最值得做什么，一眼看完",
  locale: "zh-CN",
  defaultUrl: "http://localhost:3000",
  mcpPrefix: "jzh_tuanjian",
  contactEmail: null as string | null,
  footerNote: "私人内容情报工具 · 基于开源框架改造",
  icp: null as string | null,
  organization: { name: "江浙沪团建雷达", founder: null as null | { name: string; url?: string; description?: string } },
  crawlerName: "JZHTeamRadarBot",
} as const;

export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  headline: ["信息每天很多，", "真正值得做的选题只有几条。"] as [string, string],
  lead: `${SITE.name} 替我盯住 {sources} 个信号源：采集、去重、评分、聚类，把值得转化成团建内容的机会留下来。`,
  steps: {
    collect: "三层信号：官方变化看可执行性，用户需求看真实问题，同行内容只做市场验证，不再把同行当唯一上游。",
    store: "保留可复用事实与趋势，同一事件自动归组，减少重复刷信息。",
    select: "按客资潜力、搜索/GEO、时效季节、江浙沪相关度、HR决策价值和内容可生产性评分。",
    publish: "目标是每天输出少量 Top 机会，进入既有选题库和内容生产工作流，而不是制造更多信息噪音。",
  },
  maker: null,
  copyright: `${SITE.name} 仅用于私人信息整理与内容研究。原始内容版权归各来源所有。需要更正或调整时可通过`,
} as const;

export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}
