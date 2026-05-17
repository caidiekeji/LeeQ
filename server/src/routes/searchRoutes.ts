import { Router, Request, Response } from 'express';
import { searchService, searchContextCache } from '../services/searchService';
import { streamChat, streamChatDirect, streamChatEnhanced } from '../services/llmService';
import { scrape } from '../services/scraperService';
import { checkUsageLimit, recordUsage } from '../utils/usageLimit';
import { adminService } from '../services/adminService';
import { conversationService } from '../services/conversationService';
import pool from '../config/database';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
    }
    console.warn('⚠ 未设置 JWT_SECRET 环境变量，使用开发默认密钥，生产环境请务必设置！');
    return 'dev-jwt-secret-do-not-use-in-production';
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const router = Router();

function getUserIdFromToken(req: Request): number | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    return decoded.id;
  } catch {
    return undefined;
  }
}

interface ChatSession {
  messages: Array<{ role: string; content: string }>;
  lastActive: number;
  userId?: number;
  fileIds?: number[];
  skillId?: number;
  skillPrompt?: string;
  fileContext?: string;
}
const chatContextCache = new Map<string, ChatSession>();

async function saveChatToDb(userId: number, chatId: string, role: string, content: string) {
  try {
    await pool.query(
      'INSERT INTO chat_history (user_id, chat_id, role, content) VALUES ($1, $2, $3, $4)',
      [userId, chatId, role, content]
    );
  } catch { /* 数据库不可用，跳过 */ }
}

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, mode = 'search', url = '', page = 1 } = req.body;
    if (!query || query.trim() === '') {
      return res.status(400).json({ code: 400, message: '搜索词不能为空' });
    }
    if (query.length > 500) {
      return res.status(400).json({ code: 400, message: '搜索内容过长，请精简后重试' });
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userId = getUserIdFromToken(req);

    const usage = await checkUsageLimit(ip, userId);
    if (!usage.canUse) {
      return res.status(403).json({
        code: 403,
        message: '免费次数已用完，请登录后继续使用',
        data: { needLogin: true, remaining: 0 }
      });
    }

    const data = await searchService.search(query, mode, url, page, 20, ip);

    const chatId = 's_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    if (userId) saveChatToDb(userId, chatId, 'user', query);

    const ctx = searchContextCache.get(data.searchId);
    if (ctx) { ctx.chatId = chatId; ctx.userId = userId; }

    await recordUsage(ip, userId);

    const updatedUsage = await checkUsageLimit(ip, userId);
    res.json({
      code: 0,
      message: 'success',
      data: { ...data, remaining: updatedUsage.remaining }
    });
  } catch (err) {
    console.error('搜索失败:', err);
    res.status(500).json({ code: 500, message: '搜索服务异常，请稍后重试' });
  }
});

router.get('/search/stream', async (req: Request, res: Response) => {
  const searchId = req.query.searchId as string;
  if (!searchId) {
    return res.status(400).json({ code: 400, message: '缺少searchId参数' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.flushHeaders();
  if (res.socket) res.socket.setNoDelay(true);

  const context = searchContextCache.get(searchId);

  if (!context) {
    res.write(`event: start\ndata: ${JSON.stringify({ searchId })}\n\n`);
    res.write(`event: chunk\ndata: ${JSON.stringify({ text: '搜索结果已过期，请重新搜索' })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ searchId, fullText: '', elapsedMs: 0 })}\n\n`);
    return res.end();
  }

  const maxResults = Math.min(context.results.length, 5);
  const scrapePromises = context.results.slice(0, maxResults).map(async (r: any, i: number) => {
    try {
      const scraped = await scrape(r.url);
      const truncated = scraped.markdown.length > 3000
        ? scraped.markdown.substring(0, 3000) + '\n...(内容过长已截断)'
        : scraped.markdown;
      return `[${i + 1}] ${r.title} (${r.url})\n${truncated}`;
    } catch {
      return `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`;
    }
  });

  const searchContexts = await Promise.all(scrapePromises);
  const searchContext = searchContexts.join('\n\n---\n\n');

  res.write(`event: start\ndata: ${JSON.stringify({ searchId })}\n\n`);

  streamChat(
    context.query,
    searchContext,
    (text) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    (fullText) => {
      const sources = context.results.slice(0, 5).map((r: any, i: number) => ({
        index: i + 1,
        url: r.url,
        title: r.title
      }));
      if (context.chatId && context.userId) {
        saveChatToDb(context.userId, context.chatId, 'assistant', fullText);
      }
      res.write(`event: citation\ndata: ${JSON.stringify({ sources })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ searchId, fullText, elapsedMs: Date.now() - parseInt(searchId.substring(2)) || 0 })}\n\n`);
      res.end();
    }
  );
});

router.get('/content/:docId', async (req: Request, res: Response) => {
  try {
    const data = await searchService.getContent(req.params.docId);
    if (!data) {
      return res.status(404).json({ code: 404, message: '内容不存在' });
    }
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    console.error('获取内容失败:', err);
    res.status(500).json({ code: 500, message: '服务异常' });
  }
});

router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { searchId, rating } = req.body;
    if (!searchId || !rating) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    let query = '';
    try {
      const { rows } = await pool.query('SELECT query FROM search_log WHERE search_id = $1 LIMIT 1', [searchId]);
      if (rows.length > 0) query = rows[0].query || '';
    } catch { /* 查询失败时query保持为空 */ }
    await searchService.submitFeedback(searchId, rating, query);
    res.json({ code: 0, message: '反馈已提交' });
  } catch (err) {
    console.error('提交反馈失败:', err);
    res.status(500).json({ code: 500, message: '反馈提交失败' });
  }
});

router.get('/hotwords', async (_req: Request, res: Response) => {
  try {
    const hotwords = await searchService.getHotwords();
    res.json({ code: 0, message: 'success', data: { hotwords } });
  } catch (err) {
    res.json({ code: 0, message: 'success', data: { hotwords: ['人工智能', '大模型', 'RAG技术', '深度学习'] } });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, chatId } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ code: 400, message: '消息不能为空' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ code: 400, message: '消息内容过长' });
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userId = getUserIdFromToken(req);

    const usage = await checkUsageLimit(ip, userId);
    if (!usage.canUse) {
      return res.status(403).json({
        code: 403,
        message: '免费次数已用完，请登录后继续使用',
        data: { needLogin: true, remaining: 0 }
      });
    }

    const newChatId = chatId || (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));

    if (!chatContextCache.has(newChatId)) {
      chatContextCache.set(newChatId, { messages: [], lastActive: Date.now() });
    }

    const session = chatContextCache.get(newChatId)!;
    session.messages.push({ role: 'user', content: message });
    session.lastActive = Date.now();
    if (userId) session.userId = userId;

    if (userId) {
      saveChatToDb(userId, newChatId, 'user', message);
    }

    setTimeout(() => {
      const existing = chatContextCache.get(newChatId);
      if (existing && Date.now() - existing.lastActive > 300000) {
        chatContextCache.delete(newChatId);
      }
    }, 300000);

    await recordUsage(ip, userId);
    const updatedUsage = await checkUsageLimit(ip, userId);
    res.json({
      code: 0,
      message: 'success',
      data: {
        chatId: newChatId,
        streamUrl: `/api/v1/chat/stream?chatId=${newChatId}`,
        remaining: updatedUsage.remaining
      }
    });
  } catch (err) {
    console.error('聊天接口异常:', err);
    res.status(500).json({ code: 500, message: '聊天服务异常' });
  }
});

router.get('/chat/stream', (req: Request, res: Response) => {
  const chatId = req.query.chatId as string;
  if (!chatId) {
    return res.status(400).json({ code: 400, message: '缺少chatId参数' });
  }

  const session = chatContextCache.get(chatId);
  if (!session || session.messages.length === 0) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`event: start\ndata: ${JSON.stringify({ chatId })}\n\n`);
    res.write(`event: chunk\ndata: ${JSON.stringify({ text: '会话已过期，请重新发送' })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ chatId, fullText: '' })}\n\n`);
    return res.end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.flushHeaders();
  if (res.socket) res.socket.setNoDelay(true);

  res.write(`event: start\ndata: ${JSON.stringify({ chatId })}\n\n`);

  streamChatDirect(
    session.messages,
    (text) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    (fullText) => {
      session.messages.push({ role: 'assistant', content: fullText });
      session.lastActive = Date.now();
      if (session.userId) {
        saveChatToDb(session.userId, chatId, 'assistant', fullText);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ chatId, fullText })}\n\n`);
      res.end();
    }
  );
});

router.post('/chat/enhanced', async (req: Request, res: Response) => {
  try {
    const { message, chatId, fileIds, skillId, skillPrompt, fileContext } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ code: 400, message: '消息不能为空' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ code: 400, message: '消息内容过长' });
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userId = getUserIdFromToken(req);

    const usage = await checkUsageLimit(ip, userId);
    if (!usage.canUse) {
      return res.status(403).json({
        code: 403,
        message: '免费次数已用完，请登录后继续使用',
        data: { needLogin: true, remaining: 0 }
      });
    }

    const newChatId = chatId || (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));

    if (!chatContextCache.has(newChatId)) {
      chatContextCache.set(newChatId, {
        messages: [],
        lastActive: Date.now(),
        fileIds: fileIds || [],
        skillId: skillId || undefined,
        skillPrompt: skillPrompt || undefined,
        fileContext: fileContext || undefined
      });
    }

    const session = chatContextCache.get(newChatId)!;
    session.messages.push({ role: 'user', content: message });
    session.lastActive = Date.now();
    if (userId) session.userId = userId;
    // 更新文件和技能上下文
    if (fileIds) session.fileIds = fileIds;
    if (skillId) session.skillId = skillId;
    if (skillPrompt) session.skillPrompt = skillPrompt;
    if (fileContext) session.fileContext = fileContext;

    if (userId) {
      saveChatToDb(userId, newChatId, 'user', message);
    }

    setTimeout(() => {
      const existing = chatContextCache.get(newChatId);
      if (existing && Date.now() - existing.lastActive > 300000) {
        chatContextCache.delete(newChatId);
      }
    }, 300000);

    await recordUsage(ip, userId);
    const updatedUsage = await checkUsageLimit(ip, userId);
    res.json({
      code: 0,
      message: 'success',
      data: {
        chatId: newChatId,
        streamUrl: `/api/v1/chat/enhanced/stream?chatId=${newChatId}`,
        remaining: updatedUsage.remaining
      }
    });
  } catch (err) {
    console.error('增强聊天接口异常:', err);
    res.status(500).json({ code: 500, message: '增强聊天服务异常' });
  }
});

router.get('/chat/enhanced/stream', (req: Request, res: Response) => {
  const chatId = req.query.chatId as string;
  if (!chatId) {
    return res.status(400).json({ code: 400, message: '缺少chatId参数' });
  }

  const session = chatContextCache.get(chatId);
  if (!session || session.messages.length === 0) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`event: start\ndata: ${JSON.stringify({ chatId })}\n\n`);
    res.write(`event: chunk\ndata: ${JSON.stringify({ text: '会话已过期，请重新发送' })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ chatId, fullText: '' })}\n\n`);
    return res.end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.flushHeaders();
  if (res.socket) res.socket.setNoDelay(true);

  res.write(`event: start\ndata: ${JSON.stringify({ chatId })}\n\n`);

  streamChatEnhanced(
    session.messages,
    session.skillPrompt || null,
    session.fileContext || null,
    (text) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    (fullText) => {
      session.messages.push({ role: 'assistant', content: fullText });
      session.lastActive = Date.now();
      if (session.userId) {
        saveChatToDb(session.userId, chatId, 'assistant', fullText);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ chatId, fullText })}\n\n`);
      res.end();
    }
  );
});

router.get('/seo', async (_req: Request, res: Response) => {
  try {
    const settings = await adminService.getSettings();
    res.json({ code: 0, message: 'success', data: settings.seo || {} });
  } catch (err) {
    console.error('获取SEO配置失败:', err);
    res.json({ code: 0, message: 'success', data: {
      siteTitle: 'LeeQ AI Search',
      siteDescription: '基于AI的智能搜索服务',
      keywords: 'AI搜索,智能问答,RAG',
      homeTitle: '首页 - LeeQ AI Search',
      homeDescription: 'LeeQ AI Search - 基于AI的智能搜索服务',
      searchTitle: '搜索结果 - LeeQ AI Search',
      searchDescription: '智能搜索结果页面',
      copyright: '© 2026 LeeQ AI Search. All rights reserved.'
    }});
  }
});

export default router;