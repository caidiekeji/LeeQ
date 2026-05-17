import axios from 'axios';
import pool from '../config/database';
import { LLM_DEFAULTS, TIMEOUTS } from '../config/providers';
import { getPrompt } from './promptService';

/**
 * LLM配置接口定义
 */
export interface LLMConfig {
  baseUrl: string;       // API基础URL
  apiKey: string;        // API密钥
  model: string;         // 模型名称
  temperature: number;   // 温度参数（控制创造性）
  maxTokens: number;     // 最大token数
}

/**
 * 获取当前激活的LLM配置
 * @returns LLM配置对象或null
 */
async function getActiveLLMConfig(): Promise<LLMConfig | null> {
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
 * 流式聊天函数（用于搜索回答）
 * @param query 用户查询
 * @param context 搜索上下文（搜索结果）
 * @param onChunk 收到文本块时的回调
 * @param onFinish 完成时的回调
 */
export async function streamChat(query: string, context: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
  const llmConfig = await getActiveLLMConfig();

  // 检查LLM配置是否完整
  if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
    const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置 → LLM模型管理中配置供应商和模型。';
    onChunk(msg);
    onFinish(msg);
    return;
  }

  const systemPrompt = await getPrompt('search_assistant');

  const userPrompt = `${context}

${query}`;

  try {
    // 调用LLM API（OpenAI兼容格式）
    const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
      model: llmConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: llmConfig.temperature,
      max_tokens: llmConfig.maxTokens,
      stream: true  // 启用流式响应
    }, {
      headers: {
        'Authorization': `Bearer ${llmConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: TIMEOUTS.llmStream  // 60秒超时
    });

    let fullText = '';

    // 处理流式数据块
    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {  // SSE结束标志
            onFinish(fullText);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onChunk(content);  // 逐块推送
            }
          } catch { /* 忽略解析错误 */ }
        }
      }
    });

    // 流结束
    response.data.on('end', () => {
      if (fullText) onFinish(fullText);
    });

    // 流错误
    response.data.on('error', () => {
      if (!fullText) {
        const msg = '⚠️ LLM请求失败，请检查模型配置和 API Key 是否正确。';
        onChunk(msg);
        onFinish(msg);
      }
    });
  } catch {
    const msg = '⚠️ LLM服务连接失败，请检查 Base URL 和网络连接。';
    onChunk(msg);
    onFinish(msg);
  }
}

/**
 * 流式聊天函数（直接模式，用于多轮对话）
 * @param messages 消息历史数组
 * @param onChunk 收到文本块时的回调
 * @param onFinish 完成时的回调
 */
export async function streamChatDirect(messages: Array<{ role: string; content: string }>, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
  const llmConfig = await getActiveLLMConfig();

  if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
    const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置 → LLM模型管理中配置供应商和模型。';
    onChunk(msg);
    onFinish(msg);
    return;
  }

  try {
    // 调用LLM API（带完整消息历史）
    const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
      model: llmConfig.model,
      messages: messages,
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

    // 处理流式数据
    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
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

    // 流结束
    response.data.on('end', () => {
      if (fullText) onFinish(fullText);
    });

    // 流错误
    response.data.on('error', () => {
      if (!fullText) {
        const msg = '⚠️ AI回答失败，请检查模型配置和 API Key 是否正确。';
        onChunk(msg);
        onFinish(msg);
      }
    });
  } catch {
    const msg = '⚠️ AI服务连接失败，请检查网络或稍后重试。';
    onChunk(msg);
    onFinish(msg);
  }
}

/**
 * 增强流式聊天（支持技能+文件上下文）
 * @param messages 历史消息数组
 * @param skillPrompt 技能系统提示（null表示无技能）
 * @param fileContext 文件上下文文本
 * @param onChunk 流式回调
 * @param onFinish 完成回调
 */
export async function streamChatEnhanced(
  messages: Array<{ role: string; content: string }>,
  skillPrompt: string | null,
  fileContext: string | null,
  onChunk: (text: string) => void,
  onFinish: (fullText: string) => void
): Promise<void> {
  const llmConfig = await getActiveLLMConfig();

  if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
    const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置 → LLM模型管理中配置供应商和模型。';
    onChunk(msg);
    onFinish(msg);
    return;
  }

  // 组装增强消息
  const enhancedMessages: Array<{ role: string; content: string }> = [];
  let systemContent = await getPrompt('chat_base');

  // 注入技能系统提示
  if (skillPrompt) {
    systemContent += `\n\n[当前技能要求]\n${skillPrompt}`;
  }

  // 注入文件上下文
  if (fileContext) {
    systemContent += `\n\n[文件上下文]\n${fileContext}`;
    systemContent += `\n\n${await getPrompt('chat_file_rule')}`;
  }

  enhancedMessages.push({ role: 'system', content: systemContent });

  // Token预算管理：限制历史消息长度
  let historyTokens = 0;
  const MAX_HISTORY_TOKENS = LLM_DEFAULTS.maxHistoryTokens;
  const recentMessages: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = _estimateTokens(messages[i].content);
    if (historyTokens + tokens > MAX_HISTORY_TOKENS) break;
    recentMessages.unshift(messages[i]);
    historyTokens += tokens;
  }
  enhancedMessages.push(...recentMessages);

  // 如果有文件/技能切换，追加确认声明提示
  if (skillPrompt || fileContext) {
    enhancedMessages.push({
      role: 'system',
      content: await getPrompt('chat_meta_rule')
    });
  }

  try {
    const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
      model: llmConfig.model,
      messages: enhancedMessages,
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
          if (data === '[DONE]') { onFinish(fullText); return; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) { fullText += content; onChunk(content); }
          } catch { /* 忽略解析错误 */ }
        }
      }
    });

    response.data.on('end', () => { if (fullText) onFinish(fullText); });
    response.data.on('error', () => {
      if (!fullText) {
        const msg = '⚠️ AI回答失败，请检查模型配置和 API Key 是否正确。';
        onChunk(msg); onFinish(msg);
      }
    });
  } catch {
    const msg = '⚠️ AI服务连接失败，请检查网络或稍后重试。';
    onChunk(msg);
    onFinish(msg);
  }
}

/**
 * 估算文本Token数（粗略：中文1字≈1token，英文1词≈1token）
 */
function _estimateTokens(text: string): number {
  if (!text) return 0;
  // 简单估算：中文字符数 + 英文单词数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}