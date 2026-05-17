import axios from 'axios';
import pool from '../config/database';
import fs from 'fs';
import path from 'path';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { LLM_DEFAULTS, SCRAPER, TIMEOUTS } from '../config/providers';
import { getPrompt } from './promptService';

async function getActiveLLMConfig() {
  try {
    const { rows } = await pool.query("SELECT config_value FROM system_config WHERE config_key = 'llm_config'");
    if (rows.length === 0) return null;
    const config = JSON.parse(rows[0].config_value);
    if (!config.activeProviderId || !config.providers) return null;
    const provider = config.providers.find((p: any) => p.id === config.activeProviderId);
    if (!provider || !provider.selectedModel) return null;
    return {
      baseUrl: provider.baseUrl || '',
      apiKey: provider.apiKey || '',
      model: provider.selectedModel,
      temperature: provider.temperature ?? LLM_DEFAULTS.temperature,
      maxTokens: provider.maxTokens || LLM_DEFAULTS.maxTokens
    };
  } catch {
    return null;
  }
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_TEXT_LENGTH = SCRAPER.maxTextLength;

export const documentService = {
  saveFile(file: Express.Multer.File) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    fs.writeFileSync(filePath, file.buffer);
    return {
      fileName: file.originalname,
      fileUrl: `/uploads/${uniqueName}`,
      fileType: ext.replace('.', ''),
      filePath
    };
  },

  async extractText(filePath: string, fileType: string): Promise<string> {
    try {
      if (fileType === 'txt' || fileType === 'md') {
        return fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT_LENGTH);
      }
      if (fileType === 'json') {
        const content = fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT_LENGTH);
        JSON.parse(content);
        return content;
      }
      if (fileType === 'csv') {
        return fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT_LENGTH);
      }
      if (fileType === 'html' || fileType === 'xml') {
        return fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT_LENGTH);
      }
      if (fileType === 'pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await (pdfParse as any).default(dataBuffer);
        return data.text.substring(0, MAX_TEXT_LENGTH);
      }
      if (fileType === 'docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value.substring(0, MAX_TEXT_LENGTH);
      }
      return `[文件: ${path.basename(filePath)}，类型: ${fileType}]`;
    } catch (err) {
      console.error('提取文本失败:', err);
      return `[文件: ${path.basename(filePath)}，类型: ${fileType}，文本提取失败]`;
    }
  },

  async buildPrompt(fileText: string, userInput: string): Promise<{ systemPrompt: string; userPrompt: string }> {
    const systemPrompt = await getPrompt('document_system');
    const userPrefix = await getPrompt('document_user_prefix');
    const userFallback = await getPrompt('document_user_fallback');

    const userPrompt = `以下是要分析的文档内容：\n\n${fileText}\n\n${userPrefix}${userInput || userFallback}`;

    return { systemPrompt, userPrompt };
  },

  async analyzeDocument(fileText: string, userInput: string): Promise<string> {
    const { systemPrompt, userPrompt } = await documentService.buildPrompt(fileText, userInput);
    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
      return '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置中配置模型。';
    }
    try {
      const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens
      }, {
        headers: {
          'Authorization': `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: TIMEOUTS.documentAnalyze
      });
      return response.data.choices?.[0]?.message?.content || '';
    } catch {
      return '⚠️ LLM服务连接失败，请检查网络或稍后重试。';
    }
  },

  async analyzeDocumentStream(fileText: string, userInput: string, onChunk: (text: string) => void, onFinish: (fullText: string) => void): Promise<void> {
    const { systemPrompt, userPrompt } = await documentService.buildPrompt(fileText, userInput);
    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig || !llmConfig.baseUrl || !llmConfig.model) {
      const msg = '⚠️ 未配置LLM模型，请在后台管理系统 → 系统配置中配置模型。';
      onChunk(msg);
      onFinish(msg);
      return;
    }
    try {
      const response = await axios.post(`${llmConfig.baseUrl}/chat/completions`, {
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens,
        stream: true
      }, {
        headers: {
          'Authorization': `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: TIMEOUTS.documentAnalyze
      });

      let fullText = '';
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              onFinish(fullText);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch {}
          }
        }
      });
      response.data.on('end', () => { if (fullText) onFinish(fullText); });
      response.data.on('error', () => {
        if (!fullText) { onChunk('⚠️ AI请求失败，请重试。'); onFinish('⚠️ AI请求失败，请重试。'); }
      });
    } catch {
      const msg = '⚠️ AI服务连接失败，请检查网络或稍后重试。';
      onChunk(msg);
      onFinish(msg);
    }
  },

  async saveAnalysisRecord(fileName: string, fileUrl: string, fileType: string, userInput: string, llmResult: string) {
    await pool.query(
      'INSERT INTO document_analysis (file_name, file_url, file_type, user_input, llm_result) VALUES ($1, $2, $3, $4, $5)',
      [fileName, fileUrl, fileType, userInput, llmResult]
    );
  }
};
