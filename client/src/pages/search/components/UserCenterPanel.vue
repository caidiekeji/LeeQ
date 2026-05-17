<template>
  <div class="ucp-overlay" @click.self="$emit('close')">
    <div class="ucp-panel">
      <div class="ucp-header">
        <h3 class="ucp-title">用户中心</h3>
        <button class="ucp-close" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="ucp-body">
        <div class="ucp-loading" v-if="loading">加载中...</div>
        <div class="ucp-error" v-else-if="error">{{ error }}</div>
        <template v-else-if="profile">
          <!-- 头像区 -->
          <div class="ucp-avatar-section">
            <div class="ucp-avatar-wrapper" @click="triggerAvatarUpload" title="点击更换头像">
              <img v-if="profile.avatar" :src="profile.avatar" class="ucp-avatar-img" />
              <span v-else class="ucp-avatar-text">{{ avatarText }}</span>
              <div class="ucp-avatar-hover">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="ucp-avatar-input" @change="onAvatarChange" />

            <!-- 可编辑昵称 -->
            <div class="ucp-nickname-row" v-if="!editingNickname">
              <span class="ucp-name">{{ profile.nickname || profile.username }}</span>
              <button class="ucp-edit-btn" @click="startEditNickname" title="修改昵称">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
            <div class="ucp-nickname-row" v-else>
              <input
                ref="nicknameInput"
                v-model="nicknameEdit"
                class="ucp-nickname-input"
                maxlength="64"
                @keydown.enter="saveNickname"
                @keydown.escape="cancelEditNickname"
              />
              <button class="ucp-save-btn" @click="saveNickname" :disabled="savingNickname">保存</button>
              <button class="ucp-cancel-btn" @click="cancelEditNickname">取消</button>
            </div>
            <div class="ucp-username">@{{ profile.username }}</div>
          </div>

          <!-- 统计卡片 -->
          <div class="ucp-stats-grid">
            <div class="ucp-stat-card">
              <div class="ucp-stat-icon chat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="ucp-stat-value">{{ profile.stats.chatCount }}</div>
              <div class="ucp-stat-label">对话次数</div>
            </div>
            <div class="ucp-stat-card">
              <div class="ucp-stat-icon skill-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                  <line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>
                </svg>
              </div>
              <div class="ucp-stat-value">{{ profile.stats.skillCount }}</div>
              <div class="ucp-stat-label">我的技能</div>
            </div>
            <div class="ucp-stat-card">
              <div class="ucp-stat-icon doc-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div class="ucp-stat-value">{{ profile.stats.docCount }}</div>
              <div class="ucp-stat-label">文档分析</div>
            </div>
            <div class="ucp-stat-card">
              <div class="ucp-stat-icon exec-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div class="ucp-stat-value">{{ profile.stats.executionCount }}</div>
              <div class="ucp-stat-label">技能执行</div>
            </div>
          </div>

          <!-- 注册时间 -->
          <div class="ucp-info-section">
            <div class="ucp-info-item">
              <span class="ucp-info-label">注册时间</span>
              <span class="ucp-info-value">{{ formatDate(profile.createdAt) }}</span>
            </div>
          </div>

          <!-- 修改密码 -->
          <div class="ucp-section">
            <button class="ucp-section-toggle" @click="showPasswordSection = !showPasswordSection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              修改密码
              <svg class="ucp-arrow" :class="{ open: showPasswordSection }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="ucp-section-content" v-if="showPasswordSection">
              <div class="ucp-form-group">
                <label>原密码</label>
                <input v-model="oldPassword" type="password" placeholder="输入原密码" />
              </div>
              <div class="ucp-form-group">
                <label>新密码</label>
                <input v-model="newPassword" type="password" placeholder="至少6位" />
              </div>
              <div class="ucp-form-error" v-if="passwordError">{{ passwordError }}</div>
              <button class="ucp-form-btn" @click="doChangePassword" :disabled="changingPassword">
                {{ changingPassword ? '修改中...' : '确认修改' }}
              </button>
            </div>
          </div>

          <!-- 注销账号 -->
          <div class="ucp-section">
            <button class="ucp-section-toggle danger" @click="showDeleteSection = !showDeleteSection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              注销账号
              <svg class="ucp-arrow" :class="{ open: showDeleteSection }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="ucp-section-content" v-if="showDeleteSection">
              <p class="ucp-delete-warning">注销后所有数据将被永久删除，此操作不可撤销。</p>
              <div class="ucp-form-group">
                <label>输入密码确认</label>
                <input v-model="deletePassword" type="password" placeholder="输入登录密码" />
              </div>
              <div class="ucp-form-error" v-if="deleteError">{{ deleteError }}</div>
              <button class="ucp-form-btn danger-btn" @click="doDeleteAccount" :disabled="deletingAccount">
                {{ deletingAccount ? '注销中...' : '确认注销' }}
              </button>
            </div>
          </div>

          <!-- 提示消息 -->
          <div class="ucp-toast" :class="{ show: toastMsg, error: toastError }" v-if="toastMsg">{{ toastMsg }}</div>

          <!-- 退出登录 -->
          <div class="ucp-actions">
            <button class="ucp-action-btn" @click="$emit('logout')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              退出登录
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { api } from '../../../utils/api';

const emit = defineEmits<{ close: []; logout: []; profileUpdated: [data: { nickname: string; avatar: string }] }>();

interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  createdAt: string;
  stats: {
    chatCount: number;
    skillCount: number;
    docCount: number;
    executionCount: number;
  };
}

const profile = ref<UserProfile | null>(null);
const loading = ref(true);
const error = ref('');

const avatarText = computed(() => {
  if (!profile.value) return '';
  const name = profile.value.nickname || profile.value.username;
  return name.charAt(0).toUpperCase();
});

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ========== 头像上传 ==========
const avatarInput = ref<HTMLInputElement | null>(null);

function triggerAvatarUpload() {
  avatarInput.value?.click();
}

async function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const res = await api.uploadAvatar(formData);
    if (res.code === 0 && profile.value) {
      profile.value.avatar = res.data.avatarUrl;
      emit('profileUpdated', { nickname: profile.value.nickname, avatar: res.data.avatarUrl });
      showToast('头像更新成功');
    } else {
      showToast(res.message || '上传失败', true);
    }
  } catch {
    showToast('网络异常，请重试', true);
  } finally {
    input.value = '';
  }
}

// ========== 昵称编辑 ==========
const editingNickname = ref(false);
const nicknameEdit = ref('');
const nicknameInput = ref<HTMLInputElement | null>(null);
const savingNickname = ref(false);

function startEditNickname() {
  nicknameEdit.value = profile.value?.nickname || '';
  editingNickname.value = true;
  nextTick(() => nicknameInput.value?.focus());
}

function cancelEditNickname() {
  editingNickname.value = false;
  nicknameEdit.value = '';
}

async function saveNickname() {
  if (!nicknameEdit.value.trim() || !profile.value) return;
  savingNickname.value = true;
  try {
    const res = await api.updateProfile({ nickname: nicknameEdit.value.trim() });
    if (res.code === 0) {
      profile.value.nickname = nicknameEdit.value.trim();
      editingNickname.value = false;
      emit('profileUpdated', { nickname: profile.value.nickname, avatar: profile.value.avatar });
      showToast('昵称修改成功');
    } else {
      showToast(res.message || '修改失败', true);
    }
  } catch {
    showToast('网络异常，请重试', true);
  }
  savingNickname.value = false;
}

// ========== 修改密码 ==========
const showPasswordSection = ref(false);
const oldPassword = ref('');
const newPassword = ref('');
const passwordError = ref('');
const changingPassword = ref(false);

async function doChangePassword() {
  passwordError.value = '';
  if (!oldPassword.value || !newPassword.value) {
    passwordError.value = '请填写完整信息';
    return;
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少6位';
    return;
  }
  changingPassword.value = true;
  try {
    const res = await api.changePassword({ oldPassword: oldPassword.value, newPassword: newPassword.value });
    if (res.code === 0) {
      oldPassword.value = '';
      newPassword.value = '';
      showPasswordSection.value = false;
      showToast('密码修改成功，请重新登录');
      setTimeout(() => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        window.location.reload();
      }, 1500);
    } else {
      passwordError.value = res.message;
    }
  } catch {
    passwordError.value = '网络异常，请重试';
  }
  changingPassword.value = false;
}

// ========== 注销账号 ==========
const showDeleteSection = ref(false);
const deletePassword = ref('');
const deleteError = ref('');
const deletingAccount = ref(false);

async function doDeleteAccount() {
  deleteError.value = '';
  if (!deletePassword.value) {
    deleteError.value = '请输入密码确认';
    return;
  }
  deletingAccount.value = true;
  try {
    const res = await api.deleteAccount({ password: deletePassword.value });
    if (res.code === 0) {
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      window.location.reload();
    } else {
      deleteError.value = res.message;
    }
  } catch {
    deleteError.value = '网络异常，请重试';
  }
  deletingAccount.value = false;
}

// ========== 提示消息 ==========
const toastMsg = ref('');
const toastError = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string, isError = false) {
  toastMsg.value = msg;
  toastError.value = isError;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 2500);
}

// ========== 初始化 ==========
onMounted(async () => {
  try {
    const res = await api.getUserProfile();
    if (res.code === 0) {
      profile.value = res.data;
    } else {
      error.value = res.message || '获取用户数据失败';
    }
  } catch (err: any) {
    error.value = err.message || '网络异常，请重试';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.ucp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  animation: ucpFadeIn 0.2s ease;
}

.ucp-panel {
  width: 400px;
  max-width: 90vw;
  height: 100vh;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  animation: ucpSlideIn 0.25s ease;
}

.ucp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ucp-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.ucp-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.ucp-close:hover {
  background: var(--bg-input);
  color: var(--text);
}

.ucp-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.ucp-loading,
.ucp-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-light);
  font-size: 14px;
}

.ucp-error {
  color: var(--danger);
}

/* ========== 头像区 ========== */
.ucp-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0 24px;
}

.ucp-avatar-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  margin-bottom: 12px;
}

.ucp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ucp-avatar-text {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff;
  font-size: 30px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ucp-avatar-hover {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
}

.ucp-avatar-wrapper:hover .ucp-avatar-hover {
  opacity: 1;
}

.ucp-avatar-input {
  display: none;
}

/* ========== 昵称编辑 ========== */
.ucp-nickname-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.ucp-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.ucp-edit-btn {
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
  transition: all 0.15s;
  flex-shrink: 0;
}

.ucp-edit-btn:hover {
  background: var(--bg-input);
  color: var(--primary);
}

.ucp-nickname-input {
  width: 150px;
  padding: 6px 10px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text);
  font-size: 15px;
  outline: none;
}

.ucp-save-btn,
.ucp-cancel-btn {
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  flex-shrink: 0;
}

.ucp-save-btn {
  background: var(--primary);
  color: #fff;
}

.ucp-save-btn:hover {
  opacity: 0.85;
}

.ucp-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ucp-cancel-btn {
  background: var(--bg-input);
  color: var(--text-secondary);
}

.ucp-cancel-btn:hover {
  background: var(--border);
}

.ucp-username {
  font-size: 13px;
  color: var(--text-light);
}

/* ========== 统计卡片 ========== */
.ucp-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.ucp-stat-card {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
  transition: all 0.15s;
}

.ucp-stat-card:hover {
  background: var(--bg-dark);
}

.ucp-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
}

.chat-icon {
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary);
}

.skill-icon {
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent-light);
}

.doc-icon {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.exec-icon {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.ucp-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.ucp-stat-label {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 4px;
}

.ucp-info-section {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 24px;
}

.ucp-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ucp-info-label {
  font-size: 13px;
  color: var(--text-light);
}

.ucp-info-value {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}

/* ========== 折叠区块 ========== */
.ucp-section {
  margin-bottom: 12px;
}

.ucp-section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ucp-section-toggle:hover {
  background: var(--bg);
}

.ucp-section-toggle.danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.ucp-arrow {
  margin-left: auto;
  transition: transform 0.2s;
}

.ucp-arrow.open {
  transform: rotate(180deg);
}

.ucp-section-content {
  padding: 16px;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--bg);
}

.ucp-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.ucp-form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.ucp-form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.ucp-form-group input:focus {
  border-color: var(--primary);
}

.ucp-form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.ucp-form-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: var(--radius);
  background: var(--gradient-btn);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ucp-form-btn:hover {
  opacity: 0.85;
}

.ucp-form-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ucp-form-btn.danger-btn {
  background: var(--danger);
}

.ucp-delete-warning {
  font-size: 13px;
  color: var(--danger);
  background: rgba(239, 68, 68, 0.08);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  line-height: 1.5;
}

/* ========== 提示消息 ========== */
.ucp-toast {
  position: sticky;
  bottom: 12px;
  padding: 10px 16px;
  border-radius: var(--radius);
  background: var(--success);
  color: #fff;
  font-size: 13px;
  text-align: center;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.25s;
  margin-top: 12px;
  pointer-events: none;
}

.ucp-toast.show {
  opacity: 1;
  transform: translateY(0);
}

.ucp-toast.error {
  background: var(--danger);
}

/* ========== 退出按钮 ========== */
.ucp-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.ucp-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.ucp-action-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-bg);
}

@keyframes ucpFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes ucpSlideIn {
  from { transform: translateX(30px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@media (max-width: 480px) {
  .ucp-panel {
    width: 100vw;
    max-width: 100vw;
  }
}
</style>
