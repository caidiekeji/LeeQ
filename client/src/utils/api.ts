// API请求基础路径（空字符串表示使用当前域名）
const BASE = '';

/**
 * 统一请求封装函数
 * 自动添加JWT token（后台管理接口），处理401未登录跳转
 * @param url 请求URL
 * @param options fetch配置选项
 * @returns 解析后的JSON数据
 */
async function request(url: string, options: RequestInit = {}) {
  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('userToken');
  const token = url.includes('/admin') ? adminToken : userToken;
  const isFormData = options.body instanceof FormData;
  const headers: any = { ...options.headers };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  const data = await res.json();

  if (data.code === 401 && url.includes('/admin')) {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }
  return data;
}

/**
 * API接口集合（前台搜索 + 后台管理）
 */
export const api = {
  // ========== 前台搜索接口 ==========
  search: (body: any) => request('/api/v1/search', { method: 'POST', body: JSON.stringify(body) }),      // 执行搜索
  getContent: (docId: string) => request(`/api/v1/content/${docId}`),                                     // 获取页面内容
  submitFeedback: (body: any) => request('/api/v1/feedback', { method: 'POST', body: JSON.stringify(body) }), // 提交反馈
  getHotwords: () => request('/api/v1/hotwords'),                                                         // 获取热词
  chat: (body: any) => request('/api/v1/chat', { method: 'POST', body: JSON.stringify(body) }),           // 聊天对话
  chatEnhanced: (body: any) => request('/api/v1/chat/enhanced', { method: 'POST', body: JSON.stringify(body) }), // 增强聊天（支持文件+技能）
  getSeoSettings: () => request('/api/v1/seo'),                                                           // 获取SEO配置

  // ========== 后台管理接口 ==========
  adminLogin: (body: any) => request('/api/admin/v1/login', { method: 'POST', body: JSON.stringify(body) }),        // 管理员登录
  getDashboard: () => request('/api/admin/v1/dashboard'),                                                           // 仪表盘数据
  getTasks: (params: string) => request(`/api/admin/v1/tasks?${params}`),                                           // 任务列表
  createTask: (body: any) => request('/api/admin/v1/tasks', { method: 'POST', body: JSON.stringify(body) }),        // 创建任务
  getTaskDetail: (id: string) => request(`/api/admin/v1/tasks/${id}`),                                              // 任务详情
  retryTask: (id: string) => request(`/api/admin/v1/tasks/${id}/retry`, { method: 'POST' }),                        // 重试任务
  getDatasources: (params: string) => request(`/api/admin/v1/datasources?${params}`),                               // 数据源列表
  addDatasource: (body: any) => request('/api/admin/v1/datasources', { method: 'POST', body: JSON.stringify(body) }), // 添加数据源
  deleteDatasource: (id: number) => request(`/api/admin/v1/datasources/${id}`, { method: 'DELETE' }),               // 删除数据源
  getLogs: (params: string) => request(`/api/admin/v1/logs?${params}`),                                             // 搜索日志
  getFeedbacks: (params: string) => request(`/api/admin/v1/feedbacks?${params}`),                                   // 用户反馈
  getSettings: () => request('/api/admin/v1/settings'),                                                             // 获取配置
  saveSettings: (body: any) => request('/api/admin/v1/settings', { method: 'PUT', body: JSON.stringify(body) }),    // 保存配置
  getProviders: () => request('/api/admin/v1/models/providers'),                                                    // LLM供应商列表
  fetchModels: (body: any) => request('/api/admin/v1/models/fetch', { method: 'POST', body: JSON.stringify(body) }), // 获取模型列表
  testModelSpeed: (body: any) => request('/api/admin/v1/models/test-speed', { method: 'POST', body: JSON.stringify(body) }), // 模型测速

  // ========== 文档分析接口 ==========
  uploadDocument: (formData: FormData) => request('/api/v1/document/upload', {
    method: 'POST',
    body: formData
  }),
  getDocumentAnalysis: (params: string) => request(`/api/admin/v1/documents?${params}`),
  deleteDocumentAnalysis: (id: number) => request(`/api/admin/v1/documents/${id}`, { method: 'DELETE' }),

  // ========== 技能执行接口 ==========
  getSkills: () => request('/api/v1/skills'),
  executeSkill: (body: any) => request('/api/v1/skills/execute', { method: 'POST', body: JSON.stringify(body) }),

  // ========== 后台管理：技能模板接口 ==========
  getSkillTemplates: () => request('/api/admin/v1/skills'),
  createSkillTemplate: (body: any) => request('/api/admin/v1/skills', { method: 'POST', body: JSON.stringify(body) }),
  updateSkillTemplate: (id: number, body: any) => request(`/api/admin/v1/skills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSkillTemplate: (id: number) => request(`/api/admin/v1/skills/${id}`, { method: 'DELETE' }),
  getSkillExecutions: (params: string) => request(`/api/admin/v1/skill-executions?${params}`),
  deleteSkillExecution: (id: number) => request(`/api/admin/v1/skill-executions/${id}`, { method: 'DELETE' }),

  // ========== 用户接口 ==========
  userRegister: (body: any) => request('/api/v1/user/register', { method: 'POST', body: JSON.stringify(body) }),
  userLogin: (body: any) => request('/api/v1/user/login', { method: 'POST', body: JSON.stringify(body) }),
  getUserInfo: () => request('/api/v1/user/info'),
  getUserSkills: () => request('/api/v1/user/skills'),
  createUserSkill: (body: any) => request('/api/v1/user/skills', { method: 'POST', body: JSON.stringify(body) }),
  updateUserSkill: (id: number, body: any) => request(`/api/v1/user/skills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUserSkill: (id: number) => request(`/api/v1/user/skills/${id}`, { method: 'DELETE' }),
  getChatHistory: () => request('/api/v1/user/chat/history'),
  getChatMessages: (chatId: string) => request(`/api/v1/user/chat/history/${chatId}`),
  saveChatMessage: (body: any) => request('/api/v1/user/chat/save', { method: 'POST', body: JSON.stringify(body) }),
  deleteChatHistory: (chatId?: string) => request(`/api/v1/user/chat/history${chatId ? `?chatId=${chatId}` : ''}`, { method: 'DELETE' }),
  getUserProfile: () => request('/api/v1/user/profile'),
  updateProfile: (body: any) => request('/api/v1/user/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body: any) => request('/api/v1/user/password', { method: 'PUT', body: JSON.stringify(body) }),
  uploadAvatar: (formData: FormData) => request('/api/v1/user/avatar', { method: 'POST', body: formData }),
  deleteAccount: (body: any) => request('/api/v1/user/account', { method: 'DELETE', body: JSON.stringify(body) }),

  // ========== 后台管理：用户管理接口 ==========
  getUsers: (params: string) => request(`/api/admin/v1/users?${params}`),
  updateUserStatus: (id: number, status: number) => request(`/api/admin/v1/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteUser: (id: number) => request(`/api/admin/v1/users/${id}`, { method: 'DELETE' }),

  // ========== 后台管理：聊天记录管理接口 ==========
  getAdminChatHistory: (params: string) => request(`/api/admin/v1/chat-history?${params}`),

  // ========== 后台管理：用户技能管理接口 ==========
  getAdminUserSkills: (params: string) => request(`/api/admin/v1/user-skills?${params}`),
  deleteAdminUserSkill: (id: number) => request(`/api/admin/v1/user-skills/${id}`, { method: 'DELETE' }),

  // ========== 后台管理：数据库备份接口 ==========
  createBackup: () => request('/api/admin/v1/backup', { method: 'POST' }),
  getBackups: () => request('/api/admin/v1/backup'),
  getBackupStats: () => request('/api/admin/v1/backup/stats'),
  getBackupDetail: (backupId: string) => request(`/api/admin/v1/backup/${backupId}`),
  downloadBackup: (backupId: string) => fetch(`/api/admin/v1/backup/${backupId}/download`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` } }),
  restoreBackup: (backupId: string) => request(`/api/admin/v1/backup/${backupId}/restore`, { method: 'POST' }),
  deleteBackup: (backupId: string) => request(`/api/admin/v1/backup/${backupId}`, { method: 'DELETE' }),

  // ========== 后台管理：质量面板接口 ==========
  getQualityOverview: () => request('/api/admin/v1/quality'),
  getQualityIssues: () => request('/api/admin/v1/quality/issues'),
  runQualityAudit: () => request('/api/admin/v1/quality/audit', { method: 'POST' }),

  // ========== 后台管理：LLM提示词接口 ==========
  getPrompts: () => request('/api/admin/v1/prompts'),
  updatePrompt: (id: number, content: string) => request(`/api/admin/v1/prompts/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
};

/**
 * 创建SSE流式连接
 * @param url 流式接口URL
 * @returns EventSource实例
 */
export function createStream(url: string) {
  return new EventSource(`${BASE}${url}`);
}
