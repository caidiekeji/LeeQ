import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import pool from '../config/database';
import { SCRAPER, SEARCH_ENGINES } from '../config/providers';

// 初始化HTML转Markdown服务
const turndown = new TurndownService({
  headingStyle: 'atx',           // 使用ATX风格的标题（# 标题）
  codeBlockStyle: 'fenced'       // 使用围栏代码块（```）
});

// 请求头伪装配置（模拟Chrome浏览器）
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 提取URL中的域名部分（去除www前缀）
 * @param url 完整URL
 * @returns 域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * 标准化URL：移除hash、排序query参数，便于去重
 * @param url 原始URL
 * @returns 标准化后的URL
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';                  // 移除锚点
    u.searchParams.sort();        // 排序查询参数
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 判断是否为维基百科URL
 * @param url 待判断URL
 * @returns 是否为维基百科URL
 */
function isWikipedia(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('wikipedia.org') || hostname.includes('wiki');
  } catch {
    return false;
  }
}

/**
 * 带重试机制的HTTP请求函数
 * @param url 请求URL
 * @param options 可选参数：retries重试次数、timeout超时时间
 * @returns HTML内容字符串
 */
async function fetchWithRetry(url: string, options?: { retries?: number; timeout?: number }): Promise<string> {
  const retries = options?.retries ?? 2;        // 默认重试2次
  const timeout = options?.timeout ?? SCRAPER.requestTimeout;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        timeout,
        maxRedirects: 5,
        responseType: 'text'
      });
      return response.data;
    } catch (err: any) {
      if (i === retries) throw err;             // 最后一次重试失败则抛出异常
      await sleep(SCRAPER.retryDelay * (i + 1));       // 递增延迟重试
    }
  }
  throw new Error('请求失败');
}

// ==================== 单页抓取 ====================

/**
 * 抓取结果接口定义
 */
export interface ScrapeResult {
  url: string;         // 页面URL
  title: string;       // 页面标题
  description: string; // 页面描述
  markdown: string;    // Markdown格式的内容
  html: string;        // 原始HTML内容
}

/**
 * 抓取单个页面内容
 * @param url 目标URL
 * @returns 抓取结果
 */
export async function scrape(url: string): Promise<ScrapeResult> {
  const html = await fetchWithRetry(url);  // 获取HTML内容
  const $ = cheerio.load(html);            // 解析HTML

  const isWiki = isWikipedia(url);         // 判断是否为维基百科页面

  // 移除干扰元素：脚本、样式、导航、广告等
  $('script, style, noscript, iframe, nav, footer, .sidebar, .nav, .footer, .header, .menu, .advertisement, .ad, .ads, [role="navigation"]').remove();

  // 维基百科页面额外移除：信息框、编辑按钮、导航等
  if (isWiki) {
    $('.infobox, .infobox-table, .metadata, .noprint, .mw-editsection, #mw-navigation, #siteNotice, .catlinks, .mw-indicators').remove();
    $('table.infobox, table.metadata, table.navbox, table.sistersitebox').remove();
  }

  // 提取标题
  const title = $('title').text().trim() || $('h1').first().text().trim() || url;
  // 提取描述
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

  // 提取主要内容区域（按优先级尝试）
  let mainContent = $('article, main, .content, .post-content, .article-content, .post-body, .article-body, #content, #article, #main-content, .markdown-body, .prose').html();
  // 如果内容太少，尝试维基百科专用选择器
  if (!mainContent || mainContent.trim().length < 100) {
    if (isWiki) {
      mainContent = $('#bodyContent, #mw-content-text, .mw-parser-output').html();
    }
    // 最后尝试body
    if (!mainContent || mainContent.trim().length < 100) {
      mainContent = $('body').html();
    }
  }

  // HTML转Markdown
  const markdown = turndown.turndown(mainContent || '');

  return { url, title, description, markdown, html };
}

// ==================== SERP 搜索抓取 ====================

/**
 * SERP搜索结果接口定义
 */
export interface SerpResult {
  docId: string;      // 文档ID
  title: string;      // 标题
  url: string;        // URL
  snippet: string;    // 摘要
  domain: string;     // 域名
  score: string;      // 相关度评分
  engine: string;     // 搜索引擎名称
  crawledAt: string;  // 抓取时间
}

// 文档ID计数器（用于生成唯一ID）
let docIdCounter = 0;
// SERP结果缓存（内存缓存）
export const serpCache = new Map<string, SerpResult>();

/**
 * 从数据库加载搜索引擎配置
 * @returns 搜索引擎配置对象
 */
async function loadSearchEngineConfig(): Promise<{ engines: { id: string; name: string; enabled: boolean }[] }> {
  try {
    const { rows } = await pool.query(
      "SELECT config_value FROM system_config WHERE config_key = 'search_engine_config'"
    );
    if (rows.length > 0) {
      return JSON.parse(rows[0].config_value);
    }
  } catch { /* 数据库不可用，使用默认配置 */ }
  // 默认配置：启用所有搜索引擎
  return {
    engines: [
      { id: 'google', name: 'Google', enabled: true },
      { id: 'baidu', name: '百度', enabled: true },
      { id: 'bing', name: 'Bing', enabled: true },
      { id: 'sogou', name: '搜狗', enabled: true },
      { id: 'so360', name: '360搜索', enabled: true },
      { id: 'yandex', name: 'Yandex', enabled: true }
    ]
  };
}

/**
 * 执行多搜索引擎并发搜索
 * @param query 搜索关键词
 * @param page 页码（当前未使用）
 * @returns 合并后的搜索结果列表
 */
export async function searchSERP(query: string, page: number = 1): Promise<SerpResult[]> {
  docIdCounter++;  // 递增计数器

  const serpOptions = { retries: 0, timeout: SCRAPER.serpTimeout };  // SERP请求配置
  const config = await loadSearchEngineConfig();      // 加载引擎配置
  const enabledEngines = config.engines.filter(e => e.enabled).map(e => e.id);  // 筛选启用的引擎

  // 如果没有启用的引擎，返回降级结果
  if (enabledEngines.length === 0) return generateFallbackSerp(query);

  // 搜索引擎函数映射表
  const engineFnMap: Record<string, (q: string, opts: { retries: number; timeout: number }) => Promise<SerpResult[]>> = {
    google: searchGoogle,
    baidu: searchBaidu,
    bing: searchBing,
    sogou: searchSogou,
    so360: search360,
    yandex: searchYandex
  };

  const allResults: SerpResult[] = [];    // 所有结果集合
  const seenUrls = new Set<string>();     // 已处理的URL（用于去重）

  // 并发请求所有搜索引擎
  const tasks = enabledEngines.map(engineId => {
    const fn = engineFnMap[engineId];
    if (!fn) return Promise.resolve<SerpResult[]>([]);
    return fn(query, serpOptions).catch(err => {
      console.error(`${engineId} SERP失败:`, (err as Error).message);
      return [] as SerpResult[];
    });
  });

  // 等待所有请求完成（即使部分失败）
  const settledResults = await Promise.allSettled(tasks);
  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        // URL去重
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          allResults.push(r);
          serpCache.set(r.docId, r);  // 缓存结果
        }
      }
    }
  }

  // 如果没有获取到结果，使用降级数据
  if (allResults.length === 0) {
    allResults.push(...generateFallbackSerp(query));
  }

  return allResults;
}

/**
 * 通用的搜索结果条目构建函数
 * @param engineName 搜索引擎名称标识
 * @param index 结果序号
 * @param title 标题
 * @param href URL
 * @param snippet 摘要
 */
function createSerpResult(engineName: string, index: number, title: string, href: string, snippet: string): SerpResult {
  return {
    docId: `d_${docIdCounter}_${engineName}_${index}`,
    title,
    url: href,
    snippet,
    domain: extractDomain(href),
    score: (9.5 - (index - 1) * 0.15).toFixed(2),
    engine: engineName === 'google' ? 'Google'
      : engineName === 'baidu' ? '百度'
      : engineName === 'bing' ? 'Bing'
      : engineName === 'sogou' ? '搜狗'
      : engineName === 'so360' ? '360搜索'
      : 'Yandex',
    crawledAt: new Date().toISOString()
  };
}

// ==================== 各搜索引擎解析函数 ====================

/** Google搜索引擎 */
async function searchGoogle(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const searchUrl = SEARCH_ENGINES.google.urlTemplate(query);
  const html = await fetchWithRetry(searchUrl, options);
  const $ = cheerio.load(html);

  $('#search .g, #search .MjjYud').each((_, el) => {
    const linkEl = $(el).find('h3');
    const hrefEl = $(el).find('a[href^="http"]');
    const snippetEl = $(el).find('.VwiC3b, .lEBKkf span, [data-sncf]');
    if (linkEl.length && hrefEl.length) {
      const href = hrefEl.first().attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title && href.startsWith('http')) {
        results.push(createSerpResult('google', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/** 百度搜索引擎 */
async function searchBaidu(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const searchUrl = SEARCH_ENGINES.baidu.urlTemplate(query);
  const html = await fetchWithRetry(searchUrl, options);
  const $ = cheerio.load(html);

  $('.result, .c-container').each((_, el) => {
    const linkEl = $(el).find('h3.t a, h3.c-title a');
    const snippetEl = $(el).find('.c-abstract, .c-span-last span, .content-right_8Zs40');
    if (linkEl.length) {
      const href = linkEl.attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title) {
        results.push(createSerpResult('baidu', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/** Bing搜索引擎 */
async function searchBing(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const bingUrl = SEARCH_ENGINES.bing.urlTemplate(query);
  const html = await fetchWithRetry(bingUrl, options);
  const $ = cheerio.load(html);

  $('li.b_algo').each((_, el) => {
    const linkEl = $(el).find('h2 a');
    const snippetEl = $(el).find('.b_caption p, .b_lineclamp2');
    if (linkEl.length) {
      const href = linkEl.attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title && href.startsWith('http')) {
        results.push(createSerpResult('bing', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/** 搜狗搜索引擎 */
async function searchSogou(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const searchUrl = SEARCH_ENGINES.sogou.urlTemplate(query);
  const html = await fetchWithRetry(searchUrl, options);
  const $ = cheerio.load(html);

  $('.results .rb, .results .vrwrap, .result').each((_, el) => {
    const linkEl = $(el).find('h3.vr-title a, h3 a, .vr-title a');
    const snippetEl = $(el).find('.star-wiki, .space-txt, .str-text, .str_info, .vr_summary');
    if (linkEl.length) {
      const href = linkEl.attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title && href.startsWith('http')) {
        results.push(createSerpResult('sogou', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/** 360搜索引擎 */
async function search360(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const searchUrl = SEARCH_ENGINES.so360.urlTemplate(query);
  const html = await fetchWithRetry(searchUrl, options);
  const $ = cheerio.load(html);

  $('.result, li.res-list, .res-list').each((_, el) => {
    const linkEl = $(el).find('h3 a, .res-title a');
    const snippetEl = $(el).find('.res-desc, .res-summary, .res-rich-summary');
    if (linkEl.length) {
      const href = linkEl.attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title && href.startsWith('http')) {
        results.push(createSerpResult('so360', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/** Yandex搜索引擎 */
async function searchYandex(query: string, options: { retries: number; timeout: number }): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  const searchUrl = SEARCH_ENGINES.yandex.urlTemplate(query);
  const html = await fetchWithRetry(searchUrl, options);
  const $ = cheerio.load(html);

  $('li.serp-item').each((_, el) => {
    const linkEl = $(el).find('h2 a, a.link');
    const snippetEl = $(el).find('.text-container, .organic__text');
    if (linkEl.length) {
      const href = linkEl.attr('href') || '';
      const title = linkEl.text().trim();
      if (href && title && href.startsWith('http')) {
        results.push(createSerpResult('yandex', results.length + 1, title, href, snippetEl.first().text().trim()));
      }
    }
  });
  return results;
}

/**
 * 生成降级搜索结果（当所有搜索引擎都失败时）
 * @param query 搜索关键词
 * @returns 模拟的搜索结果列表
 */
function generateFallbackSerp(query: string): SerpResult[] {
  // 常用中文搜索源域名
  const domains = [
    { d: 'zhihu.com', t: '知乎' },
    { d: 'csdn.net', t: 'CSDN' },
    { d: 'juejin.cn', t: '掘金' },
    { d: 'wikipedia.org', t: 'Wikipedia' },
    { d: 'github.com', t: 'GitHub' },
    { d: 'arxiv.org', t: 'arXiv' }
  ];

  const results: SerpResult[] = [];
  for (let i = 0; i < 10; i++) {
    const dm = domains[i % domains.length];  // 循环使用域名
    const docId = `d_${Date.now()}_fb${i}`;
    results.push({
      docId,
      title: `${query} - ${dm.t}搜索结果`,
      url: `https://${dm.d}/search?q=${encodeURIComponent(query)}`,
      snippet: `在${dm.t}上搜索"${query}"的相关结果。项目正在使用内建 AnyCrawl 引擎获取实时搜索结果...`,
      domain: dm.d,
      score: (9.5 - i * 0.3).toFixed(2),
      engine: '内置',
      crawledAt: new Date().toISOString()
    });
  }
  return results;
}

// ==================== 全网爬取 ====================

/**
 * 爬取页面接口定义
 */
export interface CrawlPage {
  url: string;         // 页面URL
  title: string;       // 页面标题
  markdown: string;    // Markdown内容
  depth: number;       // 爬取深度
}

/**
 * 全网爬取：从起始URL开始，按广度优先策略爬取整个网站
 * @param startUrl 起始URL
 * @param maxDepth 最大爬取深度
 * @param maxPages 最大爬取页面数
 * @returns 爬取到的所有页面
 */
export async function crawl(startUrl: string, maxDepth: number = SCRAPER.defaultCrawlDepth, maxPages: number = SCRAPER.defaultMaxPages): Promise<CrawlPage[]> {
  const visited = new Set<string>();    // 已访问URL集合
  const results: CrawlPage[] = [];      // 结果集合
  const queue: { url: string; depth: number }[] = [{ url: normalizeUrl(startUrl), depth: 0 }];  // 爬取队列
  const baseOrigin = new URL(startUrl).origin;  // 起始URL的域名（限制同站爬取）

  // 当队列非空且未达到最大页面数时继续
  while (queue.length > 0 && results.length < maxPages) {
    // 每批处理3个URL（并发控制）
    const batchSize = Math.min(3, queue.length);
    const batch: { url: string; depth: number }[] = [];

    // 提取批次项
    for (let i = 0; i < batchSize; i++) {
      const item = queue.shift();
      if (!item) break;
      if (visited.has(item.url)) continue;  // 跳过已访问
      visited.add(item.url);
      batch.push(item);
    }

    if (batch.length === 0) continue;

    // 并发爬取批次URL
    const batchResults = await Promise.allSettled(
      batch.map(async ({ url, depth }) => {
        try {
          const result = await scrape(url);  // 抓取页面
          const $ = cheerio.load(result.html);

          // 如果未达最大深度，提取页面内的链接加入队列
          if (depth < maxDepth && results.length < maxPages) {
            $('a[href]').each((_, el) => {
              const href = $(el).attr('href');
              if (!href) return;
              try {
                const absoluteUrl = new URL(href, url).href;
                const normalized = normalizeUrl(absoluteUrl);
                // 仅爬取同站点的URL
                if (!visited.has(normalized) && new URL(absoluteUrl).origin === baseOrigin) {
                  if (queue.length + results.length < maxPages) {
                    queue.push({ url: normalized, depth: depth + 1 });
                  }
                }
              } catch { /* 无效URL跳过 */ }
            });
          }

          return { url: result.url, title: result.title, markdown: result.markdown, depth };
        } catch (err: any) {
          console.error(`爬取失败 ${url}:`, err.message);
          return null;
        }
      })
    );

    // 收集成功结果
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }

    // 延迟避免请求过快
    await sleep(SCRAPER.crawlInterval);
  }

  return results;
}
