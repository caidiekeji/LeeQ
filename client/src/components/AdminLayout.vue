<template>
  <div class="admin-layout" :class="{ 'sidebar-collapsed': collapsed, 'sidebar-open': mobileOpen }">
    <!-- 移动端遮罩 -->
    <div class="sidebar-overlay" v-if="mobileOpen" @click="mobileOpen = false"></div>

    <!-- 暗色侧边栏 -->
    <aside class="admin-sidebar">
      <!-- 侧边栏头部 Logo -->
      <div class="sidebar-header" @click="collapsed = !collapsed">
        <div class="sidebar-logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="4" fill="url(#proLogoGrad)"/>
            <path d="M14 28c2-4 4-8 10-8s8 4 10 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="18" r="3" fill="#fff"/>
            <defs><linearGradient id="proLogoGrad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#1890FF"/><stop offset="1" stop-color="#40A9FF"/></linearGradient></defs>
          </svg>
          <h1 class="sidebar-title" v-show="!collapsed">LeeQ</h1>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title" v-show="!collapsed">主导航</div>
          <router-link
            v-for="item in mainMenu"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="nav-active"
            :title="collapsed ? item.label : ''"
            @click="handleMenuClick"
          >
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
          </router-link>
        </div>
        <div class="nav-section">
          <div class="nav-section-title" v-show="!collapsed">系统</div>
          <router-link
            v-for="item in sysMenu"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="nav-active"
            :title="collapsed ? item.label : ''"
            @click="handleMenuClick"
          >
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
          </router-link>
        </div>
      </nav>

      <!-- 侧边栏底部折叠按钮 -->
      <div class="sidebar-footer" @click="collapsed = !collapsed">
        <span class="nav-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </span>
        <span class="nav-label" v-show="!collapsed">收起菜单</span>
      </div>
    </aside>

    <!-- 右侧主体 -->
    <div class="admin-main">
      <!-- 顶栏 -->
      <header class="admin-topbar">
        <div class="topbar-left">
          <button class="hamburger-btn" @click="mobileOpen = !mobileOpen" aria-label="切换菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <!-- 面包屑导航 -->
          <nav class="topbar-breadcrumb">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="breadcrumb-home">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">{{ currentPageTitle }}</span>
          </nav>
        </div>
        <div class="topbar-right">
          <!-- 前往前台 -->
          <a href="/" target="_blank" class="topbar-action" title="前往前台">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </a>
          <!-- 用户信息 -->
          <div class="user-info">
            <div class="user-avatar">{{ username.charAt(0).toUpperCase() }}</div>
            <span class="admin-name">{{ username }}</span>
          </div>
          <!-- 退出 -->
          <button class="topbar-action logout-action" @click="logout" title="退出登录">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const username = ref(localStorage.getItem('adminUsername') || 'Admin');
const collapsed = ref(false);
const mobileOpen = ref(false);

// 页面标题映射
const pageTitleMap: Record<string, string> = {
  '/admin/dashboard': '仪表盘',
  '/admin/tasks': '抓取任务',
  '/admin/datasources': '数据源管理',
  '/admin/logs': '搜索日志',
  '/admin/feedbacks': '反馈管理',
  '/admin/models': 'LLM模型管理',
  '/admin/settings': '系统配置',
  '/admin/seo': 'SEO设置',
  '/admin/backup': '数据库备份',
  '/admin/skill-templates': '技能模板',
  '/admin/skill-executions': '技能执行记录',
  '/admin/documents': '文档分析记录',
  '/admin/users': '用户管理',
  '/admin/user-skills': '用户技能',
  '/admin/chat-history': '聊天记录',
  '/admin/quality': '质量面板',
  '/admin/prompts': 'LLM提示词'
};

// 当前页面标题
const currentPageTitle = computed(() => {
  if (route.path.startsWith('/admin/tasks/')) return '任务详情';
  return pageTitleMap[route.path] || '后台管理';
});

// 主导航菜单
const mainMenu = [
  { path: '/admin/dashboard', label: '仪表盘', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>' },
  { path: '/admin/tasks', label: '抓取任务', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { path: '/admin/datasources', label: '数据源', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
  { path: '/admin/logs', label: '搜索日志', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  { path: '/admin/feedbacks', label: '反馈管理', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
  { path: '/admin/models', label: 'LLM模型', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { path: '/admin/skill-templates', label: '技能模板', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>' },
  { path: '/admin/skill-executions', label: '技能记录', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
  { path: '/admin/documents', label: '文档记录', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
  { path: '/admin/users', label: '用户管理', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { path: '/admin/user-skills', label: '用户技能', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>' },
  { path: '/admin/chat-history', label: '聊天记录', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
];

// 系统菜单
const sysMenu = [
  { path: '/admin/settings', label: '系统配置', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
  { path: '/admin/seo', label: 'SEO设置', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' },
  { path: '/admin/backup', label: '数据备份', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
  { path: '/admin/quality', label: '质量面板', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
  { path: '/admin/prompts', label: 'LLM提示词', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' },
];

// 移动端菜单点击关闭
function handleMenuClick() {
  mobileOpen.value = false;
}

// 退出登录
function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUsername');
  router.push('/admin/login');
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  background: var(--bg);
}

/* ===== 暗色侧边栏 ===== */
.admin-sidebar {
  width: var(--sidebar-width);
  background: #001529;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 40;
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  overflow: hidden;
  box-shadow: 2px 0 6px rgba(0, 21, 41, 0.35);
}

.sidebar-collapsed .admin-sidebar {
  width: var(--sidebar-collapsed-width);
}

/* 侧边栏头部 */
.sidebar-header {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 24px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.sidebar-collapsed .sidebar-header {
  padding: 0 28px;
}

.sidebar-header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.sidebar-logo svg {
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 20px;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
  margin: 0;
}

/* 导航菜单容器 */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

/* 菜单分组 */
.nav-section {
  padding: 4px 0;
}

/* 菜单分组标题 */
.nav-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  padding: 12px 24px 8px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 菜单项 */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 24px;
  margin: 2px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
}

.nav-item:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.04);
  text-decoration: none;
}

.nav-active {
  color: #FFFFFF;
  background: var(--primary);
}

.nav-active:hover {
  color: #FFFFFF;
  background: var(--primary-light);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: inherit;
}

.nav-icon :deep(svg) {
  color: inherit;
}

.nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 侧边栏底部 */
.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 24px;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: all 0.2s;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sidebar-footer:hover {
  color: #FFFFFF;
}

.sidebar-footer .nav-icon {
  width: 16px;
  height: 16px;
}

/* ===== 主内容区 ===== */
.admin-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.sidebar-collapsed .admin-main {
  margin-left: var(--sidebar-collapsed-width);
}

/* ===== 顶栏 ===== */
.admin-topbar {
  height: var(--topbar-height);
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: fixed;
  top: 0;
  right: 0;
  left: var(--sidebar-width);
  z-index: 30;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  transition: left 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.sidebar-collapsed .admin-topbar {
  left: var(--sidebar-collapsed-width);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 汉堡菜单按钮 - 仅移动端显示 */
.hamburger-btn {
  display: none;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.hamburger-btn:hover {
  background: rgba(0, 0, 0, 0.025);
  color: var(--primary);
}

/* 面包屑 */
.topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.breadcrumb-home {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.breadcrumb-separator {
  color: rgba(0, 0, 0, 0.15);
  font-size: 14px;
}

.breadcrumb-current {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

/* 顶栏右侧 */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.topbar-action:hover {
  background: rgba(0, 0, 0, 0.025);
  color: var(--primary);
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  cursor: default;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.admin-name {
  font-size: 14px;
  color: var(--text);
  font-weight: 400;
}

/* 退出按钮 */
.logout-action:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

/* ===== 内容区 ===== */
.admin-content {
  flex: 1;
  padding: var(--content-padding);
  padding-top: calc(var(--content-padding) + var(--topbar-height));
  overflow-y: auto;
  min-width: 0;
}

/* ===== 滚动条 ===== */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.admin-content::-webkit-scrollbar {
  width: 6px;
}

.admin-content::-webkit-scrollbar-track {
  background: transparent;
}

.admin-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 3px;
}

.admin-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}

/* ===== 移动端遮罩 ===== */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 49;
  animation: fadeIn 0.2s;
}

/* ===== 响应式 ===== */
@media (max-width: 1024px) {
  .admin-sidebar {
    width: 220px;
  }

  .admin-main {
    margin-left: 220px;
  }

  .sidebar-collapsed .admin-main {
    margin-left: 0;
  }

  .sidebar-collapsed .admin-sidebar {
    width: 0;
    overflow: hidden;
    box-shadow: none;
  }

  .sidebar-collapsed .admin-topbar {
    left: 0;
  }
}

@media (max-width: 768px) {
  .admin-sidebar {
    display: none;
  }

  .admin-main {
    margin-left: 0;
  }

  .sidebar-collapsed .admin-main {
    margin-left: 0;
  }

  .admin-content {
    padding: 16px;
    padding-top: calc(16px + var(--topbar-height));
  }

  .admin-topbar {
    padding: 0 16px;
    left: 0;
  }

  .admin-name {
    display: none;
  }

  .hamburger-btn {
    display: flex;
  }

  /* 移动端侧边栏弹出 */
  .sidebar-open .admin-sidebar {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    width: var(--sidebar-width);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>