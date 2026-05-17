/**
 * 服务器启动入口文件
 * 负责启动Express HTTP服务
 */
import { app, PORT } from './app';
import { loadPromptCache } from './services/promptService';

loadPromptCache().then(() => {
  app.listen(PORT, () => {
    console.log(`AI搜索引擎后端服务已启动: http://localhost:${PORT}`);
    console.log(`前台API: http://localhost:${PORT}/api/v1`);
    console.log(`后台API: http://localhost:${PORT}/api/admin/v1`);
  });
});