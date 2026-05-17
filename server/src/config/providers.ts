/** 默认LLM模型配置，如temperature/maxTokens */
export const LLM_DEFAULTS = {
  temperature: 0.7,
  maxTokens: 2048,
  maxHistoryTokens: 4000,
};

/** 超时时间配置（毫秒） */
export const TIMEOUTS = {
  llmStream: 60000,       // LLM流式请求超时
  fetchModels: 15000,     // 获取模型列表超时
  modelSpeedTest: 30000,  // 模型测速超时
  baiduToken: 10000,      // 百度Token获取超时
  skillExecute: 60000,    // 技能执行超时
  documentAnalyze: 120000, // 文档分析超时
};

/** 抓取引擎配置 */
export const SCRAPER = {
  requestTimeout: 15000,  // 默认请求超时
  retryDelay: 2000,       // 重试延迟
  maxRetries: 2,          // 最大重试次数
  serpTimeout: 5000,      // SERP请求超时
  crawlInterval: 800,     // 爬取间隔延迟
  maxTextLength: 30000,   // 最大文本处理长度
  defaultCrawlDepth: 2,   // 默认爬取深度
  defaultMaxPages: 50,    // 默认最大页数
};

/** 搜索引擎URL模板 */
export const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    urlTemplate: (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=zh-CN`,
  },
  baidu: {
    name: '百度',
    urlTemplate: (query: string) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=20`,
  },
  bing: {
    name: 'Bing',
    urlTemplate: (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`,
  },
  sogou: {
    name: '搜狗',
    urlTemplate: (query: string) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
  },
  so360: {
    name: '360搜索',
    urlTemplate: (query: string) => `https://www.so.com/s?q=${encodeURIComponent(query)}`,
  },
  yandex: {
    name: 'Yandex',
    urlTemplate: (query: string) => `https://yandex.com/search/?text=${encodeURIComponent(query)}&lr=84`,
  },
};

/** 百度Token获取URL */
export const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';

/** 默认服务配置（前后端共用） */
export const DEFAULT_SERVICE_CONFIG = {
  anycrawl: { apiUrl: 'https://anycrawl.example.com', apiKey: '' },
  elasticsearch: { hosts: 'http://localhost:9200', indexPrefix: 'a_search' },
};