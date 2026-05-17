import { Router, Request, Response } from 'express';
import multer from 'multer';
import { userService } from '../services/userService';

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的图片格式: ${ext}`));
    }
  }
});

function getUserFromReq(req: Request) {
  return (req as any).user as { id: number; username: string } | undefined;
}

const userAuth = (req: Request, res: Response, next: Function) => {
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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = getJwtSecret();
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    if (decoded.type !== 'user') return res.status(401).json({ code: 401, message: '请使用用户账号登录' });
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
};

router.post('/register', async (req: Request, res: Response) => {
  const { username, password, nickname } = req.body;
  const result = await userService.register(username, password, nickname);
  if (result.code !== 0) return res.status(400).json(result);
  res.json(result);
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await userService.login(username, password);
  if (result.code !== 0) return res.status(400).json(result);
  res.json(result);
});

router.get('/info', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const result = await userService.getUserInfo(user.id);
  res.json(result);
});

router.get('/skills', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const data = await userService.getUserSkills(user.id);
  res.json({ code: 0, data });
});

router.post('/skills', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { skillName, promptTemplate } = req.body;
  if (!skillName || !promptTemplate) return res.status(400).json({ code: 400, message: '参数不完整' });
  const data = await userService.createUserSkill(user.id, skillName, promptTemplate);
  res.json({ code: 0, data });
});

router.put('/skills/:id', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { skillName, promptTemplate } = req.body;
  await userService.updateUserSkill(user.id, Number(req.params.id), skillName, promptTemplate);
  res.json({ code: 0, message: '更新成功' });
});

router.delete('/skills/:id', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  await userService.deleteUserSkill(user.id, Number(req.params.id));
  res.json({ code: 0, message: '删除成功' });
});

router.get('/chat/history', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const data = await userService.getChatHistory(user.id);
  res.json({ code: 0, data });
});

router.get('/chat/history/:chatId', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const data = await userService.getChatMessages(user.id, req.params.chatId);
  res.json({ code: 0, data });
});

router.post('/chat/save', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { chatId, role, content } = req.body;
  await userService.saveChatMessage(user.id, chatId, role, content);
  res.json({ code: 0 });
});

router.delete('/chat/history', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const chatId = req.query.chatId as string | undefined;
  await userService.deleteChatHistory(user.id, chatId);
  res.json({ code: 0, message: '删除成功' });
});

router.get('/profile', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const result = await userService.getUserProfile(user.id);
  res.json(result);
});

router.put('/profile', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { nickname } = req.body;
  const result = await userService.updateProfile(user.id, nickname);
  if (result.code !== 0) return res.status(400).json(result);
  res.json(result);
});

router.put('/password', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { oldPassword, newPassword } = req.body;
  const result = await userService.changePassword(user.id, oldPassword, newPassword);
  if (result.code !== 0) return res.status(400).json(result);
  res.json(result);
});

router.post('/avatar', userAuth, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const user = getUserFromReq(req)!;
    if (!req.file) return res.status(400).json({ code: 400, message: '请选择头像图片' });
    const result = await userService.uploadAvatar(user.id, req.file);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('不支持的图片格式')) {
      return res.status(400).json({ code: 400, message: err.message });
    }
    res.status(500).json({ code: 500, message: '头像上传失败' });
  }
});

router.delete('/account', userAuth, async (req: Request, res: Response) => {
  const user = getUserFromReq(req)!;
  const { password } = req.body;
  const result = await userService.deleteAccount(user.id, password);
  if (result.code !== 0) return res.status(400).json(result);
  res.json(result);
});

export default router;