<template>
    <div class="ds-page fade-up">
      <PageHeader title="数据源管理" desc="管理信任域名（白名单）和屏蔽域名（黑名单）" />
      <div class="ds-grid">
        <div class="card" v-for="(dsType, key) in dsTypes" :key="key">
          <div class="panel-header">
            <h3>{{ dsType.label }}</h3>
          </div>
          <div class="ds-add-row">
            <input v-model="newDomains[key]" :placeholder="'输入域名，如 example.com'" @keydown.enter="addDomain(key)" />
            <button class="btn btn-primary btn-sm" @click="addDomain(key)" :disabled="adding">{{ adding ? '添加中...' : '添加' }}</button>
          </div>
          <vxe-table
            v-if="dsData[key] && dsData[key].length"
            :data="dsData[key]"
            stripe
            show-overflow="title"
            :row-config="{ keyField: 'id' }"
            round
          >
            <vxe-column field="domain" title="域名" min-width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.domain }}</span>
              </template>
            </vxe-column>
            <vxe-column field="createdAt" title="添加时间" width="170" align="center">
              <template #default="{ row }">
                <span class="mono">{{ formatDate(row.createdAt) }}</span>
              </template>
            </vxe-column>
            <vxe-column title="操作" width="100" align="center" fixed="right">
              <template #default="{ row }">
                <div class="action-cell">
                  <button class="btn btn-sm btn-danger" @click="delDomain(row.id, key)">删除</button>
                </div>
              </template>
            </vxe-column>
          </vxe-table>
          <EmptyState v-else :title="'暂无' + dsType.label" />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE as DS_PAGE_SIZE, DEFAULT_PAGE } from '../../utils/constants';
import { toastSuccess, toastError, showConfirm } from '../../utils/toast';
import PageHeader from '../../components/admin/PageHeader.vue';
import EmptyState from '../../components/admin/EmptyState.vue';

const dsTypes: any = { trusted: { label: '信任域名（白名单）' }, blocked: { label: '屏蔽域名（黑名单）' } };
const dsData = reactive<any>({ trusted: [], blocked: [] });
const newDomains: any = reactive({ trusted: '', blocked: '' });
const adding = ref(false);
const dsPageSize = DS_PAGE_SIZE * 5;

async function loadData(type: string) {
  const res = await api.getDatasources(`type=${type}&page=${DEFAULT_PAGE}&pageSize=${dsPageSize}`);
  if (res.code === 0) dsData[type] = res.data.list;
}

async function addDomain(type: string) {
  const domain = newDomains[type].trim();
  if (!domain) return;
  if (adding.value) return;
  adding.value = true;
  try {
    const res = await api.addDatasource({ domain, type });
    if (res.code === 0) { newDomains[type] = ''; loadData(type); toastSuccess('添加成功'); }
    else toastError(res.message || '添加失败');
  } catch { toastError('添加失败'); }
  finally { adding.value = false; }
}

async function delDomain(id: number, type: string) {
  const confirmed = await showConfirm('确定要删除该域名吗？');
  if (!confirmed) return;
  const res = await api.deleteDatasource(id);
  if (res.code === 0) { loadData(type); toastSuccess('删除成功'); }
  else toastError(res.message || '删除失败');
}

onMounted(() => { loadData('trusted'); loadData('blocked'); });
</script>

<style scoped>
.ds-page { display: flex; flex-direction: column; gap: 24px; }
.ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.panel-header { margin-bottom: 20px; }
.panel-header h3 { font-size: 16px; font-weight: 600; color: var(--text); }

.ds-add-row { display: flex; gap: 10px; margin-bottom: 16px; }
.ds-add-row input { flex: 1; }

@media (max-width: 1024px) { .ds-grid { grid-template-columns: 1fr; } }
</style>