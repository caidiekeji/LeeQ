import pool from '../config/database';
import fs from 'fs';
import path from 'path';

// 备份目录配置
const BACKUP_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 30;

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * 数据库备份服务
 * 提供专业的数据库备份、恢复、清理功能
 */
export const backupService = {
  /**
   * 创建数据库备份
   * @returns 备份信息
   */
  async createBackup(): Promise<BackupResult> {
    try {
      const backupId = generateBackupId();
      const timestamp = new Date().toISOString();
      const filePath = path.join(BACKUP_DIR, `${backupId}.sql`);

      // 获取所有表名
      const tableResult = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tables = tableResult.rows.map((r: any) => r.table_name);

      // 生成备份内容
      let backupContent = `-- LeeQ AI Search 数据库备份\n-- 备份时间: ${timestamp}\n-- 备份ID: ${backupId}\n\n`;

      // 遍历每个表进行备份
      for (const table of tables) {
        // 获取表结构
        const createTableSql = await this.getCreateTableSQL(table);
        backupContent += `-- 表结构: ${table}\n${createTableSql};\n\n`;

        // 获取表数据
        const dataResult = await pool.query(`SELECT * FROM ${table}`);
        if (dataResult.rows.length > 0) {
          const columns = Object.keys(dataResult.rows[0]).join(', ');
          const values = dataResult.rows.map((row: any) => {
            const rowValues = Object.values(row).map((v: any) => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              if (v instanceof Date) return `'${v.toISOString()}'`;
              return String(v);
            }).join(', ');
            return `(${rowValues})`;
          }).join(',\n');
          backupContent += `INSERT INTO ${table} (${columns}) VALUES\n${values};\n\n`;
        }
      }

      // 写入备份文件
      await fs.promises.writeFile(filePath, backupContent, 'utf-8');

      // 获取文件大小
      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;

      // 记录到数据库
      await pool.query(
        `INSERT INTO backups (backup_id, file_path, file_size, status) 
         VALUES ($1, $2, $3, $4)`,
        [backupId, filePath, fileSize, 'completed']
      );

      // 清理过期备份
      await this.cleanupOldBackups();

      return {
        success: true,
        backupId,
        timestamp,
        fileSize,
        message: '备份创建成功'
      };
    } catch (error: any) {
      console.error('创建备份失败:', error.message);
      return {
        success: false,
        backupId: '',
        timestamp: '',
        fileSize: 0,
        message: `备份失败: ${error.message}`
      };
    }
  },

  /**
   * 获取备份列表
   * @returns 备份列表
   */
  async getBackups(): Promise<BackupInfo[]> {
    try {
      const result = await pool.query(
        'SELECT * FROM backups ORDER BY created_at DESC'
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        backupId: row.backup_id,
        fileName: path.basename(row.file_path),
        fileSize: row.file_size,
        status: row.status,
        createdAt: row.created_at,
        restoredAt: row.restored_at
      }));
    } catch (error: any) {
      console.error('获取备份列表失败:', error.message);
      return [];
    }
  },

  /**
   * 获取备份详情
   * @param backupId 备份ID
   * @returns 备份详情
   */
  async getBackupDetail(backupId: string): Promise<BackupInfo | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM backups WHERE backup_id = $1',
        [backupId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        backupId: row.backup_id,
        fileName: path.basename(row.file_path),
        fileSize: row.file_size,
        status: row.status,
        createdAt: row.created_at,
        restoredAt: row.restored_at
      };
    } catch (error: any) {
      console.error('获取备份详情失败:', error.message);
      return null;
    }
  },

  /**
   * 下载备份文件
   * @param backupId 备份ID
   * @returns 文件内容和文件名
   */
  async downloadBackup(backupId: string): Promise<DownloadResult> {
    try {
      const result = await pool.query(
        'SELECT file_path FROM backups WHERE backup_id = $1',
        [backupId]
      );
      if (result.rows.length === 0) {
        return { success: false, content: '', fileName: '', message: '备份不存在' };
      }

      const filePath = result.rows[0].file_path;
      if (!fs.existsSync(filePath)) {
        return { success: false, content: '', fileName: '', message: '备份文件已不存在' };
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      return { success: true, content, fileName, message: '下载成功' };
    } catch (error: any) {
      console.error('下载备份失败:', error.message);
      return { success: false, content: '', fileName: '', message: `下载失败: ${error.message}` };
    }
  },

  /**
   * 恢复数据库备份
   * @param backupId 备份ID
   * @returns 恢复结果
   */
  async restoreBackup(backupId: string): Promise<RestoreResult> {
    try {
      const result = await pool.query(
        'SELECT file_path FROM backups WHERE backup_id = $1',
        [backupId]
      );
      if (result.rows.length === 0) {
        return { success: false, message: '备份不存在' };
      }

      const filePath = result.rows[0].file_path;
      if (!fs.existsSync(filePath)) {
        return { success: false, message: '备份文件已不存在' };
      }

      // 读取备份内容
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // 用状态机分割SQL语句（处理字符串内的分号）
      const statements = splitSqlStatements(content).filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });

      // 开始事务
      await pool.query('BEGIN');

      try {
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (trimmed.length > 0) {
            await pool.query(trimmed);
          }
        }

        // 提交事务
        await pool.query('COMMIT');

        // 更新备份记录
        await pool.query(
          'UPDATE backups SET restored_at = NOW(), status = $1 WHERE backup_id = $2',
          ['restored', backupId]
        );

        return { success: true, message: '恢复成功' };
      } catch (error: any) {
        // 回滚事务
        await pool.query('ROLLBACK');
        console.error('恢复失败，已回滚:', error.message);
        return { success: false, message: `恢复失败: ${error.message}` };
      }
    } catch (error: any) {
      console.error('恢复备份失败:', error.message);
      return { success: false, message: `恢复失败: ${error.message}` };
    }
  },

  /**
   * 删除备份
   * @param backupId 备份ID
   * @returns 删除结果
   */
  async deleteBackup(backupId: string): Promise<DeleteResult> {
    try {
      const result = await pool.query(
        'SELECT file_path FROM backups WHERE backup_id = $1',
        [backupId]
      );
      if (result.rows.length === 0) {
        return { success: false, message: '备份不存在' };
      }

      const filePath = result.rows[0].file_path;

      // 删除文件
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      // 删除数据库记录
      await pool.query('DELETE FROM backups WHERE backup_id = $1', [backupId]);

      return { success: true, message: '删除成功' };
    } catch (error: any) {
      console.error('删除备份失败:', error.message);
      return { success: false, message: `删除失败: ${error.message}` };
    }
  },

  /**
   * 清理过期备份
   * 保留最近MAX_BACKUPS个备份
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      // 获取超过保留数量的旧备份
      const result = await pool.query(
        `SELECT backup_id, file_path FROM backups 
         ORDER BY created_at DESC OFFSET ${MAX_BACKUPS}`
      );

      for (const row of result.rows) {
        // 删除文件
        if (fs.existsSync(row.file_path)) {
          await fs.promises.unlink(row.file_path);
        }
        // 删除数据库记录
        await pool.query('DELETE FROM backups WHERE backup_id = $1', [row.backup_id]);
      }
    } catch (error: any) {
      console.error('清理旧备份失败:', error.message);
    }
  },

  /**
   * 获取备份统计信息
   * @returns 统计信息
   */
  async getBackupStats(): Promise<BackupStats> {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_count,
          SUM(file_size) as total_size,
          MAX(created_at) as last_backup_time
         FROM backups`
      );
      const row = result.rows[0];
      return {
        totalCount: parseInt(row.total_count) || 0,
        totalSize: parseInt(row.total_size) || 0,
        lastBackupTime: row.last_backup_time || null
      };
    } catch (error: any) {
      console.error('获取备份统计失败:', error.message);
      return { totalCount: 0, totalSize: 0, lastBackupTime: null };
    }
  },

  /**
   * 获取CREATE TABLE语句（兼容所有PostgreSQL版本）
   * @param tableName 表名
   * @returns CREATE TABLE SQL语句
   */
  async getCreateTableSQL(tableName: string): Promise<string> {
    try {
      // 获取列信息
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const columns = columnsResult.rows;
      let createSQL = `CREATE TABLE ${tableName} (`;

      const columnDefinitions: string[] = [];
      for (const col of columns) {
        let def = `"${col.column_name}" ${col.data_type}`;
        
        // 添加长度限制
        if (col.character_maximum_length && (col.data_type === 'character varying' || col.data_type === 'character')) {
          def += `(${col.character_maximum_length})`;
        }
        
        // 添加NOT NULL约束
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        // 添加默认值
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefinitions.push(def);
      }

      // 获取主键信息
      const pkResult = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = $1 
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [tableName]);

      if (pkResult.rows.length > 0) {
        const pkColumns = pkResult.rows.map((r: any) => `"${r.column_name}"`).join(', ');
        columnDefinitions.push(`PRIMARY KEY (${pkColumns})`);
      }

      createSQL += columnDefinitions.join(', ');
      createSQL += ')';

      return createSQL;
    } catch (error: any) {
      console.error(`获取表结构失败 ${tableName}:`, error.message);
      return `CREATE TABLE ${tableName} ()`;
    }
  },

  /**
   * 检查备份表是否存在，不存在则创建
   */
  async ensureBackupTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS backups (
          id SERIAL PRIMARY KEY,
          backup_id VARCHAR(50) UNIQUE NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'completed',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          restored_at TIMESTAMP
        )
      `);
    } catch (error: any) {
      console.error('创建备份表失败:', error.message);
    }
  }
};

// 类型定义
interface BackupResult {
  success: boolean;
  backupId: string;
  timestamp: string;
  fileSize: number;
  message: string;
}

interface BackupInfo {
  id: number;
  backupId: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  restoredAt: string | null;
}

interface DownloadResult {
  success: boolean;
  content: string;
  fileName: string;
  message: string;
}

interface RestoreResult {
  success: boolean;
  message: string;
}

interface DeleteResult {
  success: boolean;
  message: string;
}

interface BackupStats {
  totalCount: number;
  totalSize: number;
  lastBackupTime: string | null;
}

// 生成备份ID
function generateBackupId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `backup_${timestamp}_${random}`;
}

/**
 * 用状态机分割SQL语句（正确处理字符串内的分号）
 * @param sql SQL内容
 * @returns SQL语句数组
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }
    } else if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === ';') {
      statements.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) statements.push(current);
  return statements;
}

// 初始化备份表
backupService.ensureBackupTable().catch(console.error);