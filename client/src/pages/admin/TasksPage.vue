<template>
  <div class="page-container">
    <PageHeader title="抓取任务" desc="管理网页抓取与爬取任务">
      <template #actions>
        <SearchBar v-model="keyword" placeholder="搜索 URL 或任务 ID..." @search="loadTasks" />
        <button class="btn btn-primary" :disabled="creating" @click="showCreateModal = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ creating ? '创建中...' : '新建任务' }}
        </button>
      </template>
    </PageHeader>

    <div class="tabs">
      <button v-for="t in statusTabs" :key="t.value" :class="['tab', { active: filterStatus === t.value }]" @click="filterStatus = t.value; loadTasks()">{{ t.label }}</button>
    </div>

    <vxe-table
      v-if="tasks.length"
      :data="tasks"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'taskId' }"
      round
    >
      <vxe-column field="taskId" title="ID" width="80" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.taskId }}</span>
        </template>
      </vxe-column>
      <vxe-column field="url" title="目标 URL" min-width="240">
        <template #default="{ row }">
          <div class="cell-url">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="url-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>
            <span class="url-text">{{ truncate(row.url, TRUNCATE.url) }}</span>
          </div>
        </template>
      </vxe-column>
      <vxe-column field="taskType" title="类型" width="120" align="center">
        <template #default="{ row }">
          <span :class="['badge', row.taskType === 'scrape' ? 'badge-info' : 'badge-warning']">
            {{ row.taskType === 'scrape' ? '单页抓取' : '全网爬取' }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="status" title="状态" width="110" align="center">
        <template #default="{ row }">
          <span :class="['status-badge', statusBadgeClass(row.status)]">
            <span class="status-dot"></span>
            {{ statusLabel(row.status) }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="创建时间" width="170" align="center">
        <template #default="{ row }">
          <span class="mono">{{ formatDate(row.createdAt) }}</span>
        </template>
      </vxe-column>
      <vxe-column title="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <div class="cell-action">
            <router-link :to="`/admin/tasks/${row.taskId}`" class="btn btn-sm btn-outline">查看</router-link>
            <button v-if="row.status === 'failed'" class="btn btn-sm btn-danger" @click="retryTask(row.taskId)">重试</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无抓取任务" desc="点击「新建任务」创建第一个抓取任务" />

    <Pagination :page :pageSize :total @change="goPage" />
  </div>

  <div class="modal-overlay" v-if="showCreateModal" @click.self="showCreateModal = false">
    <div class="modal">
      <h3>新建抓取任务</h3>
      <div class="form-group">
        <label>目标 URL</label>
        <input v-model="newUrl" placeholder="https://example.com/article" />
      </div>
      <div class="form-group">
        <label>任务类型</label>
        <select v-model="newTaskType">
          <option value="scrape">单页抓取 (scrape)</option>
          <option value="crawl">全网爬取 (crawl)</option>
        </select>
      </div>
      <div class="form-group" v-if="newTaskType === 'crawl'">
        <label>爬取深度</label>
        <input v-model.number="newCrawlDepth" type="number" min="1" max="5" />
      </div>
      <div class="modal-actions">
        <button class="btn" @click="showCreateModal = false">取消</button>
        <button class="btn btn-primary" :disabled="creating" @click="createTask">{{ creating ? '创建中...' : '创建任务' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate, truncate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE, TRUNCATE } from '../../utils/constants';
import Pagination from '../../components/admin/Pagination.vue';
import SearchBar from '../../components/admin/SearchBar.vue';
import EmptyState from '../../components/admin/EmptyState.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const tasks = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const filterStatus = ref('all');
const keyword = ref('');
const showCreateModal = ref(false);
const newUrl = ref('');
const newTaskType = ref('scrape');
const newCrawlDepth = ref(2);
const creating = ref(false);

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' }
];

function statusLabel(s: string) {
  const map: any = { pending: '等待中', running: '进行中', completed: '已完成', failed: '失败' };
  return map[s] || s;
}

function statusBadgeClass(s: string) {
  const map: any = { pending: 'status-pending', running: 'status-running', completed: 'status-completed', failed: 'status-failed' };
  return map[s] || 'status-pending';
}

async function loadTasks() {
  const params = new URLSearchParams();
  params.set('page', String(page.value));
  params.set('pageSize', String(pageSize));
  params.set('status', filterStatus.value);
  if (keyword.value) params.set('keyword', keyword.value);
  const res = await api.getTasks(params.toString());
  if (res.code === 0) {
    tasks.value = res.data.list;
    total.value = res.data.total;
  }
}

function goPage(p: number) {
  page.value = p;
  loadTasks();
}

async function createTask() {
  if (!newUrl.value) return;
  creating.value = true;
  try {
    await api.createTask({ url: newUrl.value, taskType: newTaskType.value, crawlDepth: newCrawlDepth.value });
    showCreateModal.value = false;
    newUrl.value = '';
    loadTasks();
  } finally {
    creating.value = false;
  }
}

async function retryTask(taskId: string) {
  await api.retryTask(taskId);
  loadTasks();
}

onMounted(loadTasks);
</script>

<style scoped>
.cell-url {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-icon {
  color: var(--text-light);
  flex-shrink: 0;
}

.url-text {
  font-size: 14px;
}

.cell-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}
</style>
