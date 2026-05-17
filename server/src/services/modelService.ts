import axios from 'axios';
import { TIMEOUTS, BAIDU_TOKEN_URL } from '../config/providers';
import { getPrompt } from './promptService';

// 请求头User-Agent配置
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * 模型信息接口
 */
export interface ModelInfo {
  id: string;   // 模型ID
  name: string; // 模型名称
}

/**
 * 供应商配置接口
 */
export interface ProviderConfig {
  id: string;              // 供应商ID
  name: string;            // 供应商名称（标识）
  label: string;           // 供应商显示名称
  defaultBaseUrl: string;  // 默认API基础URL
  modelsRoute: string;     // 模型列表接口路径
  defaultModel: string;    // 默认模型名称
}

export const PROVIDERS: ProviderConfig[] = [
  // ===== 国外供应商 =====
  {
    id: 'openai',
    name: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    modelsRoute: '/v1/models',
    defaultModel: 'gpt-4o'
  },
  {
    id: 'nvidia',
    name: 'nvidia',
    label: 'NVIDIA (英伟达)',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    modelsRoute: '/models',
    defaultModel: 'meta/llama-3.3-70b-instruct'
  },
  {
    id: 'anthropic',
    name: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com',
    modelsRoute: '/v1/models',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  {
    id: 'google',
    name: 'google',
    label: 'Google (Gemini)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelsRoute: '/models',
    defaultModel: 'gemini-2.5-flash'
  },
  {
    id: 'meta',
    name: 'meta',
    label: 'Meta (Llama)',
    defaultBaseUrl: 'https://api.llama.com/v1',
    modelsRoute: '/models',
    defaultModel: 'llama-4-maverick'
  },
  {
    id: 'mistral',
    name: 'mistral',
    label: 'Mistral AI',
    defaultBaseUrl: 'https://api.mistral.ai',
    modelsRoute: '/v1/models',
    defaultModel: 'mistral-large-latest'
  },
  {
    id: 'cohere',
    name: 'cohere',
    label: 'Cohere',
    defaultBaseUrl: 'https://api.cohere.com/v2',
    modelsRoute: '/models',
    defaultModel: 'command-r-plus'
  },
  {
    id: 'groq',
    name: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    modelsRoute: '/models',
    defaultModel: 'llama-4-maverick-17b-128e-instruct'
  },
  {
    id: 'together',
    name: 'together',
    label: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    modelsRoute: '/models',
    defaultModel: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
  },
  // ===== 国内供应商 =====
  {
    id: 'deepseek',
    name: 'deepseek',
    label: 'DeepSeek (深度求索)',
    defaultBaseUrl: 'https://api.deepseek.com',
    modelsRoute: '/v1/models',
    defaultModel: 'deepseek-chat'
  },
  {
    id: 'zhipu',
    name: 'zhipu',
    label: '智谱AI (GLM)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelsRoute: '/models',
    defaultModel: 'glm-4-flash'
  },
  {
    id: 'qwen',
    name: 'qwen',
    label: '通义千问 (阿里云)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelsRoute: '/models',
    defaultModel: 'qwen-plus'
  },
  {
    id: 'moonshot',
    name: 'moonshot',
    label: 'Moonshot (Kimi)',
    defaultBaseUrl: 'https://api.moonshot.cn',
    modelsRoute: '/v1/models',
    defaultModel: 'moonshot-v1-8k'
  },
  {
    id: 'baidu',
    name: 'baidu',
    label: '百度文心 (ERNIE)',
    defaultBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    modelsRoute: '/chat',
    defaultModel: 'ernie-4.0-turbo-8k'
  },
  {
    id: 'doubao',
    name: 'doubao',
    label: '豆包 (字节跳动)',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelsRoute: '/models',
    defaultModel: 'doubao-pro-32k'
  },
  {
    id: 'yi',
    name: 'yi',
    label: '零一万物 (Yi)',
    defaultBaseUrl: 'https://api.lingyiwanwu.com/v1',
    modelsRoute: '/models',
    defaultModel: 'yi-large'
  },
  {
    id: 'minimax',
    name: 'minimax',
    label: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    modelsRoute: '/models',
    defaultModel: 'abab6.5s-chat'
  },
  {
    id: 'xunfei',
    name: 'xunfei',
    label: '讯飞星火 (Spark)',
    defaultBaseUrl: 'https://spark-api-open.xf-yun.com/v1',
    modelsRoute: '/models',
    defaultModel: '4.0Ultra'
  },
  // ===== 本地部署 =====
  {
    id: 'ollama',
    name: 'ollama',
    label: 'Ollama (本地部署)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    modelsRoute: '/models',
    defaultModel: 'llama3.2'
  },
  // ===== 通用兼容 =====
  {
    id: 'custom',
    name: 'custom',
    label: '自定义 (OpenAI兼容接口)',
    defaultBaseUrl: 'https://api.openai.com',
    modelsRoute: '/v1/models',
    defaultModel: 'gpt-4o'
  }
];

/**
 * 获取供应商的模型列表
 * @param providerId 供应商标识
 * @param apiKey API密钥
 * @param baseUrl 可选的自定义基础URL
 * @returns 模型列表
 */
export async function fetchModels(providerId: string, apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error('未知供应商');

  const url = baseUrl || provider.defaultBaseUrl;

  // 百度文心使用特殊处理方式
  if (providerId === 'baidu') {
    return getBaiduModels(apiKey);
  }

  // 调用供应商API获取模型列表
  const response = await axios.get(`${url}${provider.modelsRoute}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': USER_AGENT
    },
    timeout: TIMEOUTS.fetchModels
  });

  const models: ModelInfo[] = [];
  const list = response.data?.data || response.data || [];
  for (const m of list) {
    const modelId = m.id || m.name || m.model || '';
    if (modelId && typeof modelId === 'string') {
      models.push({ id: modelId, name: modelId });
    }
  }

  // 如果没有获取到模型，使用默认模型
  if (models.length === 0) {
    models.push({ id: provider.defaultModel, name: `${provider.label} 默认模型` });
  }

  return models;
}

/**
 * 获取百度文心模型列表（特殊处理）
 * @param apiKey API密钥（格式：client_id:client_secret）
 * @returns 模型列表
 */
async function getBaiduModels(apiKey: string): Promise<ModelInfo[]> {
  const baiduModels = [
    'ernie-4.0-turbo-8k',
    'ernie-4.0-8k',
    'ernie-3.5-8k',
    'ernie-speed-8k',
    'ernie-lite-8k',
    'ernie-tiny-8k'
  ];

  try {
    // 获取access token（百度特殊认证流程）
    const tokenUrl = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey.split(':')[0]}&client_secret=${apiKey.split(':')[1] || ''}`;
    await axios.post(tokenUrl, null, { timeout: TIMEOUTS.baiduToken });
    return baiduModels.map(m => ({ id: m, name: m }));
  } catch {
    // 即使认证失败也返回模型列表
    return baiduModels.map(m => ({ id: m, name: m }));
  }
}

export interface SpeedTestResult {
  modelId: string;
  totalMs: number;
  totalTokens: number;
  tokensPerSecond: number;
}

export async function testModelSpeed(
  providerId: string,
  apiKey: string,
  modelId: string,
  baseUrl?: string
): Promise<SpeedTestResult> {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error('未知供应商');

  if (providerId === 'baidu') {
    throw new Error('百度文心暂不支持测速功能');
  }

  const url = baseUrl || provider.defaultBaseUrl;
  const startTime = Date.now();

  const testText = await getPrompt('model_speed_test');
const response = await axios.post(`${url}/chat/completions`, {
    model: modelId,
    messages: [
      { role: 'user', content: testText }
    ],
    max_tokens: 64,
    temperature: 0
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT
    },
    timeout: TIMEOUTS.modelSpeedTest
  });

  const totalMs = Date.now() - startTime;
  const content = response.data?.choices?.[0]?.message?.content || '';
  const usage = response.data?.usage || {};
  const totalTokens = usage.total_tokens || usage.completion_tokens || content.length;
  const tokensPerSecond = totalMs > 0 ? Math.round(totalTokens / (totalMs / 1000)) : 0;

  return {
    modelId,
    totalMs,
    totalTokens,
    tokensPerSecond
  };
}
