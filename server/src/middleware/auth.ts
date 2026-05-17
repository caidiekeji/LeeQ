import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/** JWT签名密钥：优先使用环境变量，否则使用默认值 */
const JWT_SECRET = process.env.JWT_SECRET || 'ai-search-jwt-secret-key-2026';

/**
 * JWT认证中间件
 * 从请求头Authorization中提取Bearer Token，校验合法性后将用户信息挂载到req.adminUser
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    (req as any).adminUser = decoded;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
};