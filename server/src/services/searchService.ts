import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { searchSERP, scrape, serpCache } from './scraperService';

export const searchContextCache = new Map<string, {
  query: string;
  results: any[];
  chatId?: string;
  userId?: number;
}>();

export const searchService = {
  async search(query: string, mode: string, url: string, page: number, pageSize: number, ip: string) {
    const searchId = 's_' + uuidv4().replace(/-/g, '').substring(0, 12);
    const startTime = Date.now();
    let results: any[] = [];
    if (mode === 'url' && url) {
      const docId = 'd_direct_' + Date.now();
      const scraped = await scrape(url);
      results = [{
        docId, title: scraped.title, url: scraped.url,
        snippet: scraped.description || scraped.markdown.substring(0, 200).replace(/[#*\n]/g, ' '),
        domain: new URL(url).hostname.replace(/^www\./, ''), score: '9.90',
        engine: '直接抓取', crawledAt: new Date().toISOString()
      }];
      serpCache.set(docId, { ...results[0] } as any);
    } else {
      results = await searchSERP(query, page);
    }
    searchContextCache.set(searchId, { query, results });
    setTimeout(() => searchContextCache.delete(searchId), 600000);
    const elapsedMs = Date.now() - startTime;
    try {
      await pool.query(
        'INSERT INTO search_log (search_id, query, mode, result_count, elapsed_ms, ip) VALUES ($1, $2, $3, $4, $5, $6)',
        [searchId, query, mode, results.length * 10, elapsedMs, ip]
      );
    } catch { /* 数据库不可用 */ }
    return {
      searchId, query, totalResults: results.length * 10, elapsedMs, results,
      aiAnswer: { streamUrl: `/api/v1/search/stream?searchId=${searchId}` }
    };
  },
  async getContent(docId: string) {
    const cached = serpCache.get(docId);
    if (cached) {
      try {
        const scraped = await scrape(cached.url);
        return { docId, title: scraped.title, url: scraped.url, markdownContent: scraped.markdown, crawledAt: new Date().toISOString() };
      } catch { /* fall through */ }
    }
    try {
      const { rows } = await pool.query('SELECT * FROM crawl_task WHERE anycrawl_task_id = $1', [docId]);
      if (rows.length > 0) {
        const task = rows[0];
        return { docId, title: task.url, url: task.url, markdownContent: task.markdown_content || '# 暂无内容', crawledAt: task.completed_at || task.created_at };
      }
    } catch { /* 数据库不可用 */ }
    return null;
  },
  async getHotwords() {
    try {
      const { rows } = await pool.query('SELECT query, COUNT(*)::int as cnt FROM search_log GROUP BY query ORDER BY cnt DESC LIMIT 8');
      if (rows.length > 0) return rows.map((r: any) => r.query);
    } catch { /* fallback */ }
    return ['人工智能', '大模型', 'RAG技术', '深度学习', '自动驾驶', '量子计算', 'Web3', '新能源'];
  },
  async submitFeedback(searchId: string, rating: string, query: string) {
    try {
      await pool.query('INSERT INTO feedback (search_id, query, rating) VALUES ($1, $2, $3)', [searchId, query, rating]);
    } catch { /* 数据库不可用 */ }
  }
};