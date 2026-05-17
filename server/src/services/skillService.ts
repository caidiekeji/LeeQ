import { query, queryOne } from '../config/database';

// 获取所有可用技能
export async function getAvailableSkills() {
  const skills = await query(
    `SELECT id, name, description, category, icon, prompt_template, sort_order
     FROM skills
     WHERE status = 'active'
     ORDER BY sort_order ASC, created_at DESC`
  );
  return skills;
}

// 获取技能详情
export async function getSkillDetail(skillId: number) {
  const skill = await queryOne(
    `SELECT id, name, description, category, icon, prompt_template, status, sort_order, created_at
     FROM skills WHERE id = $1`,
    [skillId]
  );
  return skill;
}

// 按分类获取技能
export async function getSkillsByCategory(category: string) {
  const skills = await query(
    `SELECT id, name, description, icon, prompt_template, sort_order
     FROM skills
     WHERE category = $1 AND status = 'active'
     ORDER BY sort_order ASC`,
    [category]
  );
  return skills;
}

// 获取所有技能分类
export async function getSkillCategories() {
  const categories = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*) as count
     FROM skills
     WHERE status = 'active'
     GROUP BY category
     ORDER BY category ASC`
  );
  return categories.map(row => ({
    category: row.category,
    count: parseInt(row.count)
  }));
}

// 使用技能生成回复（应用 prompt 模板）
export async function applySkill(skillId: number, userQuery: string, context?: string) {
  const skill = await getSkillDetail(skillId);

  if (!skill) {
    throw new Error('技能不存在');
  }

  if (skill.status !== 'active') {
    throw new Error('技能未启用');
  }

  // 构建 prompt
  let prompt = skill.prompt_template || '';

  // 替换模板变量
  prompt = prompt.replace(/\{\{query\}\}/g, userQuery);
  prompt = prompt.replace(/\{\{context\}\}/g, context || '');
  prompt = prompt.replace(/\{\{date\}\}/g, new Date().toLocaleDateString('zh-CN'));
  prompt = prompt.replace(/\{\{time\}\}/g, new Date().toLocaleTimeString('zh-CN'));

  return {
    skill: {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      icon: skill.icon
    },
    prompt
  };
}