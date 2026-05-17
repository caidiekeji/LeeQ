import pool from '../config/database';

/** 内存缓存：避免每次LLM调用都查数据库 */
const promptCache = new Map<string, string>();
let cacheLoaded = false;

/** 加载所有提示词到内存缓存 */
export async function loadPromptCache(): Promise<void> {
  try {
    const { rows } = await pool.query('SELECT prompt_key, content FROM llm_prompts');
    promptCache.clear();
    for (const r of rows) {
      promptCache.set(r.prompt_key, r.content);
    }
    cacheLoaded = true;
    console.log(`提示词缓存已加载: ${rows.length} 条`);
  } catch (err) {
    console.error('加载提示词缓存失败:', err);
  }
}

/** 获取单个提示词（优先从缓存，缓存未就绪则查库并缓存） */
export async function getPrompt(key: string): Promise<string> {
  if (cacheLoaded && promptCache.has(key)) {
    return promptCache.get(key)!;
  }
  try {
    const { rows } = await pool.query(
      'SELECT content FROM llm_prompts WHERE prompt_key = $1',
      [key]
    );
    if (rows.length > 0) {
      promptCache.set(key, rows[0].content);
      return rows[0].content;
    }
  } catch (err) {
    console.error(`获取提示词 [${key}] 失败:`, err);
  }
  return '';
}

/** 获取所有提示词列表（后台管理用） */
export async function getAllPrompts(): Promise<Array<{
  id: number;
  promptKey: string;
  promptType: string;
  content: string;
  description: string;
  updatedAt: string;
}>> {
  const { rows } = await pool.query(
    'SELECT id, prompt_key, prompt_type, content, description, updated_at FROM llm_prompts ORDER BY id'
  );
  return rows.map((r: any) => ({
    id: r.id,
    promptKey: r.prompt_key,
    promptType: r.prompt_type,
    content: r.content,
    description: r.description,
    updatedAt: r.updated_at
  }));
}

/** 更新提示词内容（同时刷新缓存） */
export async function updatePrompt(id: number, content: string): Promise<void> {
  const { rows } = await pool.query(
    'UPDATE llm_prompts SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING prompt_key',
    [content, id]
  );
  if (rows.length > 0) {
    promptCache.set(rows[0].prompt_key, content);
  }
}

/** 刷新全部缓存（手动触发） */
export async function refreshCache(): Promise<void> {
  await loadPromptCache();
}