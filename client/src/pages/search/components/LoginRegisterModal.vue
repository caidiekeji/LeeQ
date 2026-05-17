<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ isRegister ? '注册账号' : '用户登录' }}</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" placeholder="请输入用户名" @keydown.enter="doSubmit" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" :placeholder="isRegister ? '至少6位' : '请输入密码'" @keydown.enter="doSubmit" />
        </div>
        <div class="form-group" v-if="isRegister">
          <label>昵称（可选）</label>
          <input v-model="nickname" placeholder="显示名称，不填则用用户名" @keydown.enter="doSubmit" />
        </div>

        <div class="error-msg" v-if="errorMsg">{{ errorMsg }}</div>

        <button class="submit-btn" @click="doSubmit" :disabled="submitting">
          {{ submitting ? '处理中...' : (isRegister ? '注册' : '登录') }}
        </button>

        <div class="switch-row">
          <span>{{ isRegister ? '已有账号？' : '没有账号？' }}</span>
          <button class="switch-btn" @click="isRegister = !isRegister; errorMsg = ''">
            {{ isRegister ? '去登录' : '去注册' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../../utils/api';

defineEmits<{ close: [] }>();

const isRegister = ref(false);
const username = ref('');
const password = ref('');
const nickname = ref('');
const submitting = ref(false);
const errorMsg = ref('');

async function doSubmit() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请填写用户名和密码';
    return;
  }
  submitting.value = true;
  errorMsg.value = '';

  try {
    const res = isRegister.value
      ? await api.userRegister({ username: username.value, password: password.value, nickname: nickname.value })
      : await api.userLogin({ username: username.value, password: password.value });

    if (res.code === 0) {
      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userInfo', JSON.stringify(res.data.user));
      window.dispatchEvent(new CustomEvent('user-login', { detail: res.data.user }));
      location.reload();
    } else {
      errorMsg.value = res.message;
    }
  } catch {
    errorMsg.value = '网络错误，请重试';
  }
  submitting.value = false;
}
</script>

<style scoped>
.modal { width: 400px; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.form-group input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text); font-size: 14px; outline: none; box-sizing: border-box; }
.form-group input:focus { border-color: var(--primary); }
.error-msg { font-size: 13px; color: var(--danger); padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: var(--radius-sm); }
.submit-btn { width: 100%; padding: 12px; border: none; border-radius: var(--radius); background: var(--gradient-btn); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.switch-row { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.switch-btn { border: none; background: transparent; color: var(--primary); font-size: 13px; font-weight: 500; cursor: pointer; }
.switch-btn:hover { text-decoration: underline; }
@media (max-width: 768px) { .modal { width: 90%; } }
</style>