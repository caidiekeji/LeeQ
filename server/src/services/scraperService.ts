import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import pool from '../config/database';
import { SCRAPER, SEARCH_ENGINES } from '../config/providers';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
function extractDomain(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
function normalizeUrl(url: string): string { try { const u = new URL(url); u.hash = ''; u.searchParams.sort(); return u.toString(); } catch { return url; } }
function isWikipedia(url: string): boolean { try { const h = new URL(url).hostname.toLowerCase(); return h.includes('wikipedia.org') || h.includes('wiki'); } catch { return false; } }

async function fetchWithRetry(url: string, options?: { retries?: number; timeout?: number }): Promise<string> {
  const retries = options?.retries ?? 2;
  const timeout = options?.timeout ?? SCRAPER.requestTimeout;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        timeout, maxRedirects: 5, responseType: 'text'
      });
      return response.data;
    } catch (err: any) {
      if (i === retries) throw err;
      await sleep(SCRAPER.retryDelay * (i + 1));
    }
  }
  throw new Error('请求失败');
}

export interface ScrapeResult { url: string; title: string; description: string; markdown: string; html: string; }
export interface SerpResult { docId: string; title: string; url: string; snippet: string; domain: string; score: string; engine: string; crawledAt: string; }

let docIdCounter = 0;
export const serpCache = new Map<string, SerpResult>();

async function loadSearchEngineConfig(): Promise<{ engines: { id: string; name: string; enabled: boolean }[] }> {
  try {
    const { rows } = await pool.query("SELECT config_value FROM system_config WHERE config_key = 'search_engine_config'");
    if (rows.length > 0) return JSON.parse(rows[0].config_value);
  } catch { /* 使用默认 */ }
  return { engines: ['google','baidu','bing','sogou','so360','yandex'].map(id => ({ id, name: id, enabled: true })) };
}

function createSerpResult(engineName: string, index: number, title: string, href: string, snippet: string): SerpResult {
  const nameMap: Record<string,string> = { google:'Google', baidu:'百度', bing:'Bing', sogou:'搜狗', so360:'360搜索', yandex:'Yandex' };
  return { docId: `d_${docIdCounter}_${engineName}_${index}`, title, url: href, snippet, domain: extractDomain(href), score: (9.5-(index-1)*0.15).toFixed(2), engine: nameMap[engineName]||engineName, crawledAt: new Date().toISOString() };
}

export async function scrape(url: string): Promise<ScrapeResult> {
  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);
  const isWiki = isWikipedia(url);
  $('script, style, noscript, iframe, nav, footer, .sidebar, .nav, .footer, .header, .menu, .advertisement, .ad, .ads, [role="navigation"]').remove();
  if (isWiki) {
    $('.infobox, .infobox-table, .metadata, .noprint, .mw-editsection, #mw-navigation, #siteNotice, .catlinks, .mw-indicators').remove();
    $('table.infobox, table.metadata, table.navbox, table.sistersitebox').remove();
  }
  const title = $('title').text().trim() || $('h1').first().text().trim() || url;
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  let mainContent = $('article, main, .content, .post-content, .article-content, .post-body, .article-body, #content, #article, #main-content, .markdown-body, .prose').html();
  if (!mainContent || mainContent.trim().length < 100) {
    if (isWiki) mainContent = $('#bodyContent, #mw-content-text, .mw-parser-output').html();
    if (!mainContent || mainContent.trim().length < 100) mainContent = $('body').html();
  }
  const markdown = turndown.turndown(mainContent || '');
  return { url, title, description, markdown, html };
}