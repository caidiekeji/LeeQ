import pool from '../config/database';
import crypto from 'crypto';

/**
 * 会话状态（SSOT唯一真相源）
 */
interface ConversationState {
  chatId: string;
  userId: number;
  activeFileIds: number[];
  activeSkillId: number | null;
  lastProcessedOperationId: string | null;
  messageCount: number;
}

/**
 * 操作日志条目
 */
interface OperationEntry {
  type: 'add_file' | 'remove_file' | 'switch_skill' | 'send_text';
  data: any;
  clientMessageId: string;
}

/**
 * 单轮对话请求负载
 */
interface TurnPayload {
  conversationId: string;
  text: string;
  files: Array<{ id: number; name: string; parsedContent: string | null; summary: string | null }>;
  removedFileIds: number[];
  newSkillId: number | null;
  newSkillName: string | null;
  clientMessageId: string;
  lastKnownOperationId: string | null;
}

/**
 * 会话级并发锁（保证同会话请求串行处理）
 */
const conversationLocks = new Map<string, Promise<any>>();

/**
 * 会话服务：实现SSOT架构、操作日志、并发控制
 */
export const conversationService = {

  /**
   * 带锁的串行化处理入口
   */
  async processTurn(payload: TurnPayload): Promise<any> {
    const convId = payload.conversationId;
    const currentLock = conversationLocks.get(convId) || Promise.resolve();
    const newTask = currentLock.then(() => this._processTurnInternal(payload));
    conversationLocks.set(convId, newTask.catch((err) => {
      console.error(`[Conversation] 会话 ${convId} 处理异常:`, err);
    }));
    return newTask;
  },

  /**
   * 内部处理流程：加载状态 → 幂等检查 → 应用增量 → 返回合并状态
   */
  async _processTurnInternal(payload: TurnPayload) {
    // Step 1: 加载/创建会话状态
    let state = await this._loadState(payload.conversationId, payload.clientMessageId);

    // Step 2: 幂等性检查
    if (state === null) {
      const cached = await this._getCachedResponse(payload.clientMessageId);
      if (cached) return cached;
    }

    // Step 3: 确保会话状态存在
    if (!state) {
      state = await this._createState(payload.conversationId);
    }

    // Step 4: 操作连续性检查
    if (payload.lastKnownOperationId && state.lastProcessedOperationId &&
        payload.lastKnownOperationId !== state.lastProcessedOperationId) {
      console.warn(`[Conversation] 操作可能丢失，前端lastKnown=${payload.lastKnownOperationId}, 后端=${state.lastProcessedOperationId}`);
    }

    // Step 5: 应用增量操作（文件增删）
    let activeFileIds = [...state.activeFileIds];
    if (payload.files && payload.files.length > 0) {
      for (const f of payload.files) {
        if (!activeFileIds.includes(f.id)) {
          activeFileIds.push(f.id);
        }
      }
    }
    if (payload.removedFileIds && payload.removedFileIds.length > 0) {
      activeFileIds = activeFileIds.filter(id => !payload.removedFileIds.includes(id));
    }

    // Step 6: 应用技能切换
    const activeSkillId = payload.newSkillId !== null && payload.newSkillId !== undefined
      ? payload.newSkillId : state.activeSkillId;

    // Step 7: 更新会话状态
    const lastProcessedOperationId = this._generateOperationId();
    await this._updateState(payload.conversationId, {
      activeFileIds,
      activeSkillId,
      lastProcessedOperationId,
      messageCount: state.messageCount + 1
    });

    // Step 8: 记录操作日志
    if (payload.files && payload.files.length > 0) {
      await this._logOperation(payload.conversationId, 'add_file',
        { files: payload.files.map(f => ({ id: f.id, name: f.name })) },
        payload.clientMessageId);
    }
    if (payload.removedFileIds && payload.removedFileIds.length > 0) {
      await this._logOperation(payload.conversationId, 'remove_file',
        { fileIds: payload.removedFileIds }, payload.clientMessageId);
    }
    if (payload.newSkillId !== null && payload.newSkillId !== undefined) {
      await this._logOperation(payload.conversationId, 'switch_skill',
        { skillId: payload.newSkillId, skillName: payload.newSkillName }, payload.clientMessageId);
    }
    if (payload.text && payload.text.trim()) {
      await this._logOperation(payload.conversationId, 'send_text',
        { text: payload.text }, payload.clientMessageId);
    }

    // Step 9: 获取活跃文件详情
    const activeFiles = await this._getActiveFiles(activeFileIds);

    // Step 10: 获取技能详情
    let activeSkill = null;
    if (activeSkillId) {
      activeSkill = await this._getSkillDetail(activeSkillId);
    }

    // Step 11: 获取历史消息（用于LLM组装）
    const historyMessages = await this._getHistoryMessages(payload.conversationId);

    return {
      success: true,
      state: { activeFiles, activeSkill, activeFileIds, activeSkillId, messageCount: state.messageCount + 1 },
      historyMessages,
      lastProcessedOperationId
    };
  },

  /**
   * 保存AI回复到聊天历史
   */
  async saveAssistantMessage(chatId: string, userId: number, content: string,
    clientMessageId: string, skillId: number | null, fileData: any) {
    try {
      await pool.query(
        `INSERT INTO chat_history (user_id, chat_id, role, content, client_message_id, skill_id, file_data, message_type)
         VALUES ($1, $2, 'assistant', $3, $4, $5, $6, 'text')`,
        [userId, chatId, content, clientMessageId, skillId, fileData ? JSON.stringify(fileData) : null]
      );
      // 更新消息计数
      await pool.query(
        `UPDATE conversation_state SET message_count = message_count + 2, updated_at = CURRENT_TIMESTAMP WHERE chat_id = $1`,
        [chatId]
      );
    } catch (err) {
      console.error('[Conversation] 保存AI回复失败:', err);
    }
  },

  // ==================== 内部方法 ====================

  async _loadState(chatId: string, clientMessageId: string): Promise<ConversationState | null> {
    try {
      // 先检查 clientMessageId 是否已处理
      const dupCheck = await pool.query(
        'SELECT chat_id FROM chat_history WHERE client_message_id = $1 AND deleted_at IS NULL LIMIT 1',
        [clientMessageId]
      );
      if (dupCheck.rows.length > 0) return null;

      const { rows } = await pool.query(
        'SELECT * FROM conversation_state WHERE chat_id = $1',
        [chatId]
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        chatId: r.chat_id,
        userId: r.user_id,
        activeFileIds: r.active_file_ids || [],
        activeSkillId: r.active_skill_id,
        lastProcessedOperationId: r.last_processed_operation_id,
        messageCount: r.message_count
      };
    } catch (err) {
      console.error('[Conversation] 加载状态失败:', err);
      return null;
    }
  },

  async _createState(chatId: string): Promise<ConversationState> {
    await pool.query(
      `INSERT INTO conversation_state (chat_id, user_id) VALUES ($1, 0)
       ON CONFLICT (chat_id) DO NOTHING`,
      [chatId]
    );
    return {
      chatId,
      userId: 0,
      activeFileIds: [],
      activeSkillId: null,
      lastProcessedOperationId: null,
      messageCount: 0
    };
  },

  async _updateState(chatId: string, updates: Partial<ConversationState>) {
    try {
      const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let paramIdx = 1;

      if (updates.activeFileIds) {
        setClauses.push(`active_file_ids = $${paramIdx++}`);
        values.push(updates.activeFileIds);
      }
      if (updates.activeSkillId !== undefined) {
        setClauses.push(`active_skill_id = $${paramIdx++}`);
        values.push(updates.activeSkillId);
      }
      if (updates.lastProcessedOperationId) {
        setClauses.push(`last_processed_operation_id = $${paramIdx++}`);
        values.push(updates.lastProcessedOperationId);
      }
      if (updates.messageCount !== undefined) {
        setClauses.push(`message_count = $${paramIdx++}`);
        values.push(updates.messageCount);
      }

      values.push(chatId);
      await pool.query(
        `UPDATE conversation_state SET ${setClauses.join(', ')} WHERE chat_id = $${paramIdx}`,
        values
      );
    } catch (err) {
      console.error('[Conversation] 更新状态失败:', err);
    }
  },

  async _logOperation(chatId: string, type: string, data: any, clientMessageId: string) {
    try {
      await pool.query(
        `INSERT INTO operation_log (chat_id, operation_type, operation_data, client_message_id, status)
         VALUES ($1, $2, $3, $4, 'synced')`,
        [chatId, type, JSON.stringify(data), clientMessageId]
      );
    } catch (err) {
      console.error('[Conversation] 记录操作日志失败:', err);
    }
  },

  async _getActiveFiles(fileIds: number[]) {
    if (!fileIds.length) return [];
    try {
      const { rows } = await pool.query(
        'SELECT id, file_name, file_type, file_size, parse_status, file_summary, parsed_content, token_count FROM uploaded_file WHERE id = ANY($1)',
        [fileIds]
      );
      return rows.map(r => ({
        id: r.id,
        name: r.file_name,
        type: r.file_type,
        size: r.file_size,
        status: r.parse_status,
        summary: r.file_summary,
        parsedContent: r.parsed_content,
        tokenCount: r.token_count
      }));
    } catch { return []; }
  },

  async _getSkillDetail(skillId: number) {
    try {
      const { rows } = await pool.query(
        'SELECT id, skill_name, skill_key, prompt_template, description FROM skill_template WHERE id = $1',
        [skillId]
      );
      if (!rows.length) return null;
      return {
        id: rows[0].id,
        name: rows[0].skill_name,
        key: rows[0].skill_key,
        promptTemplate: rows[0].prompt_template,
        description: rows[0].description
      };
    } catch { return null; }
  },

  async _getHistoryMessages(chatId: string) {
    try {
      const { rows } = await pool.query(
        `SELECT role, content, skill_id, file_data, message_type FROM chat_history
         WHERE chat_id = $1 AND role IN ('user', 'assistant') AND deleted_at IS NULL
         ORDER BY id ASC LIMIT 50`,
        [chatId]
      );
      return rows.map(r => ({
        role: r.role,
        content: r.content,
        skillId: r.skill_id,
        fileData: r.file_data,
        messageType: r.message_type
      }));
    } catch { return []; }
  },

  async _getCachedResponse(clientMessageId: string) {
    try {
      const { rows } = await pool.query(
        `SELECT content FROM chat_history WHERE client_message_id = $1 AND role = 'assistant' AND deleted_at IS NULL LIMIT 1`,
        [clientMessageId]
      );
      if (rows.length > 0) {
        return { success: true, cached: true, aiMessage: { content: rows[0].content } };
      }
      return null;
    } catch { return null; }
  },

  _generateOperationId(): string {
    return `op_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  }
};

export default conversationService;