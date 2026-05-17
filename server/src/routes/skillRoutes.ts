import { Router, Request, Response } from 'express';
import { skillService } from '../services/skillService';

const router = Router();

/**
 * GET /api/v1/skills - 获取所有启用的技能列表（用户端）
 */
router.get('/skills', async (_req: Request, res: Response) => {
  try {
    const data = await skillService.listSkills();
    res.json({ code: 0, message: 'success', data });
  } catch (err) {
    console.error('获取技能列表失败:', err);
    res.status(500).json({ code: 500, message: '获取技能列表失败' });
  }
});

/**
 * POST /api/v1/skills/execute - 执行技能（非流式）
 */
router.post('/skills/execute', async (req: Request, res: Response) => {
  try {
    const { skillId, inputText } = req.body;
    if (!skillId || !inputText) {
      return res.status(400).json({ code: 400, message: '技能ID和输入内容不能为空' });
    }
    if (inputText.length > 10000) {
      return res.status(400).json({ code: 400, message: '输入内容过长，请精简后重试' });
    }
    const data = await skillService.executeSkill(skillId, inputText);
    res.json({ code: 0, message: 'success', data: { result: data } });
  } catch (err) {
    console.error('执行技能失败:', err);
    res.status(500).json({ code: 500, message: '执行技能失败' });
  }
});

/**
 * GET /api/v1/skills/execute/stream - 流式执行技能（SSE）
 * 支持 source=user 时使用自定义 Prompt 模板
 */
router.get('/skills/execute/stream', (req: Request, res: Response) => {
  const skillId = req.query.skillId as string;
  const inputText = req.query.inputText as string;
  const source = req.query.source as string;
  const customPrompt = req.query.prompt as string;
  const fileContext = req.query.fileContext as string || '';

  if (!source && (!skillId || !inputText)) {
    return res.status(400).json({ code: 400, message: '参数不完整' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(`event: start\ndata: ${JSON.stringify({})}\n\n`);

  if (source === 'user' && customPrompt) {
    const promptWithFile = fileContext ? customPrompt + '\n\n' + fileContext : customPrompt;
    skillService.executeSkillStreamWithPrompt(
      promptWithFile,
      (text) => {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
      },
      (fullText) => {
        res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
        res.end();
      }
    );
  } else {
    skillService.executeSkillStream(
      Number(skillId),
      inputText,
      (text) => {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
      },
      (fullText) => {
        res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
        res.end();
      },
      fileContext
    );
  }
});

export default router;