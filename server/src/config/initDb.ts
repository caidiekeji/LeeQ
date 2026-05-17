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

    // ... (省略中间建表代码，完整版已在本地)
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