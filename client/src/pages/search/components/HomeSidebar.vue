<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span class="logo-text">LeeQ</span>
      </div>
      <button class="sidebar-toggle-btn" @click="$emit('toggleCollapse')" :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline :points="sidebarCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'"/>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <a class="nav-item" @click="$emit('resetHome')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>返回首页</span>
      </a>
      <a class="nav-item" @click="$emit('startNewChat')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
        <span>新对话</span>
      </a>
      <a class="nav-item" @click="$emit('clearHistory')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="m8 6 2-3h4l2 3"/>
        </svg>
        <span>清空历史</span>
      </a>

      <div class="sidebar-section-title" v-if="isLoggedIn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
          <line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>
        </svg>
        <span>工具</span>
      </div>
      <a class="nav-item nav-skill" v-if="isLoggedIn" @click="$emit('openCreateSkill')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
          <line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>
        </svg>
        <span>创建技能</span>
        <span class="skill-badge">+</span>
      </a>

      <div class="sidebar-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>历史记录</span>
      </div>
      <a v-for="(h, i) in historyList" :key="i" class="recent-search-item" @click="$emit('clickHistory', i, h)" :title="h.text">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
          <circle v-if="h.type === 'search'" cx="11" cy="11" r="8"/>
          <path v-if="h.type === 'search'" d="m21 21-4.3-4.3"/>
          <path v-else d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="truncate">{{ h.text }}</span>
        <button class="recent-delete-btn" @click.stop="$emit('removeHistory', i)" title="删除">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </a>
      <div v-if="!historyList.length" class="sidebar-empty">暂无历史记录</div>
    </nav>

    <div class="sidebar-footer">
      <div class="mode-indicator">
        <span class="mode-dot" :class="{ active: mode === 'search' }"></span>
        {{ modeDisplay }}
      </div>
      <div class="user-area">
        <template v-if="isLoggedIn">
          <div class="user-info-row" @click="$emit('openUserCenter')" title="用户中心">
            <img v-if="userInfo.avatar" :src="userInfo.avatar" class="user-avatar-mini-img" />
            <div v-else class="user-avatar-mini">{{ (userInfo.nickname || userInfo.username || '?').charAt(0).toUpperCase() }}</div>
            <span class="user-name">{{ userInfo.nickname || userInfo.username }}</span>
          </div>
          <button class="logout-btn" @click="$emit('logout')">退出</button>
        </template>
        <button v-else class="login-btn" @click="$emit('openLogin')">登录</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface HistoryItem {
  text: string;
  type: 'search' | 'chat';
  timestamp: number;
}

const props = defineProps<{
  sidebarCollapsed: boolean;
  historyList: HistoryItem[];
  mode: string;
  isLoggedIn: boolean;
  userInfo: { username: string; nickname: string; avatar?: string };
}>();

defineEmits<{
  toggleCollapse: [];
  resetHome: [];
  startNewChat: [];
  clearHistory: [];
  clickHistory: [index: number, item: HistoryItem];
  removeHistory: [index: number];
  openCreateSkill: [];
  openLogin: [];
  openUserCenter: [];
  logout: [];
}>();

const modeDisplay = computed(() => {
  const map: Record<string, string> = { search: '智能搜索', summarize: 'URL 摘要', chat: '聊天' };
  return (map[props.mode] || '智能搜索') + '模式';
});
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width 0.3s ease;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background: var(--bg-input);
  color: var(--text);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-text {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--bg-input);
  color: var(--text);
}

.nav-item.active {
  background: linear-gradient(135deg, var(--primary-bg), var(--accent-bg));
  color: var(--primary-light);
  font-weight: 600;
}

.nav-skill:hover {
  background: var(--accent-bg);
  color: var(--accent);
}

.skill-badge {
  margin-left: auto;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-light);
  margin-top: 16px;
  margin-bottom: 4px;
  padding: 4px 22px;
}

.recent-search-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  overflow: hidden;
  text-decoration: none;
  margin: 0 12px;
}

.recent-search-item:hover {
  background: var(--bg-input);
  color: var(--text);
  text-decoration: none;
}

.recent-delete-btn {
  display: none;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: auto;
  transition: all 0.15s;
}

.recent-search-item:hover .recent-delete-btn {
  display: flex;
}

.recent-delete-btn:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.sidebar-empty {
  padding: 8px;
  color: var(--text-light);
  font-size: 12px;
  text-align: center;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shrink-0 {
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 0;
}

.user-info-row:hover {
  background: var(--bg-input);
}

.user-avatar-mini {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar-mini-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-btn, .logout-btn {
  padding: 4px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.login-btn { color: var(--primary); border-color: var(--primary); }
.login-btn:hover { background: var(--primary-bg); }
.logout-btn { color: var(--text-secondary); }
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.mode-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s;
}

.mode-dot.active {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
}
</style>
