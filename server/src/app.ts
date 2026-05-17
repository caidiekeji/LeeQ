/**
 * Express应用配置文件
 * 负责配置中间件、路由注册、错误处理等
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import searchRoutes from './routes/searchRoutes';
import adminRoutes from './routes/adminRoutes';
import skillRoutes from './routes/skillRoutes';
import documentRoutes from './routes/documentRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use('/api/v1', searchRoutes);
app.use('/api/admin/v1', adminRoutes);
app.use('/api/v1', skillRoutes);
app.use('/api/v1/document', documentRoutes);
app.use('/api/v1/user', userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running', uptime: process.uptime() } });
});

app.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

export { app, PORT };