import axios from 'axios';
import pool from '../config/database';
import { LLM_DEFAULTS, TIMEOUTS } from '../config/providers';
import { getPrompt } from './promptService';

/**
 * 获取当前激活的LLM配置（复用llmService中的逻辑）
 */
async function getActiveLLMConfig() {
  try {
    const { rows } = await pool.query("SELECT config_value FROM system_config WHERE config_key = 'llm_config'");
    if (rows.length === 0) return null;
    const config = JSON.parse(rows[0].config_value);
    if (!config.activeProviderId || !config.providers) return null;
    const provider = config.providers.find((p: any) => p.id === config.activeProviderId);
    if (!provider || !provider.selectedModel) return null;
    return {
      baseUrl: provider.baseUrl || '',
      apiKey: provider.apiKey || '',
      model: provider.selectedModel,
      temperature: provider.temperature ?? LLM_DEFAULTS.temperature,
      maxTokens: provider.maxTokens || LLM_DEFAULTS.maxTokens
    };
  } catch {
    return null;
  }
}

/**
 * 技能服务：技能模板管理与LLM执行
 */
export const skillService = {
  /**
   * 获取所有启用的技能模板（用户端）
   * @returns 技能列表
   */
  async listSkills() {
    const { rows } = await pool.query(
      'SELECT id, skill_name, skill_key, description FROM skill_template WHERE status = 1 ORDER BY id'
    );
    return rows.map((r: any) => ({
      id: r.id,
      skillName: r.skill_name,
      skillKey: r.skill_key,
      description: r.description
    }));
  },

  /**
   * 执行技能：将用户输入注入技能模板，调用LLM
   * @param skillId 技能ID
   * @param inputText 用户输入文本
   * @returns LLM执行结果
   */
  async executeSkill(skillId: number, inputText: string): Promise<string> {
    const { rows } = await pool.query('SELECT * FROM skill_template WHERE id = $1 AND status = 1', [skillId]);
    if (rows.length === 0) {
      return '⚠️ 技能不存在或已禁用';
    }

    const template = rows[0];
    const prompt = template.prompt_template.replace('{inputText}', inputText);

    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
      return '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置中配置模型。';
    }

    try {
      const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
        model: llmConfig.model,
        messages: [
          { role: 'system', content: await getPrompt('skill_system') },
          { role: 'user', content: prompt }
        ],
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens
      }, {
        headers: {
          'Authorization': `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: TIMEOUTS.llmStream
      });

      const result = response.data.choices?.[0]?.message?.content || '';

      // 保存执行记录
      await pool.query(
        'INSERT INTO skill_execution (skill_id, user_input, llm_result) VALUES ($1, $2, $3)',
        [skillId, inputText, result]
      );

      return result;
    } catch {
      return '⚠️ LLM服务连接失败，请检查网络或稍后重试。';
    }
  },

  /**
   * 内部通用流式LLM调用
   * @param prompt 完整提示词
   * @param onChunk 收到文本块回调
   * @param onFinish 完成回调
   * @param onBeforeFinish 完成前的回调（用于保存记录等）
   */
  async _streamLLM(prompt: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void, onBeforeFinish?: (fullText: string) => void): Promise<void> {
    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
      const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置中配置模型。';
      onChunk(msg);
      onFinish(msg);
      return;
    }

    try {
      const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
        model: llmConfig.model,
        messages: [
          { role: 'system', content: await getPrompt('skill_system') },
          { role: 'user', content: prompt }
        ],
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens,
        stream: true
      }, {
        headers: {
          'Authorization': `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: TIMEOUTS.llmStream
      });

      let fullText = '';

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              if (onBeforeFinish) onBeforeFinish(fullText);
              onFinish(fullText);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch { /* 忽略解析错误 */ }
          }
        }
      });

      response.data.on('end', () => {
        if (fullText) {
          if (onBeforeFinish) onBeforeFinish(fullText);
          onFinish(fullText);
        }
      });

      response.data.on('error', () => {
        if (!fullText) {
          const msg = '⚠️ AI请求失败，请重试。';
          onChunk(msg);
          onFinish(msg);
        }
      });
    } catch {
      const msg = '⚠️ AI服务连接失败，请检查网络或稍后重试。';
      onChunk(msg);
      onFinish(msg);
    }
  },

  /**
   * 流式执行技能（SSE方式，直接传入拼装好的prompt）
   * @param prompt 已拼装好的完整提示词
   * @param onChunk 收到文本块回调
   * @param onFinish 完成回调
   */
  async executeSkillStreamWithPrompt(prompt: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
    return this._streamLLM(prompt, onChunk, onFinish);
  },

  /**
   * 流式执行技能（SSE方式）
   * @param skillId 技能ID
   * @param inputText 用户输入文本
   * @param onChunk 收到文本块回调
   * @param onFinish 完成回调
   * @param fileContext 文件上下文（可选）
   */
  async executeSkillStream(skillId: number, inputText: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void, fileContext: string = ''): Promise<void> {
    const { rows } = await pool.query('SELECT * FROM skill_template WHERE id = $1 AND status = 1', [skillId]);
    if (rows.length === 0) {
      const msg = '⚠️ 技能不存在或已禁用';
      onChunk(msg);
      onFinish(msg);
      return;
    }

    const template = rows[0];
    let prompt = template.prompt_template.replace('{inputText}', inputText);
    
    if (fileContext) {
      prompt += '\n\n' + fileContext;
    }

    return this._streamLLM(prompt, onChunk, onFinish, (fullText) => {
      pool.query(
        'INSERT INTO skill_execution (skill_id, user_input, llm_result) VALUES ($1, $2, $3)',
        [skillId, inputText, fullText]
      ).catch(() => {});
    });
  },

  // ========== 后台管理接口 ==========

  /**
   * 获取所有技能模板列表（管理端，含禁用）
   * @returns 技能模板列表
   */
  async getSkillTemplates() {
    const { rows } = await pool.query('SELECT * FROM skill_template ORDER BY id');
    return rows.map((r: any) => ({
      id: r.id,
      skillName: r.skill_name,
      skillKey: r.skill_key,
      promptTemplate: r.prompt_template,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  /**
   * 创建技能模板
   * @param data 技能数据
   * @returns 创建的技能
   */
  async createSkillTemplate(data: { skillName: string; skillKey: string; promptTemplate: string; description: string }) {
    const { rows } = await pool.query(
      'INSERT INTO skill_template (skill_name, skill_key, prompt_template, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.skillName, data.skillKey, data.promptTemplate, data.description]
    );
    const r = rows[0];
    return {
      id: r.id,
      skillName: r.skill_name,
      skillKey: r.skill_key,
      promptTemplate: r.prompt_template,
      description: r.description,
      status: r.status,
      createdAt: r.created_at
    };
  },

  /**
   * 更新技能模板
   * @param id 技能ID
   * @param data 更新数据
   */
  async updateSkillTemplate(id: number, data: { skillName?: string; promptTemplate?: string; description?: string; status?: number }) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.skillName !== undefined) { fields.push(`skill_name = $${idx}`); params.push(data.skillName); idx++; }
    if (data.promptTemplate !== undefined) { fields.push(`prompt_template = $${idx}`); params.push(data.promptTemplate); idx++; }
    if (data.description !== undefined) { fields.push(`description = $${idx}`); params.push(data.description); idx++; }
    if (data.status !== undefined) { fields.push(`status = $${idx}`); params.push(data.status); idx++; }
    fields.push(`updated_at = NOW()`);
    params.push(id);

    await pool.query(
      `UPDATE skill_template SET ${fields.join(', ')} WHERE id = $${idx}`,
      params
    );
  },

  /**
   * 删除技能模板
   * @param id 技能ID
   */
  async deleteSkillTemplate(id: number) {
    await pool.query('DELETE FROM skill_template WHERE id = $1', [id]);
  },

  /**
   * 获取技能执行记录列表
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 分页执行记录
   */
  async getSkillExecutions(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM skill_execution');
    const total = countRows[0]?.cnt || 0;
    const { rows } = await pool.query(
      `SELECT se.*, st.skill_name
       FROM skill_execution se
       LEFT JOIN skill_template st ON se.skill_id = st.id
       ORDER BY se.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        skillId: r.skill_id,
        skillName: r.skill_name || '已删除',
        userInput: r.user_input,
        llmResult: r.llm_result,
        createdAt: r.created_at
      })),
      total,
      page,
      pageSize
    };
  },

  /**
   * 获取文档分析记录列表
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 分页分析记录
   */
  async getDocumentAnalysis(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as cnt FROM document_analysis');
    const total = countRows[0]?.cnt || 0;
    const { rows } = await pool.query(
      'SELECT * FROM document_analysis ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        fileName: r.file_name,
        fileUrl: r.file_url,
        fileType: r.file_type,
        userInput: r.user_input,
        llmResult: r.llm_result,
        createdAt: r.created_at
      })),
      total,
      page,
      pageSize
    };
  },

  /**
   * 删除文档分析记录
   * @param id 记录ID
   */
  async deleteDocumentAnalysis(id: number) {
    await pool.query('DELETE FROM document_analysis WHERE id = $1', [id]);
  },

  /**
   * 删除技能执行记录
   * @param id 记录ID
   */
  async deleteSkillExecution(id: number) {
    await pool.query('DELETE FROM skill_execution WHERE id = $1', [id]);
  }
};