/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 默认页码 */
export const DEFAULT_PAGE = 1;

/** 表格列文本截断长度（字符数） */
export const TRUNCATE = {
  /** ID/短标识 */
  id: 16,
  /** URL地址 */
  url: 55,
  /** 用户输入/查询内容（中等） */
  input: 50,
  /** 技能提示词模板 */
  prompt: 60,
  /** 预览文本/摘要 */
  preview: 40,
  /** 执行结果/分析结果（长文本） */
  result: 40,
} as const;

/** 默认服务配置（与后端 providers.ts 保持一致） */
export const DEFAULT_SERVICE_CONFIG = {
  anycrawl: { apiUrl: 'https://anycrawl.example.com', apiKey: '' },
  elasticsearch: { hosts: 'http://localhost:9200', indexPrefix: 'a_search' },
};
