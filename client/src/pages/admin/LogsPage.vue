<template>
  <div class="page-container">
    <PageHeader title="搜索日志" desc="查看所有用户搜索记录">
      <template #actions>
        <SearchBar v-model="keyword" placeholder="按关键词搜索..." @search="loadLogs" />
        <div class="date-inputs">
          <input type="date" v-model="startDate" />
          <span class="date-sep">至</span>
          <input type="date" v-model="endDate" />
        </div>
        <button class="btn btn-primary btn-sm" @click="loadLogs">搜索</button>
        <button class="btn btn-sm" @click="resetFilter">重置</button>
      </template>
    </PageHeader>

    <vxe-table
      v-if="logs.length"
      :data="logs"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'logId' }"
      round
    >
      <vxe-column field="logId" title="ID" width="80" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.logId }}</span>
        </template>
      </vxe-column>
      <vxe-column field="query" title="搜索词" min-width="200">
        <template #default="{ row }">
          <span class="text-truncate">{{ row.query }}</span>
        </template>
      </vxe-column>
      <vxe-column field="mode" title="模式" width="110" align="center">
        <template #default="{ row }">
          <span :class="['badge', row.mode === 'summarize' ? 'badge-info' : 'badge-warning']">
            {{ row.mode === 'summarize' ? 'URL摘要' : '普通搜索' }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="elapsedMs" title="耗时" width="100" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.elapsedMs }}ms</span>
        </template>
      </vxe-column>
      <vxe-column field="ip" title="IP" width="140" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.ip }}</span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="时间" width="170" align="center">
        <template #default="{ row }">
          <span class="mono">{{ formatDate(row.createdAt) }}</span>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无搜索日志" desc="用户搜索后将在此显示记录" />

    <Pagination :page :pageSize :total @change="goPage" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import Pagination from '../../components/admin/Pagination.vue';
import SearchBar from '../../components/admin/SearchBar.vue';
import EmptyState from '../../components/admin/EmptyState.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const keyword = ref('');
const startDate = ref('');
const endDate = ref('');

async function loadLogs() {
  const params = new URLSearchParams();
  params.set('page', String(page.value));
  params.set('pageSize', String(pageSize));
  if (keyword.value) params.set('keyword', keyword.value);
  if (startDate.value) params.set('startDate', startDate.value);
  if (endDate.value) params.set('endDate', endDate.value);
  const res = await api.getLogs(params.toString());
  if (res.code === 0) { logs.value = res.data.list; total.value = res.data.total; }
}

function goPage(p: number) {
  page.value = p;
  loadLogs();
}

function resetFilter() {
  keyword.value = '';
  startDate.value = '';
  endDate.value = '';
  loadLogs();
}

onMounted(loadLogs);
</script>

<style scoped>
.date-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}
.date-inputs input[type="date"] {
  width: auto;
  font-size: 13px;
  padding: 8px 10px;
  border:1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text);
}
.date-sep {
  color: var(--text-light);
  font-size: 13px;
}
.cell-query { max-width: 300px; }
.cell-time, .cell-ip { font-size: 13px; }
.cell-date { font-size: 13px; white-space: nowrap; }
</style>
