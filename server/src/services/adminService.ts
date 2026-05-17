import { query, queryOne } from '../config/database';
import bcrypt from 'bcryptjs';

// 仪表盘统计数据接口
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSearches: number;
  todaySearches: number;
  totalConversations: number;
  todayConversations: number;
  totalDocuments: number;
  totalSkills: number;
}

// 用户增长趋势接口
export interface UserGrowth {
  date: string;
  count: number;
}

// 搜索趋势接口
export interface SearchTrend {
  date: string;
  count: number;
}

// 热门搜索词接口
export interface HotSearch {
  query: string;
  count: number;
}

// 用户分布接口
export interface UserDistribution {
  role: string;
  count: number;
}

// 系统配置接口
export interface SystemSettings {
  siteName: string;
  siteDescription: string;
  allowRegistration: boolean;
  maxDailySearches: number;
  maxResultsPerSearch: number;
  searchTimeout: number;
  enableCache: boolean;
  cacheTTL: number;
  enableMultiProvider: boolean;
  defaultProvider: string;
  logLevel: string;
}

// 默认系统配置
const defaultSettings: SystemSettings = {
  siteName: 'AI智能搜索引擎',
  siteDescription: '新一代AI智能搜索体验',
  allowRegistration: true,
  maxDailySearches: 100,
  maxResultsPerSearch: 20,
  searchTimeout: 30000,
  enableCache: true,
  cacheTTL: 3600,
  enableMultiProvider: false,
  defaultProvider: 'google',
  logLevel: 'info'
};

// 获取仪表盘统计数据
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    totalUsers,
    activeUsers,
    totalSearches,
    todaySearches,
    totalConversations,
    todayConversations,
    totalDocuments,
    totalSkills
  ] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM users'),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE status = 'active'"),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM search_history'),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM search_history WHERE created_at >= $1', [todayStart]),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM conversations'),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM conversations WHERE created_at >= $1', [todayStart]),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM documents'),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM skills')
  ]);

  return {
    totalUsers: parseInt(totalUsers?.count || '0'),
    activeUsers: parseInt(activeUsers?.count || '0'),
    totalSearches: parseInt(totalSearches?.count || '0'),
    todaySearches: parseInt(todaySearches?.count || '0'),
    totalConversations: parseInt(totalConversations?.count || '0'),
    todayConversations: parseInt(todayConversations?.count || '0'),
    totalDocuments: parseInt(totalDocuments?.count || '0'),
    totalSkills: parseInt(totalSkills?.count || '0')
  };
}

// 获取用户增长趋势（最近30天）
export async function getUserGrowth(days: number = 30): Promise<UserGrowth[]> {
  const result = await query<{ date: string; count: string }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count 
     FROM users 
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) 
     ORDER BY date ASC`
  );
  return result.map(row => ({
    date: row.date,
    count: parseInt(row.count)
  }));
}

// 获取搜索趋势（最近30天）
export async function getSearchTrend(days: number = 30): Promise<SearchTrend[]> {
  const result = await query<{ date: string; count: string }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count 
     FROM search_history 
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) 
     ORDER BY date ASC`
  );
  return result.map(row => ({
    date: row.date,
    count: parseInt(row.count)
  }));
}

// 获取热门搜索词
export async function getHotSearches(limit: number = 20): Promise<HotSearch[]> {
  const result = await query<{ query: string; count: string }>(
    `SELECT query, COUNT(*) as count 
     FROM search_history 
     GROUP BY query 
     ORDER BY count DESC 
     LIMIT $1`,
    [limit]
  );
  return result.map(row => ({
    query: row.query,
    count: parseInt(row.count)
  }));
}

// 获取用户分布
export async function getUserDistribution(): Promise<UserDistribution[]> {
  const result = await query<{ role: string; count: string }>(
    `SELECT role, COUNT(*) as count 
     FROM users 
     GROUP BY role 
     ORDER BY count DESC`
  );
  return result.map(row => ({
    role: row.role,
    count: parseInt(row.count)
  }));
}

// 获取用户列表
export async function getUserList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    whereConditions.push(`(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.nickname ILIKE $${paramIndex})`);
    whereParams.push(`%${params.keyword}%`);
    paramIndex++;
  }

  if (params.role) {
    whereConditions.push(`u.role = $${paramIndex}`);
    whereParams.push(params.role);
    paramIndex++;
  }

  if (params.status) {
    whereConditions.push(`u.status = $${paramIndex}`);
    whereParams.push(params.status);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  // 排序
  const sortField = params.sortBy === 'username' ? 'u.username' : 
                    params.sortBy === 'email' ? 'u.email' : 
                    params.sortBy === 'role' ? 'u.role' : 
                    params.sortBy === 'status' ? 'u.status' : 'u.created_at';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM users u ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT u.id, u.username, u.email, u.nickname, u.avatar, u.role, u.status, u.last_login, u.created_at
     FROM users u ${whereClause}
     ORDER BY ${sortField} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 获取用户详情
export async function getUserDetail(userId: number) {
  const user = await queryOne(
    `SELECT id, username, email, nickname, avatar, role, status, last_login, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!user) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [searchCount, todaySearchCount, convCount] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM search_history WHERE user_id = $1', [userId]),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM search_history WHERE user_id = $1 AND created_at >= $2', [userId, todayStart.toISOString()]),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM conversations WHERE user_id = $1', [userId])
  ]);

  return {
    ...user,
    stats: {
      totalSearches: parseInt(searchCount?.count || '0'),
      todaySearches: parseInt(todaySearchCount?.count || '0'),
      totalConversations: parseInt(convCount?.count || '0')
    }
  };
}

// 更新用户信息
export async function updateUser(userId: number, data: {
  username?: string;
  email?: string;
  nickname?: string;
  role?: string;
  status?: string;
  password?: string;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.username !== undefined) {
    updates.push(`username = $${paramIndex++}`);
    values.push(data.username);
  }
  if (data.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }
  if (data.nickname !== undefined) {
    updates.push(`nickname = $${paramIndex++}`);
    values.push(data.nickname);
  }
  if (data.role !== undefined) {
    updates.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.password) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    updates.push(`password_hash = $${paramIndex++}`);
    values.push(hashedPassword);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await queryOne(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, email, nickname, role, status, updated_at`,
    values
  );

  return result;
}

// 创建用户
export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
  role?: string;
  status?: string;
}) {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const result = await queryOne(
    `INSERT INTO users (username, email, password_hash, nickname, role, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, email, nickname, role, status, created_at`,
    [data.username, data.email, hashedPassword, data.nickname || data.username, data.role || 'user', data.status || 'active']
  );

  return result;
}

// 删除用户（软删除）
export async function deleteUser(userId: number) {
  const result = await queryOne(
    `UPDATE users SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'deleted' RETURNING id`,
    [userId]
  );
  return result;
}

// 批量删除用户
export async function batchDeleteUsers(userIds: number[]) {
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `UPDATE users SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id IN (${placeholders}) AND status != 'deleted' RETURNING id`,
    userIds
  );
  return result;
}

// 获取搜索历史列表
export async function getSearchHistoryList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    whereConditions.push(`sh.query ILIKE $${paramIndex}`);
    whereParams.push(`%${params.keyword}%`);
    paramIndex++;
  }

  if (params.userId) {
    whereConditions.push(`sh.user_id = $${paramIndex}`);
    whereParams.push(params.userId);
    paramIndex++;
  }

  if (params.dateFrom) {
    whereConditions.push(`sh.created_at >= $${paramIndex}`);
    whereParams.push(params.dateFrom);
    paramIndex++;
  }

  if (params.dateTo) {
    whereConditions.push(`sh.created_at <= $${paramIndex}`);
    whereParams.push(params.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM search_history sh ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT sh.id, sh.user_id, sh.query, sh.source, sh.results_count, sh.created_at,
            u.username, u.nickname
     FROM search_history sh
     LEFT JOIN users u ON sh.user_id = u.id
     ${whereClause}
     ORDER BY sh.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 清空搜索历史
export async function clearSearchHistory() {
  await query('DELETE FROM search_history');
}

// 获取对话列表
export async function getConversationList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    whereConditions.push(`c.title ILIKE $${paramIndex}`);
    whereParams.push(`%${params.keyword}%`);
    paramIndex++;
  }

  if (params.userId) {
    whereConditions.push(`c.user_id = $${paramIndex}`);
    whereParams.push(params.userId);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM conversations c ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT c.id, c.user_id, c.title, c.model, c.message_count, c.created_at, c.updated_at,
            u.username, u.nickname
     FROM conversations c
     LEFT JOIN users u ON c.user_id = u.id
     ${whereClause}
     ORDER BY c.updated_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 获取对话详情
export async function getConversationDetail(conversationId: number) {
  const conversation = await queryOne(
    `SELECT c.*, u.username, u.nickname
     FROM conversations c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (!conversation) return null;

  const messages = await query(
    `SELECT id, role, content, model, tokens, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  return { ...conversation, messages };
}

// 删除对话
export async function deleteConversation(conversationId: number) {
  await query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
  const result = await queryOne('DELETE FROM conversations WHERE id = $1 RETURNING id', [conversationId]);
  return result;
}

// 获取文档列表
export async function getDocumentList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: number;
  status?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    whereConditions.push(`(d.title ILIKE $${paramIndex} OR d.content ILIKE $${paramIndex})`);
    whereParams.push(`%${params.keyword}%`);
    paramIndex++;
  }

  if (params.userId) {
    whereConditions.push(`d.user_id = $${paramIndex}`);
    whereParams.push(params.userId);
    paramIndex++;
  }

  if (params.status) {
    whereConditions.push(`d.status = $${paramIndex}`);
    whereParams.push(params.status);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM documents d ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT d.id, d.user_id, d.title, d.source_url, d.file_type, d.file_size, d.status, d.created_at,
            u.username, u.nickname
     FROM documents d
     LEFT JOIN users u ON d.user_id = u.id
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 删除文档
export async function deleteDocument(documentId: number) {
  const result = await queryOne('DELETE FROM documents WHERE id = $1 RETURNING id', [documentId]);
  return result;
}

// 批量删除文档
export async function batchDeleteDocuments(documentIds: number[]) {
  const placeholders = documentIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `DELETE FROM documents WHERE id IN (${placeholders}) RETURNING id`,
    documentIds
  );
  return result;
}

// 获取技能列表
export async function getSkillList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
  status?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    whereConditions.push(`(s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
    whereParams.push(`%${params.keyword}%`);
    paramIndex++;
  }

  if (params.category) {
    whereConditions.push(`s.category = $${paramIndex}`);
    whereParams.push(params.category);
    paramIndex++;
  }

  if (params.status) {
    whereConditions.push(`s.status = $${paramIndex}`);
    whereParams.push(params.status);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM skills s ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT s.id, s.name, s.description, s.category, s.icon, s.prompt_template, s.status, s.sort_order, s.created_at
     FROM skills s
     ${whereClause}
     ORDER BY s.sort_order ASC, s.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 创建技能
export async function createSkill(data: {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  promptTemplate?: string;
  status?: string;
  sortOrder?: number;
}) {
  const result = await queryOne(
    `INSERT INTO skills (name, description, category, icon, prompt_template, status, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.name, data.description || '', data.category || 'general', data.icon || '', data.promptTemplate || '', data.status || 'active', data.sortOrder || 0]
  );
  return result;
}

// 更新技能
export async function updateSkill(skillId: number, data: {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  promptTemplate?: string;
  status?: string;
  sortOrder?: number;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(data.name); }
  if (data.description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(data.description); }
  if (data.category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(data.category); }
  if (data.icon !== undefined) { updates.push(`icon = $${paramIndex++}`); values.push(data.icon); }
  if (data.promptTemplate !== undefined) { updates.push(`prompt_template = $${paramIndex++}`); values.push(data.promptTemplate); }
  if (data.status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(data.status); }
  if (data.sortOrder !== undefined) { updates.push(`sort_order = $${paramIndex++}`); values.push(data.sortOrder); }

  if (updates.length === 0) return null;

  updates.push(`updated_at = NOW()`);
  values.push(skillId);

  const result = await queryOne(
    `UPDATE skills SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result;
}

// 删除技能
export async function deleteSkill(skillId: number) {
  const result = await queryOne('DELETE FROM skills WHERE id = $1 RETURNING id', [skillId]);
  return result;
}

// 批量删除技能
export async function batchDeleteSkills(skillIds: number[]) {
  const placeholders = skillIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `DELETE FROM skills WHERE id IN (${placeholders}) RETURNING id`,
    skillIds
  );
  return result;
}

// 获取系统配置
export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await query<{ key: string; value: string }>('SELECT key, value FROM system_settings');

  const config: any = { ...defaultSettings };

  for (const row of settings) {
    const key = row.key as keyof SystemSettings;
    if (key in config) {
      if (typeof config[key] === 'boolean') {
        config[key] = row.value === 'true' || row.value === '1';
      } else if (typeof config[key] === 'number') {
        config[key] = Number(row.value);
      } else {
        config[key] = row.value;
      }
    }
  }

  return config as SystemSettings;
}

// 更新系统配置
export async function updateSystemSettings(settings: Partial<SystemSettings>) {
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;

    const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);

    await query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, stringValue]
    );
  }

  return getSystemSettings();
}

// 获取系统日志
export async function getSystemLogs(params: {
  page?: number;
  pageSize?: number;
  level?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const offset = (page - 1) * pageSize;

  let whereConditions: string[] = [];
  let whereParams: any[] = [];
  let paramIndex = 1;

  if (params.level) {
    whereConditions.push(`level = $${paramIndex}`);
    whereParams.push(params.level);
    paramIndex++;
  }

  if (params.dateFrom) {
    whereConditions.push(`created_at >= $${paramIndex}`);
    whereParams.push(params.dateFrom);
    paramIndex++;
  }

  if (params.dateTo) {
    whereConditions.push(`created_at <= $${paramIndex}`);
    whereParams.push(params.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM system_logs ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT id, level, module, message, user_id, ip, created_at
     FROM system_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...whereParams, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 获取备份列表
export async function getBackupList(params: {
  page?: number;
  pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM backups');
  const total = parseInt(countResult?.count || '0');

  const list = await query(
    `SELECT * FROM backups ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  return { list, total, page, pageSize };
}