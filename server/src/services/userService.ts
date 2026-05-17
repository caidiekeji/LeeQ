import pool from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

/** JWT签名密钥：优先使用环境变量，否则使用默认值 */
const JWT_SECRET = process.env.JWT_SECRET || 'ai-search-jwt-secret-key-2026';

/** 头像上传目录 */
const AVATAR_DIR = path.join(__dirname, '../../uploads/avatars');

/**
 * 用户服务：注册、登录、用户技能管理、聊天历史管理
 */
export const userService = {
  /**
   * 用户注册
   * @param username 用户名（3-32位）
   * @param password 密码（至少6位）
   * @param nickname 昵称（可选，默认使用用户名）
   */
  async register(username: string, password: string, nickname: string) {
    if (!username || !password) return { code: 400, message: '用户名和密码不能为空' };
    if (username.length < 3 || username.length > 32) return { code: 400, message: '用户名长度3-32位' };
    if (password.length < 6) return { code: 400, message: '密码至少6位' };

    const { rows: exist } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (exist.length > 0) return { code: 400, message: '用户名已存在' };

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id, username, nickname, avatar',
      [username, passwordHash, nickname || username]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    return { code: 0, data: { token, user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar } } };
  },

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   */
  async login(username: string, password: string) {
    if (!username || !password) return { code: 400, message: '用户名和密码不能为空' };

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND status = 1', [username]);
    if (rows.length === 0) return { code: 400, message: '用户名或密码错误' };

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return { code: 400, message: '用户名或密码错误' };

    const token = jwt.sign({ id: user.id, username: user.username, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    return { code: 0, data: { token, user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar } } };
  },

  /**
   * 获取用户信息
   * @param userId 用户ID
   */
  async getUserInfo(userId: number) {
    const { rows } = await pool.query('SELECT id, username, nickname, created_at FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return { code: 404, message: '用户不存在' };
    return { code: 0, data: rows[0] };
  },

  // ========== 用户技能 ==========

  /** 获取用户自定义技能列表 */
  async getUserSkills(userId: number) {
    const { rows } = await pool.query(
      'SELECT id, skill_name, prompt_template, created_at FROM user_skills WHERE user_id = $1 ORDER BY id',
      [userId]
    );
    return rows.map((r: any) => ({ id: r.id, skillName: r.skill_name, promptTemplate: r.prompt_template, createdAt: r.created_at }));
  },

  /** 创建用户自定义技能 */
  async createUserSkill(userId: number, skillName: string, promptTemplate: string) {
    const { rows } = await pool.query(
      'INSERT INTO user_skills (user_id, skill_name, prompt_template) VALUES ($1, $2, $3) RETURNING id, skill_name, prompt_template',
      [userId, skillName, promptTemplate]
    );
    const r = rows[0];
    return { id: r.id, skillName: r.skill_name, promptTemplate: r.prompt_template };
  },

  /** 更新用户自定义技能 */
  async updateUserSkill(userId: number, skillId: number, skillName: string, promptTemplate: string) {
    await pool.query(
      'UPDATE user_skills SET skill_name = $1, prompt_template = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4',
      [skillName, promptTemplate, skillId, userId]
    );
  },

  /** 删除用户自定义技能 */
  async deleteUserSkill(userId: number, skillId: number) {
    await pool.query('DELETE FROM user_skills WHERE id = $1 AND user_id = $2', [skillId, userId]);
  },

  // ========== 聊天历史 ==========

  /** 保存聊天消息 */
  async saveChatMessage(userId: number, chatId: string, role: string, content: string) {
    await pool.query(
      'INSERT INTO chat_history (user_id, chat_id, role, content) VALUES ($1, $2, $3, $4)',
      [userId, chatId, role, content]
    );
  },

  /** 获取聊天会话列表（按会话聚合） */
  async getChatHistory(userId: number) {
    const { rows } = await pool.query(
      `SELECT chat_id, array_agg(json_build_object('role', role, 'content', content, 'createdAt', created_at) ORDER BY id) as messages
       FROM chat_history WHERE user_id = $1 GROUP BY chat_id ORDER BY max(created_at) DESC LIMIT 20`,
      [userId]
    );
    return rows.map((r: any) => ({ chatId: r.chat_id, messages: r.messages }));
  },

  /** 获取指定会话的消息列表 */
  async getChatMessages(userId: number, chatId: string) {
    const { rows } = await pool.query(
      'SELECT role, content, created_at FROM chat_history WHERE user_id = $1 AND chat_id = $2 ORDER BY id',
      [userId, chatId]
    );
    return rows.map((r: any) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
  },

  /** 删除聊天历史（物理删除） */
  async deleteChatHistory(userId: number, chatId?: string) {
    if (chatId) {
      await pool.query('DELETE FROM chat_history WHERE user_id = $1 AND chat_id = $2', [userId, chatId]);
    } else {
      await pool.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);
    }
  },

  // ========== 用户中心 ==========

  /** 获取用户中心数据：个人信息 + 使用统计 */
  async getUserProfile(userId: number) {
    const { rows: users } = await pool.query(
      'SELECT id, username, nickname, avatar, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (users.length === 0) return { code: 404, message: '用户不存在' };

    const user = users[0];

    const { rows: chatCount } = await pool.query(
      'SELECT COUNT(DISTINCT chat_id)::int as count FROM chat_history WHERE user_id = $1',
      [userId]
    );

    const { rows: skillCount } = await pool.query(
      'SELECT COUNT(*)::int as count FROM user_skills WHERE user_id = $1',
      [userId]
    );

    const { rows: docCount } = await pool.query(
      'SELECT COUNT(*)::int as count FROM document_analysis WHERE user_id = $1',
      [userId]
    );

    const { rows: executionCount } = await pool.query(
      'SELECT COUNT(*)::int as count FROM skill_execution WHERE user_id = $1',
      [userId]
    );

    return {
      code: 0,
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar || '',
        createdAt: user.created_at,
        stats: {
          chatCount: chatCount[0]?.count || 0,
          skillCount: skillCount[0]?.count || 0,
          docCount: docCount[0]?.count || 0,
          executionCount: executionCount[0]?.count || 0
        }
      }
    };
  },

  // ========== 修改个人信息 ==========

  /** 修改用户昵称 */
  async updateProfile(userId: number, nickname: string) {
    if (!nickname || nickname.trim().length === 0) return { code: 400, message: '昵称不能为空' };
    await pool.query('UPDATE users SET nickname = $1 WHERE id = $2', [nickname.trim(), userId]);
    return { code: 0, message: '修改成功' };
  },

  /** 修改密码 */
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    if (!oldPassword || !newPassword) return { code: 400, message: '密码不能为空' };
    if (newPassword.length < 6) return { code: 400, message: '新密码至少6位' };

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return { code: 404, message: '用户不存在' };

    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return { code: 400, message: '原密码错误' };

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    return { code: 0, message: '密码修改成功' };
  },

  /** 上传用户头像 */
  async uploadAvatar(userId: number, file: Express.Multer.File) {
    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `avatar_${userId}_${Date.now()}${ext}`;
    const filePath = path.join(AVATAR_DIR, uniqueName);
    fs.writeFileSync(filePath, file.buffer);

    const avatarUrl = `/uploads/avatars/${uniqueName}`;
    await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarUrl, userId]);
    return { code: 0, data: { avatarUrl } };
  },

  /** 注销用户账号（需验证密码） */
  async deleteAccount(userId: number, password: string) {
    if (!password) return { code: 400, message: '请验证密码' };

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return { code: 404, message: '用户不存在' };

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return { code: 400, message: '密码错误' };

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return { code: 0, message: '账号已注销' };
  }
};