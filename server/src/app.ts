/**
 * Express应用配置文件
 * 负责配置中间件、路由注册、错误处理等
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import searchRoutes from './routes/searchRoutes';      // 前台搜索路由
import adminRoutes from './routes/adminRoutes';        // 后台管理路由
import skillRoutes from './routes/skillRoutes';        // 技能执行路由
import documentRoutes from './routes/documentRoutes';  // 文档分析路由
import userRoutes from './routes/userRoutes';          // 用户路由

dotenv.config();  // 加载环境变量

const app = express();
const PORT = Number(process.env.PORT) || 3001;  // 服务端口，默认3001

// 中间件配置
app.use(cors());                                      // 跨域资源共享
app.use(express.json({ limit: '10mb' }));             // JSON请求体解析（限制10MB）
app.use(express.urlencoded({ extended: true }));      // URL编码请求体解析

// 设置响应编码为UTF-8
app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 静态文件服务 - 生产环境下托管前端构建产物
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));     // 上传文件访问

// 路由注册（按模块分组）
app.use('/api/v1', searchRoutes);                     // 前台搜索API
app.use('/api/admin/v1', adminRoutes);                // 后台管理API
app.use('/api/v1', skillRoutes);                      // 技能执行API
app.use('/api/v1/document', documentRoutes);             // 文档分析API
app.use('/api/v1/user', userRoutes);                  // 用户API

/**
 * 健康检查接口 - 用于负载均衡器或监控系统检测服务状态
 */
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running', uptime: process.uptime() } });
});

/**
 * 404处理 - 捕获所有未匹配的路由
 */
app.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

/**
 * 全局错误处理中间件
 * 捕获所有未处理的异常，返回统一的错误响应格式
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

export { app, PORT };
