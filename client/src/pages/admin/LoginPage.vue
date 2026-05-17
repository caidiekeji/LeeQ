/**
 * LoginPage - 后台管理员登录页
 * 包含登录表单、错误提示、登录逻辑
 */
<template>
  <div class="login-page">
    <div class="login-bg-pattern"></div>
    <div class="login-card">
      <div class="login-header">
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="url(#loginLogoGrad)"/>
          <path d="M14 28c2-4 4-8 10-8s8 4 10 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="24" cy="18" r="3" fill="#fff"/>
          <defs><linearGradient id="loginLogoGrad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#1890FF"/><stop offset="1" stop-color="#40A9FF"/></linearGradient></defs>
        </svg>
        <h1>LeeQ</h1>
        <p class="sub">后台管理系统</p>
      </div>

      <div class="form-group" style="margin-bottom:16px">
        <label>用户名</label>
        <div class="input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input v-model="username" placeholder="请输入用户名" @keydown.enter="login" />
        </div>
      </div>

      <div class="form-group" style="margin-bottom:8px">
        <label>密码</label>
        <div class="input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input v-model="password" type="password" placeholder="请输入密码" @keydown.enter="login" />
        </div>
      </div>

      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>

      <button class="login-btn" @click="login" :disabled="loading">
        <span v-if="loading" class="btn-spinner"></span>
        <span v-else>登 录</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../utils/api';

const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

async function login() {
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  const res = await api.adminLogin({ username: username.value, password: password.value });
  loading.value = false;
  if (res.code === 0) {
    localStorage.setItem('adminToken', res.data.token);
    localStorage.setItem('adminUsername', res.data.username);
    router.push('/admin/dashboard');
  } else {
    errorMsg.value = res.message || '登录失败，请检查用户名和密码';
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

.login-bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(24, 144, 255, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(24, 144, 255, 0.03) 0%, transparent 50%);
  pointer-events: none;
}

.login-card {
  position: relative;
  z-index: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 48px 40px;
  width: 420px;
  max-width: calc(100vw - 32px);
  box-shadow: var(--shadow-lg);
  animation: fadeUp 0.5s ease;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header svg {
  margin-bottom: 16px;
}

.login-card h1 {
  text-align: center;
  font-size: 24px;
  font-weight: 800;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}

.sub {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 0;
  font-size: 14px;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-wrap:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-bg);
}

.input-wrap svg {
  color: var(--text-light);
  flex-shrink: 0;
}

.input-wrap input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: 14px;
  color: var(--text);
  outline: none;
  box-shadow: none;
}

.input-wrap input::placeholder {
  color: var(--text-light);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 4px;
  padding: 10px 12px;
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 77, 79, 0.2);
}

.login-btn {
  width: 100%;
  margin-top: 24px;
  padding: 13px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  gap: 8px;
}

.login-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
  }

  .login-card h1 {
    font-size: 20px;
  }
}
</style>