import pool from '../config/database';
import { LLM_DEFAULTS } from '../config/providers';

/**
 * LLM配置接口定义
 */
export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * 获取当前激活的LLM配置（唯一真相源）
 * @returns LLM配置对象或null
 */
export async function getActiveLLMConfig(): Promise<LLMConfig | null> {
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