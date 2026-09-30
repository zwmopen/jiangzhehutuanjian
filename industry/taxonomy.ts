// 江浙沪团建雷达的行业分类。保留底层 ITEM_TYPES 字符串以兼容原框架，
// 但显示语义、标签、主题全部改为企业团建与周边活动决策。

export const CATEGORIES = [
  { key: "destination", label: "目的地", section: "目的地与场地", guide: "城市、景区、度假区、酒店、营地、农庄、轰趴、会议与团体接待场地的新信息" },
  { key: "route", label: "路线", section: "路线与方案", guide: "半日、一日、2天1夜、3天2夜等可执行路线、组合方案和区域串联" },
  { key: "activity", label: "玩法", section: "玩法与项目", guide: "露营、徒步、漂流、玩水、海岛、飞盘、骑行、卡丁车、趣味运动会、温泉、采摘等玩法" },
  { key: "operations", label: "运营变化", section: "运营与风险", guide: "开放闭园、预约规则、营业季、容量、停车、大巴、交通、住宿、餐饮、会议室等可执行性变化" },
  { key: "season", label: "季节天气", section: "季节与天气", guide: "花期、玩水季、赏秋、年会季、台风、高温、暴雨、寒潮等会改变活动选择的时效信号" },
  { key: "demand", label: "需求", section: "需求与决策", guide: "人数、预算、天数、组织难点、HR/行政真实问题、搜索趋势和内容缺口" },
  { key: "industry", label: "行业", section: "政策与行业", guide: "文旅政策、交通政策、旅游安全、市场趋势、企业活动相关行业变化" },
] as const;

// 底层若已有枚举约束，先不改字符串；由 Prompt 把它们映射到团建语义。
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

export const CATEGORY_TAGS = [
  "目的地/场地",
  "路线方案",
  "玩法项目",
  "营业/预约",
  "交通/天气",
  "预算/人数",
  "趋势/需求",
  "政策/行业",
  "避坑/指南",
  "其他",
] as const;

export const TOPIC_TAGS = [
  "杭州","上海","苏州","宁波","嘉兴","绍兴","湖州","金华","义乌","无锡","常州","南京",
  "桐庐","临安","富阳","青山湖","安吉","莫干山","千岛湖","舟山","嵊泗","枸杞岛","西山岛","溧阳",
  "10-20人","20-50人","50-100人","100人以上",
  "半日","1日","2天1夜","3天2夜",
  "露营","徒步","漂流","玩水","海岛","飞盘","骑行","卡丁车","轰趴","温泉","趣味运动会","年会","会议团建",
  "雨天备选","预算","交通","住宿","餐饮","会议室","停车大巴","搜索/GEO"
] as const;

export const ENTITY_TAGS = [] as const;

export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  场地:"目的地/场地", 景区:"目的地/场地", 酒店:"目的地/场地", 营地:"目的地/场地", 农庄:"目的地/场地",
  路线:"路线方案", 行程:"路线方案", 方案:"路线方案",
  玩法:"玩法项目", 项目:"玩法项目", 团建项目:"玩法项目",
  营业:"营业/预约", 开放:"营业/预约", 闭园:"营业/预约", 预约:"营业/预约",
  天气:"交通/天气", 交通:"交通/天气", 台风:"交通/天气", 高温:"交通/天气", 暴雨:"交通/天气",
  人数:"预算/人数", 预算:"预算/人数", 客资:"趋势/需求", 需求:"趋势/需求", 趋势:"趋势/需求",
  政策:"政策/行业", 监管:"政策/行业", 安全提示:"政策/行业",
  避坑:"避坑/指南", 攻略:"避坑/指南", 指南:"避坑/指南",
};

export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "营业/预约",
  product_launch: "目的地/场地",
  tool_or_prompt: "路线方案",
  research_paper: "趋势/需求",
  industry_event: "政策/行业",
  opinion_analysis: "趋势/需求",
  tutorial_explainer: "避坑/指南",
};

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {};
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [];
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [];
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
