<template>
  <div class="page-container">
    <PageHeader title="LLM模型管理" desc="配置和管理大语言模型供应商及模型">
      <template #actions>
        <button class="btn btn-outline" @click="addProvider">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          添加供应商
        </button>
        <button class="btn btn-primary" @click="saveSettings">保存配置</button>
      </template>
    </PageHeader>
    <EmptyState v-if="!llmSettings.providers || llmSettings.providers.length === 0" title="还没有配置任何供应商" desc="点击「添加供应商」按钮配置 LLM 供应商" />

    <div v-else class="providers-list">
      <div
        v-for="provider in llmSettings.providers"
        :key="provider.id"
        class="provider-card"
      >
        <div class="provider-header">
          <div class="provider-info">
            <span class="provider-icon">{{ provider.label?.charAt(0) || '?' }}</span>
            <span class="provider-label">{{ provider.label || '未配置' }}</span>
          </div>
          <div class="provider-header-right">
            <span v-if="llmSettings.activeProviderId === provider.id" class="badge badge-success">当前使用</span>
            <span v-else class="badge badge-info">已配置</span>
            <div class="provider-actions">
              <button class="btn btn-sm btn-outline" v-if="llmSettings.activeProviderId !== provider.id" @click="setActive(provider.id)">设为当前</button>
              <button class="btn btn-sm btn-danger" @click="removeProvider(provider.id)">删除</button>
            </div>
          </div>
        </div>

        <div class="provider-tabs">
          <button :class="['provider-tab', { active: provider.activeTab === 'api' }]" @click="provider.activeTab = 'api'">API配置</button>
          <button :class="['provider-tab', { active: provider.activeTab === 'models' }]" @click="provider.activeTab = 'models'">模型列表</button>
        </div>

        <div v-show="provider.activeTab === 'api'" class="provider-content">
          <div class="form-row">
            <label>供应商</label>
            <select v-model="provider.providerId" @change="onProviderChange(provider)">
              <option value="">选择供应商</option>
              <option v-for="p in providerList" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Base URL</label>
            <input v-model="provider.baseUrl" placeholder="API地址" />
          </div>
          <div class="form-row">
            <label>API Key</label>
            <div class="input-group">
              <input v-model="provider.apiKey" :type="provider.showApiKey ? 'text' : 'password'" placeholder="输入API密钥" />
              <button class="toggle-pwd" @click="provider.showApiKey = !provider.showApiKey">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path v-if="provider.showApiKey" d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 0 1 1.563-3.029m5.858.908a3 3 0 1 1 4.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0 1 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 0 1-4.132 5.411m0 0L21 21"/>
                  <template v-else>
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </template>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-show="provider.activeTab === 'models'" class="provider-content">
          <div class="models-header">
            <span>模型列表</span>
            <button class="btn btn-sm" :disabled="!provider.providerId || !provider.apiKey || provider.loading" @click="fetchModelList(provider)">
              <svg v-if="provider.loading" width="14" height="14" class="spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 5"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {{ provider.loading ? '获取中' : '刷新模型' }}
            </button>
          </div>

          <EmptyState v-if="provider.models.length === 0" title="暂无模型" desc="请先配置供应商并获取模型列表" />

          <vxe-table
            v-else
            :data="getPaginatedModels(provider)"
            stripe
            show-overflow="title"
            :row-config="{ keyField: 'id' }"
            :row-class-name="({ row }) => provider.selectedModel === row.id ? 'selected-row' : ''"
            round
          >
            <vxe-column field="id" title="模型ID" min-width="200">
              <template #default="{ row }">
                <span class="model-id">{{ row.id }}</span>
              </template>
            </vxe-column>
            <vxe-column field="name" title="模型名称" min-width="160">
              <template #default="{ row }">
                <span class="model-name">{{ row.name && row.name !== row.id ? row.name : '-' }}</span>
              </template>
            </vxe-column>
            <vxe-column title="延迟" width="80" align="center">
              <template #default="{ row }">
                <button class="speed-btn" :class="{ testing: speedTesting[provider.id + '::' + row.id], success: modelSpeeds[provider.id + '::' + row.id], error: speedErrors[provider.id + '::' + row.id] }" :disabled="speedTesting[provider.id + '::' + row.id]" @click="runSpeedTest(provider, row.id)">
                  <svg v-if="speedTesting[provider.id + '::' + row.id]" width="12" height="12" class="spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 5"/></svg>
                  <span v-else-if="modelSpeeds[provider.id + '::' + row.id]">{{ modelSpeeds[provider.id + '::' + row.id].totalMs }}ms</span>
                  <span v-else-if="speedErrors[provider.id + '::' + row.id]">✗</span>
                  <span v-else>⚡</span>
                </button>
              </template>
            </vxe-column>
            <vxe-column title="选择" width="100" align="center" fixed="right">
              <template #default="{ row }">
                <button class="btn btn-sm" :class="{ 'btn-primary': provider.selectedModel === row.id }" @click="provider.selectedModel = row.id">
                  {{ provider.selectedModel === row.id ? '已选' : '选择' }}
                </button>
              </template>
            </vxe-column>
          </vxe-table>

          <div v-if="provider.totalModels > provider.modelPageSize" class="models-pagination">
            <button :disabled="provider.modelPage <= 1" @click="goToPage(provider, provider.modelPage - 1)">上一页</button>
            <span>第 {{ provider.modelPage }} / {{ Math.ceil(provider.totalModels / provider.modelPageSize) }} 页</span>
            <button :disabled="provider.modelPage >= Math.ceil(provider.totalModels / provider.modelPageSize)" @click="goToPage(provider, provider.modelPage + 1)">下一页</button>
          </div>
        </div>

        <div v-if="provider.error" class="error-message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
          {{ provider.error }}
        </div>

        <div class="provider-footer">
          <div class="footer-item">
            <span>温度</span>
            <input v-model.number="provider.temperature" type="number" min="0" max="2" step="0.1" />
          </div>
          <div class="footer-item">
            <span>最大Token</span>
            <input v-model.number="provider.maxTokens" type="number" min="1" step="100" />
          </div>
          <div class="footer-item">
            <span>选中模型</span>
            <span class="value">{{ provider.selectedModel || '-' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '../../utils/api';
import { toastSuccess, toastError } from '../../utils/toast';
import PageHeader from '../../components/admin/PageHeader.vue';
import EmptyState from '../../components/admin/EmptyState.vue';

const llmSettings = reactive<any>({
  activeProviderId: '',
  providers: [] as any[]
});

const providerList = ref<any[]>([]);
let providerIdCounter = 1;

const modelSpeeds = reactive<Record<string, { totalMs: number; totalTokens: number; tokensPerSecond: number } | null>>({});
const speedTesting = reactive<Record<string, boolean>>({});
const speedErrors = reactive<Record<string, string>>({});

async function runSpeedTest(provider: any, modelId: string) {
  const key = provider.id + '::' + modelId;
  if (speedTesting[key]) return;
  speedTesting[key] = true;
  modelSpeeds[key] = null;
  speedErrors[key] = '';
  try {
    const res = await api.testModelSpeed({ providerId: provider.providerId, apiKey: provider.apiKey, modelId, baseUrl: provider.baseUrl || undefined });
    if (res.code === 0) { modelSpeeds[key] = res.data; speedErrors[key] = ''; }
    else { speedErrors[key] = res.message || '测速失败'; modelSpeeds[key] = null; }
  } catch (err: any) { speedErrors[key] = err.message || '网络错误'; modelSpeeds[key] = null; }
  speedTesting[key] = false;
}

function addProvider() {
  const maxId = llmSettings.providers.reduce((max: number, p: any) => {
    const num = parseInt(p.id?.replace('p_', '') || '0');
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  providerIdCounter = maxId + 1;
  llmSettings.providers.push({
    id: 'p_' + (providerIdCounter++), providerId: '', label: '', baseUrl: '', apiKey: '',
    showApiKey: false, models: [], selectedModel: '', temperature: 0.7, maxTokens: 2048,
    loading: false, error: '', activeTab: 'api', modelPage: 1, modelPageSize: 10, totalModels: 0
  });
}

function removeProvider(providerId: string) {
  const idx = llmSettings.providers.findIndex((p: any) => p.id === providerId);
  if (idx > -1) {
    const removed = llmSettings.providers[idx];
    llmSettings.providers.splice(idx, 1);
    if (llmSettings.activeProviderId === removed.id) llmSettings.activeProviderId = llmSettings.providers[0]?.id || '';
  }
}

function setActive(id: string) { llmSettings.activeProviderId = id; }

function onProviderChange(provider: any) {
  const def = providerList.value.find((p: any) => p.id === provider.providerId);
  if (def) { provider.label = def.label; provider.baseUrl = def.defaultBaseUrl; provider.selectedModel = def.defaultModel; provider.models = []; provider.error = ''; }
  else { provider.label = ''; provider.baseUrl = ''; }
}

async function fetchModelList(provider: any) {
  if (!provider.providerId || !provider.apiKey) { provider.error = '请先选择供应商并填写API Key'; return; }
  provider.loading = true; provider.error = '';
  try {
    const res = await api.fetchModels({ providerId: provider.providerId, apiKey: provider.apiKey, baseUrl: provider.baseUrl || undefined });
    if (res.code === 0) {
      const seen = new Set<string>();
      provider.models = res.data.models.filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      provider.totalModels = provider.models.length; provider.modelPage = 1;
      if (!provider.selectedModel && res.data.models.length > 0) provider.selectedModel = res.data.models[0].id;
    } else { provider.error = res.message || '获取失败'; }
  } catch (err: any) { provider.error = err.message || '网络错误'; }
  provider.loading = false;
}

function getPaginatedModels(provider: any) {
  const start = (provider.modelPage - 1) * provider.modelPageSize;
  return provider.models.slice(start, start + provider.modelPageSize);
}

function goToPage(provider: any, page: number) {
  const totalPages = Math.ceil(provider.totalModels / provider.modelPageSize);
  if (page >= 1 && page <= totalPages) provider.modelPage = page;
}

async function saveSettings() {
  const data: any = {
    llm: {
      activeProviderId: llmSettings.activeProviderId,
      providers: llmSettings.providers.map((p: any) => ({
        id: p.id, providerId: p.providerId, label: p.label, baseUrl: p.baseUrl, apiKey: p.apiKey,
        models: p.models, selectedModel: p.selectedModel, temperature: p.temperature, maxTokens: p.maxTokens,
        activeTab: p.activeTab, modelPage: p.modelPage, modelPageSize: p.modelPageSize, totalModels: p.totalModels
      }))
    }
  };
  const res = await api.saveSettings(data);
  if (res.code === 0) toastSuccess('配置已保存');
  else toastError(res.message || '保存失败');
}

onMounted(async () => {
  const provsRes = await api.getProviders();
  if (provsRes.code === 0) providerList.value = provsRes.data;
  const res = await api.getSettings();
  if (res.code === 0 && res.data?.llm) {
    llmSettings.activeProviderId = res.data.llm.activeProviderId || '';
    llmSettings.providers = (res.data.llm.providers || []).map((p: any) => {
      const seen = new Set<string>();
      const dedupedModels = (p.models || []).filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      return { ...p, models: dedupedModels, showApiKey: false, loading: false, error: '', activeTab: p.activeTab || 'api', modelPage: p.modelPage || 1, modelPageSize: p.modelPageSize || 10, totalModels: p.totalModels || dedupedModels.length };
    });
    if (llmSettings.providers.length > 0) {
      providerIdCounter = Math.max(...llmSettings.providers.map((p: any) => { const num = parseInt(p.id?.replace('p_', '') || '0'); return isNaN(num) ? 0 : num; })) + 1;
    }
  }
});
</script>

<style scoped>
.providers-list { display: flex; flex-direction: column; gap: 16px; }

.provider-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }

.provider-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--bg-input); border-bottom: 1px solid var(--border-light); }

.provider-info { display: flex; align-items: center; gap: 10px; }

.provider-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }

.provider-label { font-size: 15px; font-weight: 600; color: var(--text); }

.provider-header-right { display: flex; align-items: center; gap: 12px; }

.provider-actions { display: flex; gap: 6px; }

.provider-tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 20px; }

.provider-tab { padding: 10px 20px; border: none; background: transparent; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all 0.15s; }

.provider-tab:hover { color: var(--text); }
.provider-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

.provider-content { padding: 16px 20px; }

.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.form-row:last-child { margin-bottom: 0; }
.form-row label { width: 80px; font-size: 13px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
.form-row select, .form-row input { flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); font-size: 13px; color: var(--text); }
.form-row select:focus, .form-row input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }

.input-group { flex: 1; display: flex; align-items: center; }
.input-group input { flex: 1; border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.toggle-pwd { width: 36px; height: 34px; border: 1px solid var(--border); border-left: none; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; background: var(--bg-card); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.toggle-pwd:hover { color: var(--text); }

.models-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--text-secondary); }

.model-id { font-family: var(--font-mono); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.model-name { color: var(--text-secondary); }

:deep(.vxe-body--row.selected-row) { background: var(--primary-bg); }

.speed-btn { width: 32px; height: 28px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.speed-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.speed-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.speed-btn.testing { border-color: var(--warning); color: var(--warning); }
.speed-btn.success { border-color: var(--success); color: var(--success); }
.speed-btn.error { border-color: var(--danger); color: var(--danger); }

.error-message { display: flex; align-items: center; gap: 8px; margin: 0 20px 12px; padding: 10px 14px; background: var(--danger-bg); border: 1px solid var(--danger-bg); border-radius: var(--radius-sm); color: var(--danger); font-size: 13px; }

.provider-footer { display: flex; gap: 24px; padding: 14px 20px; background: var(--bg-input); border-top: 1px solid var(--border-light); }
.footer-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.footer-item input { width: 64px; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); font-size: 12px; color: var(--text); }
.footer-item .value { font-weight: 500; color: var(--primary); font-family: var(--font-mono); }

.models-pagination { display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-light); margin-top: 8px; }
.models-pagination button { padding: 7px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); cursor: pointer; font-size: 13px; color: var(--text-secondary); transition: all 0.15s; }
.models-pagination button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }
.models-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.models-pagination span { font-size: 13px; color: var(--text-secondary); }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .provider-header { flex-wrap: wrap; gap: 12px; }
  .provider-header-right { width: 100%; justify-content: space-between; }
  .form-row { flex-direction: column; align-items: stretch; }
  .form-row label { width: auto; margin-bottom: 4px; }
  .provider-footer { flex-wrap: wrap; gap: 12px; }
}
</style>