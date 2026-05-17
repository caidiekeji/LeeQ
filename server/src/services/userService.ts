import { query, queryOne } from '../config/database';
import bcrypt from 'bcryptjs';

// 用户注册
export async function registerUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  const existingUser = await queryOne(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [data.username, data.email]
  );

  if (existingUser) {
    throw new Error('用户名或邮箱已被注册');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await queryOne(
    `INSERT INTO users (username, email, password_hash, nickname, role, status)
     VALUES ($1, $2, $3, $4, 'user', 'active')
     RETURNING id, username, email, nickname, avatar, role, status, created_at`,
    [data.username, data.email, hashedPassword, data.nickname || data.username]
  );

  return user;
}

// 用户登录
export async function loginUser(username: string, password: string) {
  const user = await queryOne<{
    id: number;
    username: string;
    email: string;
    nickname: string;
    avatar: string;
    password_hash: string;
    role: string;
    status: string;
  }>('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);

  if (!user) {
    throw new Error('用户不存在');
  }

  if (user.status === 'deleted' || user.status === 'disabled') {
    throw new Error('账号已被禁用或删除');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error('密码错误');
  }

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role
  };
}

// 获取用户信息
export async function getUserProfile(userId: number) {
  const user = await queryOne(
    `SELECT id, username, email, nickname, avatar, role, status, last_login, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!user) return null;

  const searchCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM search_history WHERE user_id = $1',
    [userId]
  );

  const convCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM conversations WHERE user_id = $1',
    [userId]
  );

  return {
    ...user,
    searchCount: parseInt(searchCount?.count || '0'),
    conversationCount: parseInt(convCount?.count || '0')
  };
}

// 更新用户资料
export async function updateProfile(userId: number, data: {
  nickname?: string;
  avatar?: string;
  email?: string;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.nickname !== undefined) {
    updates.push(`nickname = $${paramIndex++}`);
    values.push(data.nickname);
  }
  if (data.avatar !== undefined) {
    updates.push(`avatar = $${paramIndex++}`);
    values.push(data.avatar);
  }
  if (data.email !== undefined) {
    const existing = await queryOne('SELECT id FROM users WHERE email = $1 AND id != $2', [data.email, userId]);
    if (existing) throw new Error('邮箱已被使用');
    updates.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await queryOne(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, email, nickname, avatar, role, status`,
    values
  );
  return result;
}

// 修改密码
export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await queryOne<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (!user) throw new Error('用户不存在');

  const isValid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isValid) throw new Error('原密码错误');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);
}

// 获取用户搜索历史
export async function getUserSearchHistory(userId: number, params: {
  page?: number;
  pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const totalResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM search_history WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(totalResult?.count || '0');

  const list = await query(
    `SELECT id, query, source, results_count, created_at
     FROM search_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );

  return { list, total, page, pageSize };
}

// 获取用户对话列表
export async function getUserConversations(userId: number, params: {
  page?: number;
  pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const totalResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM conversations WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(totalResult?.count || '0');

  const list = await query(
    `SELECT id, title, model, message_count, created_at, updated_at
     FROM conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );

  return { list, total, page, pageSize };
}