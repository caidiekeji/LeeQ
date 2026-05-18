/**
 * JWT配置模块（唯一真相源）
 * 所有模块统一从此处获取JWT密钥和过期时间配置
 */

/** 获取JWT签名密钥 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
    }
    console.warn('⚠ 未设置 JWT_SECRET 环境变量，使用开发默认密钥，生产环境请务必设置！');
    return 'dev-jwt-secret-do-not-use-in-production';
  }
  return secret;
}

/** JWT签名密钥 */
export const JWT_SECRET = getJwtSecret();

/** JWT过期时间（秒） */
export const JWT_EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 86400;