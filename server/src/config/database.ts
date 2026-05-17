import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

/**
 * PostgreSQL 数据库连接池配置
 * host: 数据库主机地址，默认localhost
 * port: 数据库端口，默认5432
 * user: 数据库用户名，默认postgres
 * password: 数据库密码，默认postgres
 * database: 数据库名，默认a_search
 * max: 连接池最大连接数，默认10
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'a_search',
  max: 10
});

export default pool;
