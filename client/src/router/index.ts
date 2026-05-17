// Vue Router 路由配置
import { createRouter, createWebHistory } from 'vue-router';
import AdminLayout from '@/components/AdminLayout.vue';

const router = createRouter({
  history: createWebHistory(),  // 使用HTML5 History模式
  routes: [
    // ========== 前台搜索页面 ==========
    { path: '/', name: 'home', component: () => import('@/pages/search/HomePage.vue') },              // 首页
    { path: '/search', name: 'search', component: () => import('@/pages/search/SearchPage.vue') },    // 搜索结果页
    { path: '/content/:docId', name: 'content', component: () => import('@/pages/search/ContentPage.vue') },  // 内容详情页
    // ========== 后台管理页面 ==========
    { path: '/admin/login', name: 'adminLogin', component: () => import('@/pages/admin/LoginPage.vue') },  // 管理员登录
    {
      path: '/admin',
      component: AdminLayout,  // 后台布局容器
      children: [
        { path: '', redirect: { name: 'adminDashboard' } },
        { path: 'dashboard', name: 'adminDashboard', component: () => import('@/pages/admin/DashboardPage.vue') },       // 仪表盘
        { path: 'tasks', name: 'adminTasks', component: () => import('@/pages/admin/TasksPage.vue') },                   // 任务列表
        { path: 'tasks/:taskId', name: 'adminTaskDetail', component: () => import('@/pages/admin/TaskDetailPage.vue') }, // 任务详情
        { path: 'datasources', name: 'adminDatasources', component: () => import('@/pages/admin/DatasourcesPage.vue') }, // 数据源管理
        { path: 'logs', name: 'adminLogs', component: () => import('@/pages/admin/LogsPage.vue') },                      // 搜索日志
        { path: 'feedbacks', name: 'adminFeedbacks', component: () => import('@/pages/admin/FeedbacksPage.vue') },       // 用户反馈
        { path: 'models', name: 'adminModels', component: () => import('@/pages/admin/ModelsPage.vue') },            // LLM模型管理
        { path: 'settings', name: 'adminSettings', component: () => import('@/pages/admin/SettingsPage.vue') },          // 系统配置
        { path: 'seo', name: 'adminSeo', component: () => import('@/pages/admin/SeoPage.vue') },                          // SEO设置
        { path: 'backup', name: 'adminBackup', component: () => import('@/pages/admin/BackupPage.vue') },                // 数据库备份
        { path: 'skill-templates', name: 'adminSkillTemplates', component: () => import('@/pages/admin/SkillTemplatesPage.vue') },     // 技能模板
        { path: 'skill-executions', name: 'adminSkillExecutions', component: () => import('@/pages/admin/SkillExecutionsPage.vue') }, // 技能执行记录
        { path: 'documents', name: 'adminDocuments', component: () => import('@/pages/admin/DocumentAnalysisPage.vue') },            // 文档分析记录
        { path: 'users', name: 'adminUsers', component: () => import('@/pages/admin/UsersPage.vue') },                              // 用户管理
        { path: 'user-skills', name: 'adminUserSkills', component: () => import('@/pages/admin/UserSkillsPage.vue') },                // 用户技能
        { path: 'chat-history', name: 'adminChatHistory', component: () => import('@/pages/admin/ChatHistoryPage.vue') },           // 聊天记录
        { path: 'quality', name: 'adminQuality', component: () => import('@/pages/admin/QualityPage.vue') },                    // 质量面板
        { path: 'prompts', name: 'adminPrompts', component: () => import('@/pages/admin/PromptsPage.vue') },              // LLM提示词
      ]
    },
  ]
});

// 全局路由守卫：检查后台管理页面的登录状态
router.beforeEach((to, _from, next) => {
  // 如果是后台管理页面且不是登录页
  if (to.path.startsWith('/admin') && to.path !== '/admin/login') {
    const token = localStorage.getItem('adminToken');
    if (!token) return next('/admin/login');  // 未登录则跳转登录页
  }
  next();
});

export default router;
