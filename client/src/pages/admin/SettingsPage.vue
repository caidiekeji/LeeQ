/**
 * SettingsPage - 系统配置页
 * 配置AnyCrawl抓取服务、Elasticsearch和搜索引擎
 */
<template>
    <div class="settings-page">
      <PageHeader title="系统配置" desc="配置 AnyCrawl 抓取服务、Elasticsearch 连接参数和搜索引擎" />

      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'anycrawl' }]" @click="activeTab = 'anycrawl'">AnyCrawl 配置</button>
        <button :class="['tab', { active: activeTab === 'es' }]" @click="activeTab = 'es'">ES 配置</button>
        <button :class="['tab', { active: activeTab === 'searchEngine' }]" @click="activeTab = 'searchEngine'">搜索引擎</button>
      </div>

      <div class="card" v-if="activeTab === 'anycrawl'">
        <h3 style="margin-bottom:16px">AnyCrawl 抓取服务</h3>
        <div class="form-group"><label>API 地址</label><input v-model="settings.anycrawl.apiUrl" placeholder="https://anycrawl.example.com" /></div>
        <div class="form-group"><label>API Key</label><input v-model="settings.anycrawl.apiKey" type="password" placeholder="输入 API 密钥（留空不更新）" /></div>
        <button class="btn btn-primary" @click="saveSettings" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
      </div>

      <div class="card" v-if="activeTab === 'es'">
        <h3 style="margin-bottom:16px">Elasticsearch 连接</h3>
        <div class="form-group"><label>地址</label><input v-model="settings.elasticsearch.hosts" placeholder="http://localhost:9200" /></div>
        <div class="form-group"><label>索引前缀</label><input v-model="settings.elasticsearch.indexPrefix" placeholder="a_search" /></div>
        <button class="btn btn-primary" @click="saveSettings" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
      </div>

      <div class="card" v-if="activeTab === 'searchEngine'">
        <h3 style="margin-bottom:16px">搜索引擎管理</h3>
        <p style="margin-bottom:16px; color: var(--text-secondary); font-size:14px">拖拽调整搜索引擎优先级，从上到下按顺序尝试，第一个成功即返回结果。</p>
        <div class="engine-list">
          <div v-for="(engine, idx) in searchEngineSettings.engines" :key="engine.id" class="engine-item">
            <div class="engine-drag-handle">
              <button class="btn btn-sm btn-icon" :disabled="idx === 0" @click="moveEngine(idx, -1)" title="上移">↑</button>
              <button class="btn btn-sm btn-icon" :disabled="idx === searchEngineSettings.engines.length - 1" @click="moveEngine(idx, 1)" title="下移">↓</button>
            </div>
            <div class="engine-info">
              <span class="engine-name">{{ engine.name }}</span>
              <span class="engine-id">{{ engine.id }}</span>
            </div>
            <label class="switch-label">
              <input type="checkbox" v-model="engine.enabled" />
              <span class="switch-slider"></span>
              <span class="switch-text">{{ engine.enabled ? '已启用' : '已禁用' }}</span>
            </label>
          </div>
        </div>
        <button class="btn btn-primary" @click="saveSettings" :disabled="saving" style="margin-top:16px">{{ saving ? '保存中...' : '保存配置' }}</button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '../../utils/api';
import { toastSuccess, toastError } from '../../utils/toast';
import { DEFAULT_SERVICE_CONFIG } from '../../utils/constants';
import PageHeader from '../../components/admin/PageHeader.vue';

const activeTab = ref('anycrawl');
const saving = ref(false);

const settings = reactive({
  anycrawl: { apiUrl: DEFAULT_SERVICE_CONFIG.anycrawl.apiUrl, apiKey: DEFAULT_SERVICE_CONFIG.anycrawl.apiKey },
  elasticsearch: { hosts: DEFAULT_SERVICE_CONFIG.elasticsearch.hosts, indexPrefix: DEFAULT_SERVICE_CONFIG.elasticsearch.indexPrefix }
});

const searchEngineSettings = reactive<{ engines: { id: string; name: string; enabled: boolean }[] }>({
  engines: [
    { id: 'google', name: 'Google', enabled: true },
    { id: 'baidu', name: '百度', enabled: true },
    { id: 'bing', name: 'Bing', enabled: true },
    { id: 'sogou', name: '搜狗', enabled: true },
    { id: 'so360', name: '360搜索', enabled: true },
    { id: 'yandex', name: 'Yandex', enabled: true }
  ]
});

function moveEngine(idx: number, direction: number) {
  const engines = searchEngineSettings.engines;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= engines.length) return;
  [engines[idx], engines[newIdx]] = [engines[newIdx], engines[idx]];
}

async function saveSettings() {
  if (saving.value) return;
  saving.value = true;
  try {
    const data: any = {
      ...settings,
      searchEngine: { engines: [...searchEngineSettings.engines] }
    };
    const res = await api.saveSettings(data);
    if (res.code === 0) toastSuccess('配置已保存');
    else toastError(res.message || '保存失败');
  } catch { toastError('保存失败'); }
  finally { saving.value = false; }
}

onMounted(async () => {
  const res = await api.getSettings();
  if (res.code === 0 && res.data) {
    if (res.data.anycrawl && Object.keys(res.data.anycrawl).length) Object.assign(settings.anycrawl, res.data.anycrawl);
    if (res.data.elasticsearch && Object.keys(res.data.elasticsearch).length) Object.assign(settings.elasticsearch, res.data.elasticsearch);
    if (res.data.searchEngine && res.data.searchEngine.engines) {
      const defaultEngines = [
        { id: 'google', name: 'Google', enabled: true },
        { id: 'baidu', name: '百度', enabled: true },
        { id: 'bing', name: 'Bing', enabled: true },
        { id: 'sogou', name: '搜狗', enabled: true },
        { id: 'so360', name: '360搜索', enabled: true },
        { id: 'yandex', name: 'Yandex', enabled: true }
      ];
      const savedEngines = res.data.searchEngine.engines;
      const mergedEngines = defaultEngines.map(def => {
        const existing = savedEngines.find((s: any) => s.id === def.id);
        return existing || def;
      });
      const extraEngines = savedEngines.filter((s: any) => !defaultEngines.find(d => d.id === s.id));
      searchEngineSettings.engines = [...mergedEngines, ...extraEngines];
    }
  }
});
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.engine-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s;
}

.engine-item:hover {
  border-color: var(--primary);
}

.engine-drag-handle {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-icon {
  width: 28px;
  height: 22px;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.engine-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.engine-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.engine-id {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.switch-label input[type="checkbox"] {
  display: none;
}

.switch-slider {
  width: 40px;
  height: 22px;
  background: var(--border);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
}

.switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch-label input:checked + .switch-slider {
  background: var(--primary);
}

.switch-label input:checked + .switch-slider::after {
  transform: translateX(18px);
}

.switch-text {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 48px;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 18px;
  }

  .form-row-3 {
    grid-template-columns: 1fr;
  }

  .provider-header {
    flex-wrap: wrap;
  }

  .provider-header-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>