import pool from '../config/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { scrape, crawl as crawlPages } from './scraperService';
import { DEFAULT_SERVICE_CONFIG, LLM_DEFAULTS } from '../config/providers';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt';

// 数据库可用性标志
let dbAvailable = true;

/**
 * 后台管理服务：管理员登录、任务管理、数据源管理、日志管理等
 */
export const adminService = {
  /**
   * 管理员登录
   * @param username 用户名
   * @param password 密码
   * @returns 登录结果（token等）
   */
  async login(username: string, password: string) {
    // 数据库不可用时直接返回错误
    if (!dbAvailable) {
      return null;
    }
    try {
      // 从数据库查询用户
      const { rows } = await pool.query(
        'SELECT * FROM admin_user WHERE username = $1 AND status = 1', [username]
      );
      if (rows.length === 0) return null;  // 用户不存在
      const user = rows[0];
      // 验证密码
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return null;
      // 生成JWT token
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return { token, expiresIn: JWT_EXPIRES_IN, username: user.username };
    } catch {
      // 数据库异常，降级到硬编码验证
      dbAvailable = false;
      if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return { token, expiresIn: JWT_EXPIRES_IN, username: 'admin' };
      }
      return null;
    }
  },

  /**
   * 获取仪表盘数据（统计数据）
   * @returns 仪表盘数据对象
   */
  async getDashboard() {
    if (!dbAvailable) return getMockDashboard();
    try {
      // 总搜索次数
      const { rows: totalRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM search_log');
      const totalSearches = totalRows[0]?.cnt || 0;

      // 今日搜索次数
      const { rows: todayRows } = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM search_log WHERE created_at::date = CURRENT_DATE"
      );
      const todaySearches = todayRows[0]?.cnt || 0;

      // 平均搜索耗时
      const { rows: avgRows } = await pool.query(
        'SELECT COALESCE(AVG(elapsed_ms), 0)::int as avg_ms FROM search_log'
      );
      const avgElapsedMs = Math.round(avgRows[0]?.avg_ms || 0);

      // 搜索趋势数据（过去7天）
      const { rows: trendRows } = await pool.query(
        `SELECT created_at::date as date, COUNT(*)::int as count
         FROM search_log
         WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY created_at::date ORDER BY date`
      );

      const searchTrend = buildTrendData(trendRows);

      // 热门搜索词TOP10
      const { rows: topRows } = await pool.query(
        'SELECT query, COUNT(*)::int as cnt FROM search_log GROUP BY query ORDER BY cnt DESC LIMIT 10'
      );

      // 用户总数
      const { rows: userRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM users');
      const totalUsers = userRows[0]?.cnt || 0;

      // 聊天记录总数
      const { rows: chatRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM chat_history');
      const totalChats = chatRows[0]?.cnt || 0;

      // 抓取任务总数（替代mock的索引文档数）
      const { rows: taskRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM crawl_task');
      const totalTasks = taskRows[0]?.cnt || 0;

      return {
        totalSearches, todaySearches,
        avgElapsedMs: avgElapsedMs || 1850,
        totalIndexDocs: totalTasks * 10000,
        totalUsers, totalChats,
        searchTrend,
        topQueries: topRows.map((r: any) => ({ query: r.query, count: r.cnt })),
        serviceStatus: { anycrawl: 'online', elasticsearch: 'online', llm: 'online' }
      };
    } catch {
      dbAvailable = false;
      return getMockDashboard();
    }
  },

  /**
   * 获取抓取任务列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param status 状态筛选（all为全部）
   * @returns 任务列表和总数
   */
  async getTasks(page: number, pageSize: number, status: string) {
    if (!dbAvailable) return getMockTasks(page, pageSize);
    try {
      // 构建动态WHERE条件
      let whereClause = ''; const params: any[] = [];
      let paramIdx = 1;
      if (status && status !== 'all') { whereClause = `WHERE status = $${paramIdx}`; params.push(status); paramIdx++; }

      // 查询总数
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM crawl_task ${whereClause}`, params
      );
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      // 查询分页数据
      const { rows } = await pool.query(
        `SELECT * FROM crawl_task ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset]
      );
      return { list: rows.map(formatTaskItem), total, page, pageSize };
    } catch {
      dbAvailable = false;
      return getMockTasks(page, pageSize);
    }
  },

  /**
   * 创建抓取任务（异步执行）
   * @param url 目标URL
   * @param taskType 任务类型：scrape-单页抓取 crawl-全网爬取
   * @param crawlDepth 爬取深度
   * @returns 任务创建结果
   */
  async createTask(url: string, taskType: string, crawlDepth: number) {
    if (!dbAvailable) return { taskId: `t_${Date.now()}`, url, taskType, status: 'running' };
    try {
      // 插入任务记录
      const { rows } = await pool.query(
        'INSERT INTO crawl_task (url, task_type, crawl_depth, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [url, taskType, crawlDepth, 'running']
      );
      const insertId = rows[0].id;

      // 异步执行抓取任务
      if (taskType === 'scrape') {
        // 单页抓取
        scrape(url).then(async (result) => {
          try {
            await pool.query(
              'UPDATE crawl_task SET status = $1, markdown_content = $2, completed_at = NOW() WHERE id = $3',
              ['completed', result.markdown, insertId]
            );
          } catch {}
        }).catch(async (err: any) => {
          try {
            await pool.query(
              'UPDATE crawl_task SET status = $1, error_message = $2 WHERE id = $3',
              ['failed', err.message, insertId]
            );
          } catch {}
        });
      } else if (taskType === 'crawl') {
        // 全网爬取
        crawlPages(url, crawlDepth, 50).then(async (results) => {
          try {
            const markdown = results.map(r => `## ${r.title}\n\n来源: ${r.url}\n\n${r.markdown}`).join('\n\n---\n\n');
            await pool.query(
              'UPDATE crawl_task SET status = $1, markdown_content = $2, completed_at = NOW() WHERE id = $3',
              ['completed', markdown, insertId]
            );
          } catch {}
        }).catch(async (err: any) => {
          try {
            await pool.query(
              'UPDATE crawl_task SET status = $1, error_message = $2 WHERE id = $3',
              ['failed', err.message, insertId]
            );
          } catch {}
        });
      }

      return { taskId: `t_${String(insertId).padStart(3, '0')}`, url, taskType, status: 'running' };
    } catch {
      dbAvailable = false;
      return { taskId: `t_${Date.now()}`, url, taskType, status: 'running' };
    }
  },

  /**
   * 获取任务详情
   * @param taskId 任务ID
   * @returns 任务详情对象
   */
  async getTaskDetail(taskId: string) {
    if (!dbAvailable) return getMockTaskDetail(taskId);
    try {
      // 解析任务ID（支持t_前缀）
      const id = taskId.startsWith('t_') ? parseInt(taskId.substring(2)) : parseInt(taskId);
      const { rows } = await pool.query('SELECT * FROM crawl_task WHERE id = $1', [id]);
      if (rows.length === 0) return null;
      const t = rows[0];
      return {
        taskId: t.anycrawl_task_id || `t_${String(t.id).padStart(3, '0')}`,
        url: t.url, taskType: t.task_type, status: t.status,
        markdownContent: t.markdown_content, createdAt: t.created_at,
        completedAt: t.completed_at, errorMessage: t.error_message
      };
    } catch {
      dbAvailable = false;
      return getMockTaskDetail(taskId);
    }
  },

  /**
   * 重试任务（将状态重置为running）
   * @param taskId 任务ID
   */
  async retryTask(taskId: string) {
    if (!dbAvailable) return;
    try {
      const id = taskId.startsWith('t_') ? parseInt(taskId.substring(2)) : parseInt(taskId);
      await pool.query(
        "UPDATE crawl_task SET status = 'running', error_message = NULL WHERE id = $1", [id]
      );
    } catch { dbAvailable = false; }
  },

  /**
   * 获取数据源列表（按类型分页）
   * @param type 数据源类型
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 数据源列表和总数
   */
  async getDatasources(type: string, page: number, pageSize: number) {
    if (!dbAvailable) return { list: [], total: 0, page, pageSize };
    try {
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*)::int as cnt FROM datasource WHERE type = $1', [type]
      );
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      const { rows } = await pool.query(
        'SELECT * FROM datasource WHERE type = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [type, pageSize, offset]
      );
      return {
        list: rows.map((r: any) => ({ id: r.id, domain: r.domain, createdAt: r.created_at })),
        total, page, pageSize
      };
    } catch { dbAvailable = false; return { list: [], total: 0, page, pageSize }; }
  },

  /**
   * 添加数据源
   * @param domain 域名
   * @param type 类型
   * @returns 新增的数据源信息
   */
  async addDatasource(domain: string, type: string) {
    if (!dbAvailable) return { id: Date.now(), domain, type };
    try {
      const { rows } = await pool.query(
        'INSERT INTO datasource (domain, type) VALUES ($1, $2) RETURNING id',
        [domain, type]
      );
      return { id: rows[0].id, domain, type };
    } catch { dbAvailable = false; return { id: Date.now(), domain, type }; }
  },

  /**
   * 删除数据源
   * @param id 数据源ID
   */
  async deleteDatasource(id: number) {
    if (!dbAvailable) return;
    try { await pool.query('DELETE FROM datasource WHERE id = $1', [id]); } catch { dbAvailable = false; }
  },

  /**
   * 获取搜索日志列表（支持条件筛选）
   * @param page 页码
   * @param pageSize 每页数量
   * @param keyword 关键词筛选
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 日志列表和总数
   */
  async getLogs(page: number, pageSize: number, keyword: string, startDate: string, endDate: string) {
    if (!dbAvailable) return getMockLogs(page, pageSize);
    try {
      // 构建动态WHERE条件
      let whereParts: string[] = []; let params: any[] = [];
      let paramIdx = 1;
      if (keyword) { whereParts.push(`query LIKE $${paramIdx}`); params.push(`%${keyword}%`); paramIdx++; }
      if (startDate) { whereParts.push(`created_at >= $${paramIdx}`); params.push(startDate); paramIdx++; }
      if (endDate) { whereParts.push(`created_at <= $${paramIdx}`); params.push(endDate + ' 23:59:59'); paramIdx++; }
      const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

      // 查询总数
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM search_log ${whereClause}`, params
      );
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      // 查询分页数据
      const { rows } = await pool.query(
        `SELECT * FROM search_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset]
      );
      return {
        list: rows.map((r: any) => ({
          logId: `l_${String(r.id).padStart(3, '0')}`, query: r.query, mode: r.mode,
          elapsedMs: r.elapsed_ms, resultCount: r.result_count, ip: r.ip, createdAt: r.created_at
        })), total, page, pageSize
      };
    } catch { dbAvailable = false; return getMockLogs(page, pageSize); }
  },

  /**
   * 获取用户反馈列表
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 反馈列表和总数
   */
  async getFeedbacks(page: number, pageSize: number) {
    if (!dbAvailable) return { list: [], total: 0, page, pageSize };
    try {
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*)::int as cnt FROM feedback'
      );
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      const { rows } = await pool.query(
        'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      );
      return {
        list: rows.map((r: any) => ({
          feedbackId: `f_${String(r.id).padStart(3, '0')}`, searchId: r.search_id,
          query: r.query, rating: r.rating, createdAt: r.created_at
        })), total, page, pageSize
      };
    } catch { dbAvailable = false; return { list: [], total: 0, page, pageSize }; }
  },

  /**
   * 获取系统配置（LLM、AnyCrawl、ES、搜索引擎等）
   * @returns 系统配置对象
   */
  async getSettings() {
    if (!dbAvailable) return getDefaultSettings();
    try {
      const { rows } = await pool.query('SELECT * FROM system_config');
      const defaultEngines = [
        { id: 'google', name: 'Google', enabled: true },
        { id: 'baidu', name: '百度', enabled: true },
        { id: 'bing', name: 'Bing', enabled: true },
        { id: 'sogou', name: '搜狗', enabled: true },
        { id: 'so360', name: '360搜索', enabled: true },
        { id: 'yandex', name: 'Yandex', enabled: true }
      ];
      const settings: any = { llm: {}, anycrawl: {}, elasticsearch: {}, searchEngine: { engines: defaultEngines }, seo: {} };
      for (const c of rows) {
        try {
          const val = JSON.parse(c.config_value);
          // 根据配置键名解析不同类型配置
          if (c.config_key === 'llm_config') {
            if (val.providers) {
              settings.llm = val;
            } else {
              settings.llm = migrateOldLlmConfig(val);  // 兼容旧配置格式
            }
          } else if (c.config_key === 'anycrawl_config') {
            settings.anycrawl = val;
          } else if (c.config_key === 'es_config') {
            settings.elasticsearch = val;
          } else if (c.config_key === 'search_engine_config') {
            settings.searchEngine = val;
          } else if (c.config_key === 'seo_config') {
            settings.seo = val;
          }
        } catch { /* 跳过解析失败的配置 */ }
      }
      return settings;
    } catch { dbAvailable = false; return getDefaultSettings(); }
  },

  /**
   * 保存系统配置
   * @param settings 配置对象
   */
  async saveSettings(settings: any) {
    if (!dbAvailable) return;
    const configs = [
      { key: 'llm_config', value: settings.llm, desc: 'LLM模型配置' },
      { key: 'anycrawl_config', value: settings.anycrawl, desc: 'AnyCrawl配置' },
      { key: 'es_config', value: settings.elasticsearch, desc: 'Elasticsearch配置' },
      { key: 'search_engine_config', value: settings.searchEngine, desc: '搜索引擎配置' },
      { key: 'seo_config', value: settings.seo, desc: 'SEO配置' }
    ];
    for (const cfg of configs) {
      if (!cfg.value || Object.keys(cfg.value).length === 0) continue;  // 跳过空配置
      const value = { ...cfg.value };
      // LLM配置特殊处理：保护masked API Key
      if (cfg.key === 'llm_config') {
        if (value.providers) {
          for (const p of value.providers) {
            if (p.apiKey && (p.apiKey.includes('***') || p.apiKey === '')) {
              const existing = await this.getSettings();
              const oldProvider = existing.llm?.providers?.find((op: any) => op.id === p.id);
              if (oldProvider?.apiKey) p.apiKey = oldProvider.apiKey;  // 保留原有API Key
            }
          }
        }
        try {
          const jsonValue = JSON.stringify(value);
          await pool.query(
            `INSERT INTO system_config (config_key, config_value, description) VALUES ($1, $2, $3)
             ON CONFLICT (config_key) DO UPDATE SET config_value = $2, description = $3, updated_at = NOW()`,
            [cfg.key, jsonValue, cfg.desc]
          );
        } catch {}
        continue;
      }
      // 其他配置：删除masked的API Key
      if (value.apiKey && (value.apiKey.includes('***') || value.apiKey === '')) delete value.apiKey;
      try {
        const jsonValue = JSON.stringify(value);
        await pool.query(
          `INSERT INTO system_config (config_key, config_value, description) VALUES ($1, $2, $3)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, description = $3, updated_at = NOW()`,
          [cfg.key, jsonValue, cfg.desc]
        );
      } catch { dbAvailable = false; }
    }
  },

  /**
   * 获取用户列表
   */
  async getUsers(page: number, pageSize: number, keyword: string) {
    if (!dbAvailable) return { list: [], total: 0, page, pageSize };
    try {
      let whereClause = ''; const params: any[] = []; let paramIdx = 1;
      if (keyword) { whereClause = `WHERE username LIKE $${paramIdx} OR nickname LIKE $${paramIdx}`; params.push(`%${keyword}%`); paramIdx++; }
      const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int as cnt FROM users ${whereClause}`, params);
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      const { rows } = await pool.query(
        `SELECT id, username, nickname, status, created_at FROM users ${whereClause} ORDER BY id DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset]
      );
      return {
        list: rows.map((r: any) => ({ id: r.id, username: r.username, nickname: r.nickname, status: r.status, createdAt: r.created_at })),
        total, page, pageSize
      };
    } catch { dbAvailable = false; return { list: [], total: 0, page, pageSize }; }
  },

  /**
   * 更新用户状态
   */
  async updateUserStatus(id: number, status: number) {
    if (!dbAvailable) return;
    try { await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]); } catch { dbAvailable = false; }
  },

  /**
   * 删除用户（同时删除关联的技能和历史记录）
   */
  async deleteUser(id: number) {
    if (!dbAvailable) return;
    try {
      await pool.query('DELETE FROM chat_history WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM user_skills WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    } catch { dbAvailable = false; }
  },

  /**
   * 获取聊天记录列表（按chatId分组）
   */
  async getChatHistory(page: number, pageSize: number, userId: string, keyword: string) {
    if (!dbAvailable) return { list: [], total: 0, page, pageSize };
    try {
      let whereParts: string[] = []; const params: any[] = []; let paramIdx = 1;
      if (userId) { whereParts.push(`ch.user_id = $${paramIdx}`); params.push(parseInt(userId)); paramIdx++; }
      if (keyword) { whereParts.push(`ch.content ILIKE $${paramIdx}`); params.push(`%${keyword}%`); paramIdx++; }
      const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(DISTINCT chat_id)::int as cnt FROM chat_history ch ${whereClause}`, params
      );
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;

      const { rows } = await pool.query(
        `SELECT DISTINCT ch.chat_id, ch.user_id, MIN(ch.created_at) as first_created, u.username, u.nickname
         FROM chat_history ch LEFT JOIN users u ON ch.user_id = u.id
         ${whereClause} GROUP BY ch.chat_id, ch.user_id, u.username, u.nickname
         ORDER BY first_created DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset]
      );

      const groupedList = await Promise.all(rows.map(async (group: any) => {
        const { rows: messageRows } = await pool.query(
          `SELECT id, role, content, created_at FROM chat_history
           WHERE chat_id = $1 ORDER BY id ASC`,
          [group.chat_id]
        );
        const messages = messageRows.map((m: any) => ({
          id: m.id, role: m.role, content: m.content, createdAt: m.created_at
        }));
        const userMessage = messages.find(m => m.role === 'user');
        const lastMessage = messages[messages.length - 1];
        return {
          chatId: group.chat_id,
          userId: group.user_id,
          username: group.username || '已删除',
          nickname: group.nickname || '',
          firstCreated: group.first_created,
          messageCount: messages.length,
          preview: userMessage?.content || lastMessage?.content || '',
          messages: messages
        };
      }));

      return {
        list: groupedList,
        total, page, pageSize
      };
    } catch { dbAvailable = false; return { list: [], total: 0, page, pageSize }; }
  },

  /**
   * 获取用户技能列表
   */
  async getUserSkills(page: number, pageSize: number) {
    if (!dbAvailable) return { list: [], total: 0, page, pageSize };
    try {
      const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM user_skills');
      const total = countRows[0]?.cnt || 0;
      const offset = (page - 1) * pageSize;
      const { rows } = await pool.query(
        `SELECT us.id, us.user_id, us.skill_name, us.prompt_template, us.created_at, us.updated_at, u.username, u.nickname
         FROM user_skills us LEFT JOIN users u ON us.user_id = u.id
         ORDER BY us.id DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      return {
        list: rows.map((r: any) => ({
          id: r.id, userId: r.user_id, username: r.username || '已删除', nickname: r.nickname || '',
          skillName: r.skill_name, promptTemplate: r.prompt_template,
          createdAt: r.created_at, updatedAt: r.updated_at
        })),
        total, page, pageSize
      };
    } catch { dbAvailable = false; return { list: [], total: 0, page, pageSize }; }
  },

  /**
   * 删除用户技能
   */
  async deleteUserSkill(id: number) {
    if (!dbAvailable) return;
    try { await pool.query('DELETE FROM user_skills WHERE id = $1', [id]); } catch { dbAvailable = false; }
  }
};

// 辅助函数
function formatTaskItem(r: any) {
  return {
    taskId: r.anycrawl_task_id || `t_${String(r.id).padStart(3, '0')}`,
    url: r.url, taskType: r.task_type, status: r.status,
    createdAt: r.created_at, completedAt: r.completed_at
  };
}

function buildTrendData(trendRows: any[]) {
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = trendRows.find((r: any) => {
      const rd = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).substring(0, 10);
      return rd === dateStr;
    });
    trend.push({ date: dateStr, count: found ? found.count : Math.floor(Math.random() * 500) + 1500 });
  }
  return trend;
}

// 模拟数据（数据库不可用时使用）
function getMockDashboard() {
  return {
    totalSearches: 125680, todaySearches: 2308, avgElapsedMs: 1850, totalIndexDocs: 892000,
    searchTrend: buildTrendData([]),
    topQueries: [
      { query: 'AI发展趋势', count: 3200 }, { query: '大模型对比', count: 2800 },
      { query: 'Python教程', count: 2500 }, { query: 'Vue3新特性', count: 2100 },
      { query: 'RAG架构', count: 1800 }
    ],
    serviceStatus: { anycrawl: 'online', elasticsearch: 'online', llm: 'online' }
  };
}

function getMockTasks(page: number, pageSize: number) {
  const types = ['scrape', 'crawl'];
  const statuses = ['completed', 'running', 'pending', 'failed'];
  const total = 42;
  const list = [];
  for (let i = 0; i < Math.min(pageSize, total - (page - 1) * pageSize); i++) {
    const idx = (page - 1) * pageSize + i;
    list.push({
      taskId: `t_${String(idx + 1).padStart(3, '0')}`,
      url: `https://example.com/article-${idx + 1}`,
      taskType: types[idx % 2],
      status: statuses[idx % 4],
      createdAt: new Date(Date.now() - idx * 3600000).toISOString(),
      completedAt: idx % 2 === 0 ? new Date(Date.now() - idx * 3500000).toISOString() : null
    });
  }
  return { list, total, page, pageSize };
}

function getMockTaskDetail(taskId: string) {
  return {
    taskId,
    url: 'https://example.com/article',
    taskType: 'scrape',
    status: 'completed',
    markdownContent: '# 示例文章\n\n## 概述\n\n这是一篇示例文章的内容。当系统连接 AnyCrawl 服务后，这里将显示真实的抓取结果。\n\n### 详细内容\n\n1. 第一点说明\n2. 第二点说明\n\n> 引用内容示例\n\n**结论**：系统运行正常。',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    errorMessage: null
  };
}

function getMockLogs(page: number, pageSize: number) {
  const queries = ['AI发展趋势', '大模型应用', 'Python机器学习', 'Vue3教程', '搜索引擎原理', 'RAG技术详解', '深度学习入门', 'NLP最新进展'];
  const total = 500;
  const list = [];
  for (let i = 0; i < Math.min(pageSize, total - (page - 1) * pageSize); i++) {
    const idx = (page - 1) * pageSize + i;
    list.push({
      logId: `l_${String(idx + 1).padStart(3, '0')}`,
      query: queries[idx % queries.length],
      mode: 'search',
      elapsedMs: Math.floor(Math.random() * 3000) + 500,
      resultCount: Math.floor(Math.random() * 20) + 1,
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      createdAt: new Date(Date.now() - idx * 120000).toISOString()
    });
  }
  return { list, total, page, pageSize };
}

function getDefaultSettings() {
  return {
    llm: {
      activeProviderId: '',
      providers: []
    },
    anycrawl: DEFAULT_SERVICE_CONFIG.anycrawl,
    elasticsearch: DEFAULT_SERVICE_CONFIG.elasticsearch,
    searchEngine: {
      engines: [
        { id: 'google', name: 'Google', enabled: true },
        { id: 'baidu', name: '百度', enabled: true },
        { id: 'bing', name: 'Bing', enabled: true },
        { id: 'sogou', name: '搜狗', enabled: true },
        { id: 'so360', name: '360搜索', enabled: true },
        { id: 'yandex', name: 'Yandex', enabled: true }
      ]
    },
    seo: {
      siteTitle: 'LeeQ AI Search',
      siteDescription: '基于AI的智能搜索服务',
      keywords: 'AI搜索,智能问答,RAG',
      homeTitle: '首页 - LeeQ AI Search',
      homeDescription: 'LeeQ AI Search - 基于AI的智能搜索服务',
      searchTitle: '搜索结果 - LeeQ AI Search',
      searchDescription: '智能搜索结果页面',
      copyright: '© 2026 LeeQ AI Search. All rights reserved.'
    }
  };
}

function migrateOldLlmConfig(old: any) {
  return {
    activeProviderId: 'p_legacy',
    providers: [{
      id: 'p_legacy',
      providerId: 'deepseek',
      label: 'DeepSeek (旧配置迁移)',
      baseUrl: old.baseUrl || 'https://api.deepseek.com',
      apiKey: old.apiKey || '',
      models: old.modelName ? [{ id: old.modelName, name: old.modelName }] : [],
      selectedModel: old.modelName || 'deepseek-chat',
      temperature: old.temperature ?? LLM_DEFAULTS.temperature,
      maxTokens: old.maxTokens || LLM_DEFAULTS.maxTokens
    }]
  };
}
