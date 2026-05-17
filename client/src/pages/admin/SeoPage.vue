<template>
  <div class="seo-page fade-up">
    <div class="filter-bar">
      <div></div>
      <div class="filter-right">
        <button class="btn btn-primary" @click="saveSettings" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>SEO 设置</h3>
        <p>配置网站的SEO相关参数</p>
      </div>

      <div class="form-group">
        <label>网站标题</label>
        <input v-model="settings.siteTitle" placeholder="请输入网站标题" />
      </div>
      <div class="form-group">
        <label>网站描述</label>
        <textarea v-model="settings.siteDescription" placeholder="请输入网站描述" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>网站关键词</label>
        <input v-model="settings.keywords" placeholder="请输入关键词，用逗号分隔" />
      </div>
      <div class="form-group">
        <label>首页标题</label>
        <input v-model="settings.homeTitle" placeholder="请输入首页标题" />
      </div>
      <div class="form-group">
        <label>首页描述</label>
        <textarea v-model="settings.homeDescription" placeholder="请输入首页描述" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>搜索页标题</label>
        <input v-model="settings.searchTitle" placeholder="请输入搜索页标题" />
      </div>
      <div class="form-group">
        <label>搜索页描述</label>
        <textarea v-model="settings.searchDescription" placeholder="请输入搜索页描述" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>页脚版权信息</label>
        <input v-model="settings.copyright" placeholder="请输入版权信息" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { toastSuccess, toastError } from '../../utils/toast';

const settings = reactive({
  siteTitle: '', siteDescription: '', keywords: '',
  homeTitle: '', homeDescription: '', searchTitle: '', searchDescription: '',
  copyright: ''
});
const saving = ref(false);

async function saveSettings() {
  if (saving.value) return;
  saving.value = true;
  try {
    const res = await api.saveSettings({ seo: settings });
    if (res.code === 0) toastSuccess('配置已保存');
    else toastError(res.message || '保存失败');
  } catch { toastError('保存失败'); }
  finally { saving.value = false; }
}

onMounted(async () => {
  const res = await api.getSettings();
  if (res.code === 0 && res.data?.seo) {
    Object.assign(settings, res.data.seo);
  }
});
</script>

<style scoped>
.seo-page { display: flex; flex-direction: column; gap: 20px; }

.card-header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.card-header h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
.card-header p { font-size: 13px; color: var(--text-secondary); margin: 0; }
</style>