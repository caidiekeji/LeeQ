import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { searchSERP, scrape, serpCache } from './scraperService';

// 搜索上下文缓存（用于AI回答流式输出时获取搜索结果）
export const searchContextCache = new Map<string, {
  query: string;
  results: any[];
  chatId?: string;
  userId?: number;
}>();

/**
 * 搜索服务：核心搜索业务逻辑
 */
export const searchService = {
  /**
   * 执行搜索（每次搜索完全独立，无上下文依赖）
   * @param query 搜索关键词
   * @param mode 搜索模式：search-普通搜索 url-URL抓取
   * @param url 目标URL（mode为url时使用）
   * @param page 页码
   * @param pageSize 每页结果数
   * @param ip 用户IP
   * @returns 搜索结果对象
   */
  async search(query: string, mode: string, url: string, page: number, pageSize: number, ip: string) {
    // 生成搜索唯一ID
    const searchId = 's_' + uuidv4().replace(/-/g, '').substring(0, 12);
    const startTime = Date.now();  // 记录开始时间

    let results: any[] = [];

    // 根据模式选择搜索方式
    if (mode === 'url' && url) {
      // URL模式：直接抓取指定URL
      const docId = 'd_direct_' + Date.now();
      const scraped = await scrape(url);
      results = [{
        docId,
        title: scraped.title,
        url: scraped.url,
        snippet: scraped.description || scraped.markdown.substring(0, 200).replace(/[#*\n]/g, ' '),
        domain: new URL(url).hostname.replace(/^www\./, ''),
        score: '9.90',
        engine: '直接抓取',
        crawledAt: new Date().toISOString()
      }];
      serpCache.set(docId, { ...results[0] } as any);
    } else {
      // 普通模式：多搜索引擎并发搜索
      results = await searchSERP(query, page);
    }

    // 缓存搜索上下文（供AI回答流式输出时获取搜索结果）
    searchContextCache.set(searchId, { 
      query,
      results
    });
    // 10分钟后自动清理缓存
    setTimeout(() => searchContextCache.delete(searchId), 600000);

    const elapsedMs = Date.now() - startTime;  // 计算耗时

    // 记录搜索日志到数据库
    try {
      await pool.query(
        'INSERT INTO search_log (search_id, query, mode, result_count, elapsed_ms, ip) VALUES ($1, $2, $3, $4, $5, $6)',
        [searchId, query, mode, results.length * 10, elapsedMs, ip]
      );
    } catch { /* 数据库不可用，跳过日志记录 */ }

    return {
      searchId,
      query,
      totalResults: results.length * 10,  // 估算总结果数
      elapsedMs,
      results,
      aiAnswer: { streamUrl: `/api/v1/search/stream?searchId=${searchId}` }  // AI回答流式接口URL
    };
  },

  /**
   * 获取页面内容（根据docId）
   * @param docId 文档ID
   * @returns 页面内容对象
   */
  async getContent(docId: string) {
    // 先从SERP缓存获取URL
    const cached = serpCache.get(docId);
    if (cached) {
      try {
        // 重新抓取页面获取最新内容
        const scraped = await scrape(cached.url);
        return {
          docId,
          title: scraped.title,
          url: scraped.url,
          markdownContent: scraped.markdown,
          crawledAt: new Date().toISOString()
        };
      } catch (err: any) {
        console.error('内容抓取失败:', err.message);
      }
    }

    // 如果缓存不存在，尝试从数据库获取
    try {
      const { rows } = await pool.query('SELECT * FROM crawl_task WHERE anycrawl_task_id = $1', [docId]);
      if (rows.length > 0) {
        const task = rows[0];
        return {
          docId,
          title: task.url,
          url: task.url,
          markdownContent: task.markdown_content || '# 暂无内容\n\n该页面尚未抓取完整内容。',
          crawledAt: task.completed_at || task.created_at
        };
      }
    } catch { /* 数据库不可用 */ }

    return null;
  },

  /**
   * 获取热门搜索词
   * @returns 热门搜索词数组
   */
  async getHotwords() {
    try {
      // 从搜索日志中统计最频繁的查询
      const { rows } = await pool.query(
        'SELECT query, COUNT(*)::int as cnt FROM search_log GROUP BY query ORDER BY cnt DESC LIMIT 8'
      );
      const hotwords = rows.map((r: any) => r.query);
      if (hotwords.length > 0) return hotwords;
    } catch { /* 数据库不可用 */ }
    // 返回默认热词
    return ['人工智能', '大模型', 'RAG技术', '深度学习', '自动驾驶', '量子计算', 'Web3', '新能源'];
  },

  /**
   * 提交用户反馈
   * @param searchId 搜索ID
   * @param rating 评价结果
   * @param query 搜索词
   */
  async submitFeedback(searchId: string, rating: string, query: string) {
    try {
      await pool.query(
        'INSERT INTO feedback (search_id, query, rating) VALUES ($1, $2, $3)',
        [searchId, query, rating]
      );
    } catch { /* 数据库不可用 */ }
  }
};
