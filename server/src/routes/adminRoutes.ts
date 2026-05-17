import { Router, Request, Response } from 'express';
import { adminService } from '../services/adminService';
import { skillService } from '../services/skillService';
import { fetchModels, PROVIDERS, testModelSpeed } from '../services/modelService';
import { backupService } from '../services/backupService';
import { qualityService } from '../services/qualityService';
import { getAllPrompts, updatePrompt, refreshCache } from '../services/promptService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    const data = await adminService.login(username, password);
    if (!data) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }
    res.json({ code: 0, message: '登录成功', data });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

router.use(authMiddleware);

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.getDashboard();
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    console.error('获取仪表盘数据失败:', err);
    res.status(500).json({ code: 500, message: '获取数据失败' });
  }
});

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const status = (req.query.status as string) || 'all';
    const data = await adminService.getTasks(page, pageSize, status);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取任务失败' });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { url, taskType, crawlDepth = 2 } = req.body;
    if (!url || !taskType) {
      return res.status(400).json({ code: 400, message: 'URL和任务类型不能为空' });
    }
    const data = await adminService.createTask(url, taskType, crawlDepth);
    res.json({ code: 0, message: '任务已创建', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '创建任务失败' });
  }
});

router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const data = await adminService.getTaskDetail(req.params.taskId);
    if (!data) return res.status(404).json({ code: 404, message: '任务不存在' });
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取任务详情失败' });
  }
});

router.post('/tasks/:taskId/retry', async (req: Request, res: Response) => {
  try {
    await adminService.retryTask(req.params.taskId);
    res.json({ code: 0, message: '任务已重新加入队列' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '重试失败' });
  }
});

router.get('/datasources', async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'trusted';
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const data = await adminService.getDatasources(type, page, pageSize);
  res.json({ code: 0, message: 'success', data });
});

router.post('/datasources', async (req: Request, res: Response) => {
  const { domain, type } = req.body;
  if (!domain || !type) return res.status(400).json({ code: 400, message: '参数不完整' });
  const data = await adminService.addDatasource(domain, type);
  res.json({ code: 0, message: '添加成功', data });
});

router.delete('/datasources/:id', async (req: Request, res: Response) => {
  await adminService.deleteDatasource(Number(req.params.id));
  res.json({ code: 0, message: '删除成功' });
});

router.get('/logs', async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const keyword = (req.query.keyword as string) || '';
  const startDate = (req.query.startDate as string) || '';
  const endDate = (req.query.endDate as string) || '';
  const data = await adminService.getLogs(page, pageSize, keyword, startDate, endDate);
  res.json({ code: 0, message: 'success', data });
});

router.get('/feedbacks', async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const data = await adminService.getFeedbacks(page, pageSize);
  res.json({ code: 0, message: 'success', data });
});

router.get('/settings', async (_req: Request, res: Response) => {
  const data = await adminService.getSettings();
  res.json({ code: 0, message: 'success', data });
});

router.put('/settings', async (req: Request, res: Response) => {
  await adminService.saveSettings(req.body);
  res.json({ code: 0, message: '配置已保存' });
});

router.get('/models/providers', (_req: Request, res: Response) => {
  res.json({
    code: 0, message: 'success',
    data: PROVIDERS.map(p => ({
      id: p.id, name: p.name, label: p.label,
      defaultBaseUrl: p.defaultBaseUrl, defaultModel: p.defaultModel
    }))
  });
});

router.post('/models/fetch', async (req: Request, res: Response) => {
  try {
    const { providerId, apiKey, baseUrl } = req.body;
    if (!providerId || !apiKey) {
      return res.status(400).json({ code: 400, message: '供应商和API Key不能为空' });
    }
    const models = await fetchModels(providerId, apiKey, baseUrl);
    res.json({ code: 0, message: 'success', data: { models } });
  } catch (err: any) {
    console.error('获取模型列表失败:', err.message);
    res.status(500).json({ code: 500, message: '获取模型列表失败: ' + err.message });
  }
});

router.post('/models/test-speed', async (req: Request, res: Response) => {
  try {
    const { providerId, apiKey, modelId, baseUrl } = req.body;
    if (!providerId || !apiKey || !modelId) {
      return res.status(400).json({ code: 400, message: '供应商、API Key 和模型ID不能为空' });
    }
    const result = await testModelSpeed(providerId, apiKey, modelId, baseUrl);
    res.json({ code: 0, message: 'success', data: result });
  } catch (err: any) {
    console.error('模型测速失败:', err.message);
    res.status(500).json({ code: 500, message: '测速失败: ' + err.message });
  }
});

router.get('/skills', async (_req: Request, res: Response) => {
  try {
    const data = await skillService.getSkillTemplates();
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取技能模板失败' });
  }
});

router.post('/skills', async (req: Request, res: Response) => {
  try {
    const { skillName, skillKey, promptTemplate, description } = req.body;
    if (!skillName || !skillKey || !promptTemplate) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    const data = await skillService.createSkillTemplate({ skillName, skillKey, promptTemplate, description: description || '' });
    res.json({ code: 0, message: '创建成功', data });
  } catch (err: any) {
    if (err.message?.includes('duplicate key')) {
      return res.status(400).json({ code: 400, message: '技能标识已存在' });
    }
    res.status(500).json({ code: 500, message: '创建失败' });
  }
});

router.put('/skills/:id', async (req: Request, res: Response) => {
  try {
    await skillService.updateSkillTemplate(Number(req.params.id), req.body);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

router.delete('/skills/:id', async (req: Request, res: Response) => {
  try {
    await skillService.deleteSkillTemplate(Number(req.params.id));
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.get('/skill-executions', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const data = await skillService.getSkillExecutions(page, pageSize);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取执行记录失败' });
  }
});

router.delete('/skill-executions/:id', async (req: Request, res: Response) => {
  try {
    await skillService.deleteSkillExecution(Number(req.params.id));
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.get('/documents', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const data = await skillService.getDocumentAnalysis(page, pageSize);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取文档分析记录失败' });
  }
});

router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    await skillService.deleteDocumentAnalysis(Number(req.params.id));
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const keyword = (req.query.keyword as string) || '';
    const data = await adminService.getUsers(page, pageSize, keyword);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
});

router.put('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 0 && status !== 1) return res.status(400).json({ code: 400, message: '状态值无效' });
    await adminService.updateUserStatus(Number(req.params.id), status);
    res.json({ code: 0, message: '状态更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    await adminService.deleteUser(Number(req.params.id));
    res.json({ code: 0, message: '用户已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.get('/chat-history', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const userId = (req.query.userId as string) || '';
    const keyword = (req.query.keyword as string) || '';
    const data = await adminService.getChatHistory(page, pageSize, userId, keyword);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取聊天记录失败' });
  }
});

router.get('/user-skills', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const data = await adminService.getUserSkills(page, pageSize);
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取用户技能失败' });
  }
});

router.delete('/user-skills/:id', async (req: Request, res: Response) => {
  try {
    await adminService.deleteUserSkill(Number(req.params.id));
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.post('/backup', async (req: Request, res: Response) => {
  try {
    const result = await backupService.createBackup();
    if (result.success) {
      res.json({ code: 0, message: result.message, data: result });
    } else {
      res.status(500).json({ code: 500, message: result.message });
    }
  } catch (err: any) {
    console.error('创建备份失败:', err.message);
    res.status(500).json({ code: 500, message: '创建备份失败: ' + err.message });
  }
});

router.get('/backup', async (_req: Request, res: Response) => {
  try {
    const backups = await backupService.getBackups();
    res.json({ code: 0, message: 'success', data: backups });
  } catch (err: any) {
    console.error('获取备份列表失败:', err.message);
    res.status(500).json({ code: 500, message: '获取备份列表失败: ' + err.message });
  }
});

router.get('/backup/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await backupService.getBackupStats();
    res.json({ code: 0, message: 'success', data: stats });
  } catch (err: any) {
    console.error('获取备份统计失败:', err.message);
    res.status(500).json({ code: 500, message: '获取备份统计失败: ' + err.message });
  }
});

router.get('/backup/:backupId', async (req: Request, res: Response) => {
  try {
    const backup = await backupService.getBackupDetail(req.params.backupId);
    if (!backup) {
      return res.status(404).json({ code: 404, message: '备份不存在' });
    }
    res.json({ code: 0, message: 'success', data: backup });
  } catch (err: any) {
    console.error('获取备份详情失败:', err.message);
    res.status(500).json({ code: 500, message: '获取备份详情失败: ' + err.message });
  }
});

router.get('/backup/:backupId/download', async (req: Request, res: Response) => {
  try {
    const result = await backupService.downloadBackup(req.params.backupId);
    if (!result.success) {
      return res.status(404).json({ code: 404, message: result.message });
    }
    res.setHeader('Content-Type', 'text/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.content);
  } catch (err: any) {
    console.error('下载备份失败:', err.message);
    res.status(500).json({ code: 500, message: '下载备份失败: ' + err.message });
  }
});

router.post('/backup/:backupId/restore', async (req: Request, res: Response) => {
  try {
    const result = await backupService.restoreBackup(req.params.backupId);
    if (result.success) {
      res.json({ code: 0, message: result.message });
    } else {
      res.status(500).json({ code: 500, message: result.message });
    }
  } catch (err: any) {
    console.error('恢复备份失败:', err.message);
    res.status(500).json({ code: 500, message: '恢复备份失败: ' + err.message });
  }
});

router.delete('/backup/:backupId', async (req: Request, res: Response) => {
  try {
    const result = await backupService.deleteBackup(req.params.backupId);
    if (result.success) {
      res.json({ code: 0, message: result.message });
    } else {
      res.status(404).json({ code: 404, message: result.message });
    }
  } catch (err: any) {
    console.error('删除备份失败:', err.message);
    res.status(500).json({ code: 500, message: '删除备份失败: ' + err.message });
  }
});

router.get('/quality', async (_req: Request, res: Response) => {
  try {
    const data = qualityService.getOverview();
    res.json({ code: 0, message: 'success', data });
  } catch (err: any) {
    console.error('获取质量数据失败:', err.message);
    res.status(500).json({ code: 500, message: '获取质量数据失败' });
  }
});

router.get('/quality/issues', async (_req: Request, res: Response) => {
  try {
    const issues = qualityService.getIssues();
    res.json({ code: 0, message: 'success', data: issues });
  } catch (err: any) {
    console.error('获取质量问题失败:', err.message);
    res.status(500).json({ code: 500, message: '获取质量问题失败' });
  }
});

router.post('/quality/audit', async (_req: Request, res: Response) => {
  try {
    const data = qualityService.runAudit();
    res.json({ code: 0, message: '审计完成', data });
  } catch (err: any) {
    console.error('执行质量审计失败:', err.message);
    res.status(500).json({ code: 500, message: '审计失败' });
  }
});

router.get('/prompts', async (_req: Request, res: Response) => {
  try {
    const data = await getAllPrompts();
    res.json({ code: 0, message: 'success', data });
  } catch (err: any) {
    console.error('获取提示词列表失败:', err.message);
    res.status(500).json({ code: 500, message: '获取提示词失败' });
  }
});

router.put('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ code: 400, message: '提示词内容不能为空' });
    }
    await updatePrompt(Number(req.params.id), content);
    res.json({ code: 0, message: '更新成功' });
  } catch (err: any) {
    console.error('更新提示词失败:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

router.post('/prompts/refresh', async (_req: Request, res: Response) => {
  try {
    await refreshCache();
    res.json({ code: 0, message: '缓存已刷新' });
  } catch (err: any) {
    console.error('刷新缓存失败:', err.message);
    res.status(500).json({ code: 500, message: '刷新失败' });
  }
});

export default router;