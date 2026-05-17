import dotenv from 'dotenv';
import { Pool, Client } from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 5432;
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'a_search';

const initDb = async () => {
  // 第一步：连接到默认的 postgres 库，创建目标数据库
  const adminClient = new Client({
    host: DB_HOST, port: DB_PORT,
    user: DB_USER, password: DB_PASSWORD,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    // 检查数据库是否存在，不存在则创建
    const { rows } = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
    );
    if (rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`数据库 "${DB_NAME}" 创建成功`);
    } else {
      console.log(`数据库 "${DB_NAME}" 已存在`);
    }
  } finally {
    await adminClient.end();
  }

  // 第二步：连接到目标数据库，创建表
  const pool = new Pool({
    host: DB_HOST, port: DB_PORT,
    user: DB_USER, password: DB_PASSWORD,
    database: DB_NAME
  });

  try {
    // 管理员用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_user (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE admin_user IS '管理员用户表'`);
    await pool.query(`COMMENT ON COLUMN admin_user.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN admin_user.username IS '用户名，登录使用'`);
    await pool.query(`COMMENT ON COLUMN admin_user.password_hash IS '密码哈希值（BCrypt）'`);
    await pool.query(`COMMENT ON COLUMN admin_user.status IS '状态：1-正常 2-禁用'`);
    await pool.query(`COMMENT ON COLUMN admin_user.created_at IS '创建时间'`);
    await pool.query(`COMMENT ON COLUMN admin_user.updated_at IS '更新时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_admin_user_username ON admin_user (username)`);

    // 抓取任务表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crawl_task (
        id BIGSERIAL PRIMARY KEY,
        url VARCHAR(2048) NOT NULL,
        task_type VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        crawl_depth SMALLINT NOT NULL DEFAULT 2,
        markdown_content TEXT,
        error_message VARCHAR(500),
        anycrawl_task_id VARCHAR(64),
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP(3)
      )
    `);
    await pool.query(`COMMENT ON TABLE crawl_task IS '抓取任务表'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.url IS '目标页面URL'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.task_type IS '任务类型：scrape-单页抓取 crawl-全网爬取'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.status IS '任务状态：pending-等待中 running-进行中 completed-已完成 failed-失败'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.crawl_depth IS '爬取深度，仅crawl类型有效'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.markdown_content IS '抓取结果Markdown内容'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.error_message IS '失败时的错误信息'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.anycrawl_task_id IS 'AnyCrawl返回的任务ID'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.created_at IS '创建时间'`);
    await pool.query(`COMMENT ON COLUMN crawl_task.completed_at IS '完成时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crawl_task_status ON crawl_task (status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crawl_task_created_at ON crawl_task (created_at)`);

    // 数据源域名表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS datasource (
        id BIGSERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        type VARCHAR(16) NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE datasource IS '数据源域名表（白名单/黑名单）'`);
    await pool.query(`COMMENT ON COLUMN datasource.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN datasource.domain IS '域名，不含协议前缀'`);
    await pool.query(`COMMENT ON COLUMN datasource.type IS '类型：trusted-信任域名 blocked-屏蔽域名'`);
    await pool.query(`COMMENT ON COLUMN datasource.created_at IS '创建时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_datasource_domain_type ON datasource (domain, type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_datasource_type ON datasource (type)`);

    // 搜索日志表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_log (
        id BIGSERIAL PRIMARY KEY,
        search_id VARCHAR(32) NOT NULL,
        query VARCHAR(500) NOT NULL,
        mode VARCHAR(16) NOT NULL DEFAULT 'search',
        result_count INT NOT NULL DEFAULT 0,
        elapsed_ms INT NOT NULL DEFAULT 0,
        ip VARCHAR(45) NOT NULL DEFAULT '',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE search_log IS '搜索日志表'`);
    await pool.query(`COMMENT ON COLUMN search_log.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN search_log.search_id IS '搜索唯一标识'`);
    await pool.query(`COMMENT ON COLUMN search_log.query IS '用户搜索关键词'`);
    await pool.query(`COMMENT ON COLUMN search_log.mode IS '搜索模式：search-普通搜索 summarize-URL摘要'`);
    await pool.query(`COMMENT ON COLUMN search_log.result_count IS '返回结果数量'`);
    await pool.query(`COMMENT ON COLUMN search_log.elapsed_ms IS '搜索耗时（毫秒）'`);
    await pool.query(`COMMENT ON COLUMN search_log.ip IS '用户IP地址'`);
    await pool.query(`COMMENT ON COLUMN search_log.created_at IS '搜索时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_search_log_query ON search_log (query)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_search_log_created_at ON search_log (created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_search_log_search_id ON search_log (search_id)`);

    // 用户反馈表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id BIGSERIAL PRIMARY KEY,
        search_id VARCHAR(32) NOT NULL,
        query VARCHAR(500) NOT NULL,
        rating VARCHAR(16) NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE feedback IS '用户反馈表'`);
    await pool.query(`COMMENT ON COLUMN feedback.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN feedback.search_id IS '关联的搜索ID'`);
    await pool.query(`COMMENT ON COLUMN feedback.query IS '关联的搜索关键词'`);
    await pool.query(`COMMENT ON COLUMN feedback.rating IS '评价结果：useful-有用 useless-无用'`);
    await pool.query(`COMMENT ON COLUMN feedback.created_at IS '反馈时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_search_id ON feedback (search_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at)`);

    // 系统配置表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id BIGSERIAL PRIMARY KEY,
        config_key VARCHAR(64) NOT NULL,
        config_value TEXT NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT '',
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE system_config IS '系统配置表（键值对方式存储）'`);
    await pool.query(`COMMENT ON COLUMN system_config.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN system_config.config_key IS '配置键名'`);
    await pool.query(`COMMENT ON COLUMN system_config.config_value IS '配置值（JSON格式存储）'`);
    await pool.query(`COMMENT ON COLUMN system_config.description IS '配置项说明'`);
    await pool.query(`COMMENT ON COLUMN system_config.updated_at IS '最后更新时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_system_config_key ON system_config (config_key)`);

    // 文档分析记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_analysis (
        id BIGSERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL DEFAULT '',
        file_url VARCHAR(500) NOT NULL DEFAULT '',
        file_type VARCHAR(32) NOT NULL DEFAULT '',
        user_input TEXT NOT NULL DEFAULT '',
        llm_result TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE document_analysis IS '文档分析记录表'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.file_name IS '上传文件名'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.file_url IS '文件存储路径'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.file_type IS '文件类型：pdf/docx/txt'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.user_input IS '用户输入的补充文本'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.llm_result IS '大模型分析结果'`);
    await pool.query(`COMMENT ON COLUMN document_analysis.created_at IS '创建时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_document_analysis_created_at ON document_analysis (created_at)`);

    // LLM提示词配置表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS llm_prompts (
        id BIGSERIAL PRIMARY KEY,
        prompt_key VARCHAR(64) NOT NULL,
        prompt_type VARCHAR(16) NOT NULL DEFAULT 'system',
        content TEXT NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT '',
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE llm_prompts IS 'LLM提示词汇总表（约束词、系统提示词统一管理）'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.prompt_key IS '提示词唯一标识，如：search_assistant、skill_system'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.prompt_type IS '提示词类型：system-系统提示 user-用户提示'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.content IS '提示词内容'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.description IS '功能说明'`);
    await pool.query(`COMMENT ON COLUMN llm_prompts.updated_at IS '最后更新时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_llm_prompts_key ON llm_prompts (prompt_key)`);

    // 插入默认LLM提示词
    const promptInsertSql = `
      INSERT INTO llm_prompts (prompt_key, prompt_type, content, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (prompt_key) DO NOTHING
    `;
    await pool.query(promptInsertSql, ['search_assistant', 'system', '你是搜索助手，用中文总结以上内容来回答用户问题。', '搜索回答的系统提示词']);
    await pool.query(promptInsertSql, ['chat_base', 'system', '你是智能AI助手，直接回答用户问题。禁止标题、禁止引导语、禁止末尾寒暄。', '聊天模式的核心系统提示词']);
    await pool.query(promptInsertSql, ['chat_file_rule', 'system', '[要求] 引用文件内容时，请注明来源文件名。', '聊天模式中引用文件时的规则提示']);
    await pool.query(promptInsertSql, ['chat_meta_rule', 'system', '回答时直接切入主题，禁止输出"我了解了"、"已确认"、"正在使用"等元话语。', '聊天模式中禁止元话语的提示词']);
    await pool.query(promptInsertSql, ['skill_system', 'system', '你是专业AI助手，直接输出结果正文。禁止开场白、禁止Markdown标题、禁止末尾互动话语。', '技能执行的系统提示词']);
    await pool.query(promptInsertSql, ['document_system', 'system', `你是文档分析助手。用自然段落直接分析文档内容。
重要规则：
- 第一句必须是陈述分析结论，如"该文档介绍了..."或"文件内容包含..."
- 绝对禁止使用：粗体**、标题##、列表*、分隔线
- 绝对禁止在开头写"根据文档"、"分析如下"、"总结"等引导词
- 绝对禁止在末尾写互动话语或寒暄
- 就像写一篇简短的分析报告，自然连贯地表达`, '文档分析的完整系统提示词']);
    await pool.query(promptInsertSql, ['document_user_prefix', 'user', '请分析：', '文档分析的用户提示前缀']);
    await pool.query(promptInsertSql, ['document_user_fallback', 'user', '请对文档内容进行总结分析', '文档分析用户留空时的默认提示']);
    await pool.query(promptInsertSql, ['model_speed_test', 'user', '请用一句话介绍你自己，不超过20个字。', '模型测速用的固定测试文本']);

    // 技能模板表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skill_template (
        id BIGSERIAL PRIMARY KEY,
        skill_name VARCHAR(64) NOT NULL,
        skill_key VARCHAR(32) NOT NULL,
        prompt_template TEXT NOT NULL,
        description VARCHAR(500) NOT NULL DEFAULT '',
        status SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE skill_template IS '技能模板表'`);
    await pool.query(`COMMENT ON COLUMN skill_template.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN skill_template.skill_name IS '技能名称，如：文本摘要、代码审查'`);
    await pool.query(`COMMENT ON COLUMN skill_template.skill_key IS '技能标识，如：summary、code_review'`);
    await pool.query(`COMMENT ON COLUMN skill_template.prompt_template IS 'Prompt模板，用{inputText}表示用户输入位置'`);
    await pool.query(`COMMENT ON COLUMN skill_template.description IS '技能描述'`);
    await pool.query(`COMMENT ON COLUMN skill_template.status IS '状态：1-启用 0-禁用'`);
    await pool.query(`COMMENT ON COLUMN skill_template.created_at IS '创建时间'`);
    await pool.query(`COMMENT ON COLUMN skill_template.updated_at IS '更新时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_skill_template_skill_key ON skill_template (skill_key)`);

    // 技能执行记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skill_execution (
        id BIGSERIAL PRIMARY KEY,
        skill_id INT NOT NULL,
        user_input TEXT NOT NULL DEFAULT '',
        llm_result TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE skill_execution IS '技能执行记录表'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.skill_id IS '关联的技能模板ID'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.user_input IS '用户输入的文本'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.llm_result IS '大模型执行结果'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.created_at IS '执行时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_skill_execution_skill_id ON skill_execution (skill_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_skill_execution_created_at ON skill_execution (created_at)`);

    // 插入默认技能模板
    const skillInsertSql = `
      INSERT INTO skill_template (skill_name, skill_key, prompt_template, description, status)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (skill_key) DO NOTHING
    `;
    await pool.query(skillInsertSql, ['文本摘要', 'summary', '请对以下内容进行简洁的摘要总结，突出关键要点：\n\n{inputText}', '将长文本总结为简洁摘要']);
    await pool.query(skillInsertSql, ['代码审查', 'code_review', '请对以下代码进行审查，指出潜在问题、优化建议和最佳实践：\n\n{inputText}', '审查代码质量并提供优化建议']);
    await pool.query(skillInsertSql, ['周报生成', 'weekly_report', '请根据以下工作内容生成一份结构化的周报，包括本周完成、下周计划、风险与问题：\n\n{inputText}', '根据工作内容生成周报']);
    await pool.query(skillInsertSql, ['翻译英文', 'translate_en', '请将以下内容翻译为英文，保持原意并确保语法正确：\n\n{inputText}', '将中文翻译为英文']);
    await pool.query(skillInsertSql, ['翻译中文', 'translate_zh', 'Please translate the following content into Chinese, maintaining the original meaning:\n\n{inputText}', '将英文翻译为中文']);
    await pool.query(skillInsertSql, ['自定义Prompt', 'custom', '{inputText}', '直接发送用户输入的内容给大模型']);

    // 用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(64) NOT NULL DEFAULT '',
        avatar VARCHAR(500) NOT NULL DEFAULT '',
        status SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE users IS '用户表'`);
    await pool.query(`COMMENT ON COLUMN users.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN users.username IS '用户名'`);
    await pool.query(`COMMENT ON COLUMN users.password_hash IS '密码哈希'`);
    // 兼容已有表：添加avatar字段（必须在添加注释之前执行）
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) NOT NULL DEFAULT ''`);
    await pool.query(`COMMENT ON COLUMN users.nickname IS '昵称'`);
    await pool.query(`COMMENT ON COLUMN users.avatar IS '头像URL'`);
    await pool.query(`COMMENT ON COLUMN users.status IS '状态：1-正常 0-禁用'`);
    await pool.query(`COMMENT ON COLUMN users.created_at IS '注册时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_users_username ON users (username)`);

    // 用户技能表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_skills (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        skill_name VARCHAR(64) NOT NULL,
        prompt_template TEXT NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE user_skills IS '用户自定义技能表'`);
    await pool.query(`COMMENT ON COLUMN user_skills.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN user_skills.user_id IS '关联用户ID'`);
    await pool.query(`COMMENT ON COLUMN user_skills.skill_name IS '技能名称'`);
    await pool.query(`COMMENT ON COLUMN user_skills.prompt_template IS 'Prompt模板'`);
    await pool.query(`COMMENT ON COLUMN user_skills.created_at IS '创建时间'`);
    await pool.query(`COMMENT ON COLUMN user_skills.updated_at IS '更新时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills (user_id)`);

    // 聊天历史表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        chat_id VARCHAR(64) NOT NULL DEFAULT '',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE chat_history IS '聊天历史表'`);
    await pool.query(`COMMENT ON COLUMN chat_history.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN chat_history.user_id IS '关联用户ID'`);
    await pool.query(`COMMENT ON COLUMN chat_history.role IS '角色：user/assistant/system'`);
    await pool.query(`COMMENT ON COLUMN chat_history.content IS '消息内容'`);
    await pool.query(`COMMENT ON COLUMN chat_history.chat_id IS '会话ID'`);
    await pool.query(`COMMENT ON COLUMN chat_history.created_at IS '创建时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history (user_id, chat_id)`);

    // 兼容已有表：扩展聊天历史支持多模态
    await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS skill_id INT DEFAULT NULL`);
    await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS file_data JSONB DEFAULT NULL`);
    await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(64) DEFAULT NULL`);
    await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS message_type VARCHAR(32) NOT NULL DEFAULT 'text'`);
    await pool.query(`COMMENT ON COLUMN chat_history.skill_id IS '关联技能模板ID'`);
    await pool.query(`COMMENT ON COLUMN chat_history.file_data IS '关联文件数据，JSON格式：[{name, type, status}]'`);
    await pool.query(`COMMENT ON COLUMN chat_history.client_message_id IS '客户端消息去重ID'`);
    await pool.query(`COMMENT ON COLUMN chat_history.message_type IS '消息类型：text-文本 context-纯操作'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_client_msg_id ON chat_history (client_message_id)`);
    await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP(3) DEFAULT NULL`);
    await pool.query(`COMMENT ON COLUMN chat_history.deleted_at IS '用户软删除时间，NULL表示未删除'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_deleted_at ON chat_history (deleted_at)`);

    // 会话状态表（SSOT架构核心）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_state (
        id BIGSERIAL PRIMARY KEY,
        chat_id VARCHAR(64) NOT NULL,
        user_id INT NOT NULL DEFAULT 0,
        active_file_ids INT[] DEFAULT '{}',
        active_skill_id INT DEFAULT NULL,
        last_processed_operation_id VARCHAR(64) DEFAULT NULL,
        message_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE conversation_state IS '会话状态表（SSOT唯一真相源）'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.chat_id IS '会话ID'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.user_id IS '关联用户ID'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.active_file_ids IS '当前活跃文件ID列表'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.active_skill_id IS '当前活跃技能ID'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.last_processed_operation_id IS '最后处理的操作ID，用于断线重连比对'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.message_count IS '已持久化消息总数'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.created_at IS '创建时间'`);
    await pool.query(`COMMENT ON COLUMN conversation_state.updated_at IS '更新时间'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_conversation_state_chat_id ON conversation_state (chat_id)`);

    // 操作日志表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operation_log (
        id BIGSERIAL PRIMARY KEY,
        chat_id VARCHAR(64) NOT NULL,
        operation_type VARCHAR(32) NOT NULL,
        operation_data JSONB NOT NULL DEFAULT '{}',
        client_message_id VARCHAR(64) DEFAULT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE operation_log IS '会话操作日志表'`);
    await pool.query(`COMMENT ON COLUMN operation_log.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN operation_log.chat_id IS '会话ID'`);
    await pool.query(`COMMENT ON COLUMN operation_log.operation_type IS '操作类型：add_file/remove_file/switch_skill/send_text'`);
    await pool.query(`COMMENT ON COLUMN operation_log.operation_data IS '操作数据，JSON格式'`);
    await pool.query(`COMMENT ON COLUMN operation_log.client_message_id IS '关联的客户端消息ID，用于幂等'`);
    await pool.query(`COMMENT ON COLUMN operation_log.status IS '状态：pending/synced/failed'`);
    await pool.query(`COMMENT ON COLUMN operation_log.created_at IS '创建时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_log_chat_id ON operation_log (chat_id, created_at)`);

    // 上传文件记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploaded_file (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL DEFAULT 0,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL DEFAULT '',
        file_type VARCHAR(32) NOT NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        parse_status VARCHAR(16) NOT NULL DEFAULT 'pending',
        parsed_content TEXT DEFAULT NULL,
        file_summary VARCHAR(1000) DEFAULT NULL,
        token_count INT DEFAULT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`COMMENT ON TABLE uploaded_file IS '上传文件记录表'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.id IS '主键ID'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.user_id IS '关联用户ID'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.file_name IS '文件名'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.file_url IS '文件存储路径'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.file_type IS '文件类型：pdf/docx/txt/md等'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.file_size IS '文件大小（字节）'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.parse_status IS '解析状态：pending/parsing/parsed/parse_error'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.parsed_content IS '解析后的文本内容'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.file_summary IS '文件内容摘要'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.token_count IS '文件Token数量估算'`);
    await pool.query(`COMMENT ON COLUMN uploaded_file.created_at IS '上传时间'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uploaded_file_user_id ON uploaded_file (user_id, created_at)`);

    // 给现有表加 user_id 字段
    const addUserId = async (table: string) => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'user_id'`,
        [table]
      );
      if (rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN user_id INT NOT NULL DEFAULT 0`);
      }
    };
    await addUserId('document_analysis');
    await addUserId('skill_execution');
    await pool.query(`COMMENT ON COLUMN document_analysis.user_id IS '关联用户ID'`);
    await pool.query(`COMMENT ON COLUMN skill_execution.user_id IS '关联用户ID'`);

    // 插入默认管理员账号（admin / admin123）
    const passwordHash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO admin_user (username, password_hash, status) VALUES ($1, $2, 1)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', passwordHash]
    );
    console.log('默认管理员账号已就绪：admin / admin123');

    console.log('PostgreSQL 数据库表初始化完成（16张表，全部含中文注释）');
  } catch (err) {
    console.error('数据库初始化失败:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

initDb();
