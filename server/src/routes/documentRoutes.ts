import { Router, Request, Response } from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['pdf', 'docx', 'txt', 'md', 'json', 'csv', 'html', 'xml'];
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

const pendingDocs = new Map<string, { fileText: string; userInput: string; fileName: string; fileUrl: string; fileType: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingDocs) {
    if (now - value.createdAt > 30 * 60 * 1000) pendingDocs.delete(key);
  }
}, 5 * 60 * 1000);

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userInput = req.body.userInput || '';

    if (!req.file && !userInput) {
      return res.status(400).json({ code: 400, message: '请上传文件或输入文本内容' });
    }

    let fileText = '';
    let fileName = '';
    let fileUrl = '';
    let fileType = '';

    if (req.file) {
      const saved = documentService.saveFile(req.file);
      fileName = saved.fileName;
      fileUrl = saved.fileUrl;
      fileType = saved.fileType;
      fileText = await documentService.extractText(saved.filePath, fileType);
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    pendingDocs.set(docId, { fileText, userInput, fileName, fileUrl, fileType, createdAt: Date.now() });

    res.json({ code: 0, message: 'success', data: { docId, fileName, fileType, fileText } });
  } catch (err: any) {
    console.error('文档上传失败:', err);
    if (err.message?.includes('不支持的文件类型')) {
      return res.status(400).json({ code: 400, message: err.message });
    }
    res.status(500).json({ code: 500, message: '文档上传失败' });
  }
});

router.get('/analyze/stream', (req: Request, res: Response) => {
  const docId = req.query.docId as string;
  let fileText = '';
  let userInput = '';
  let fileName = '';
  let fileUrl = '';
  let fileType = '';

  if (docId && pendingDocs.has(docId)) {
    const doc = pendingDocs.get(docId)!;
    fileText = doc.fileText;
    userInput = doc.userInput;
    fileName = doc.fileName;
    fileUrl = doc.fileUrl;
    fileType = doc.fileType;
    pendingDocs.delete(docId);
  } else {
    fileText = req.query.fileText as string || '';
    userInput = req.query.userInput as string || '';
    fileName = req.query.fileName as string || '';
    fileUrl = req.query.fileUrl as string || '';
    fileType = req.query.fileType as string || '';
  }

  if (!fileText && !userInput) {
    return res.status(400).json({ code: 400, message: '参数不完整' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(`event: start\ndata: ${JSON.stringify({})}\n\n`);

  documentService.analyzeDocumentStream(
    fileText,
    userInput,
    (text) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    (fullText) => {
      documentService.saveAnalysisRecord(fileName, fileUrl, fileType, userInput, fullText).catch(() => {});
      res.write(`event: done\ndata: ${JSON.stringify({ fullText })}\n\n`);
      res.end();
    }
  );
});

export default router;
