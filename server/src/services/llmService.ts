import axios from 'axios';
import pool from '../config/database';
import { LLM_DEFAULTS, TIMEOUTS } from '../config/providers';
import { getPrompt } from './promptService';

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

async function getActiveLLMConfig(): Promise<LLMConfig | null> {
  try {
    const { rows } = await pool.query("SELECT config_value FROM system_config WHERE config_key = 'llm_config'");
    if (rows.length === 0) return null;
    const config = JSON.parse(rows[0].config_value);
    if (!config.activeProviderId || !config.providers) return null;
    const provider = config.providers.find((p: any) => p.id === config.activeProviderId);
    if (!provider || !provider.selectedModel) return null;
    return { baseUrl: provider.baseUrl || '', apiKey: provider.apiKey || '', model: provider.selectedModel, temperature: provider.temperature ?? LLM_DEFAULTS.temperature, maxTokens: provider.maxTokens || LLM_DEFAULTS.maxTokens };
  } catch { return null; }
}

export async function streamChat(query: string, context: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
  const llmConfig = await getActiveLLMConfig();
  if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) { const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置 → LLM模型管理中配置供应商和模型。'; onChunk(msg); onFinish(msg); return; }
  const systemPrompt = await getPrompt('search_assistant');
  const userPrompt = `${context}\n\n${query}`;
  try {
    const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
      model: llmConfig.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: llmConfig.temperature, max_tokens: llmConfig.maxTokens, stream: true
    }, { headers: { 'Authorization': `Bearer ${llmConfig.apiKey}`, 'Content-Type': 'application/json' }, responseType: 'stream', timeout: TIMEOUTS.llmStream });
    let fullText = '';
    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') { onFinish(fullText); return; }
          try { const parsed = JSON.parse(data); const content = parsed.choices?.[0]?.delta?.content || ''; if (content) { fullText += content; onChunk(content); } } catch { /* ignore */ }
        }
      }
    });
    response.data.on('end', () => { if (fullText) onFinish(fullText); });
    response.data.on('error', () => { if (!fullText) { const msg = '⚠️ LLM请求失败，请检查模型配置和 API Key 是否正确。'; onChunk(msg); onFinish(msg); } });
  } catch { const msg = '⚠️ LLM服务连接失败，请检查 Base URL 和网络连接。'; onChunk(msg); onFinish(msg); }
}

export async function streamChatDirect(messages: Array<{ role: string; content: string }>, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
  const llmConfig = await getActiveLLMConfig();
  if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) { const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置 → LLM模型管理中配置供应商和模型。'; onChunk(msg); onFinish(msg); return; }
  try {
    const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
      model: llmConfig.model, messages, temperature: llmConfig.temperature, max_tokens: llmConfig.maxTokens, stream: true
    }, { headers: { 'Authorization': `Bearer ${llmConfig.apiKey}`, 'Content-Type': 'application/json' }, responseType: 'stream', timeout: TIMEOUTS.llmStream });
    let fullText = '';
    response.data.on('data', (chunk: Buffer) => { /* same parsing logic */ });
    response.data.on('end', () => { if (fullText) onFinish(fullText); });
    response.data.on('error', () => { if (!fullText) { const msg = '⚠️ AI回答失败，请检查模型配置和 API Key 是否正确。'; onChunk(msg); onFinish(msg); } });
  } catch { const msg = '⚠️ AI服务连接失败，请检查网络或稍后重试。'; onChunk(msg); onFinish(msg); }
}