<template>
  <div class="page-container">
    <PageHeader title="聊天历史" desc="查看所有用户聊天记录">
      <template #actions>
        <div class="search-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="userId" placeholder="用户ID筛选..." @keydown.enter="loadData" />
        </div>
        <button class="btn btn-primary btn-sm" @click="loadData">搜索</button>
        <button class="btn btn-sm" @click="userId=''; loadData()">重置</button>
      </template>
    </PageHeader>

    <vxe-table
      v-if="list.length"
      :data="list"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'chatId' }"
      round
    >
      <vxe-column field="nickname" title="用户" width="120">
        <template #default="{ row }">
          {{ row.nickname || row.username }}
        </template>
      </vxe-column>
      <vxe-column field="chatId" title="会话ID" width="160">
        <template #default="{ row }">
          <span class="mono">{{ truncate(row.chatId, TRUNCATE.id) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="messageCount" title="消息数" width="100" align="center">
        <template #default="{ row }">
          <span class="msg-count-tag">{{ row.messageCount }} 条</span>
        </template>
      </vxe-column>
      <vxe-column field="preview" title="预览" min-width="200">
        <template #default="{ row }">
          <span :title="row.preview">{{ truncate(row.preview, TRUNCATE.preview) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="firstCreated" title="时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.firstCreated) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <button class="btn btn-primary btn-xs" @click="openDetail(row)">查看详情</button>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无聊天记录" desc="用户聊天后将在此显示" />

    <Pagination :page="page" :pageSize="pageSize" :total="total" @change="goPage" />

    <ChatDetailModal
      :visible="showModal"
      title="对话详情"
      :meta="detailMeta"
      :sessions="detailSessions"
      @close="closeDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate, truncate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE, TRUNCATE } from '../../utils/constants';
import ChatDetailModal from '../../components/admin/ChatDetailModal.vue';
import EmptyState from '../../components/admin/EmptyState.vue';
import Pagination from '../../components/admin/Pagination.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const userId = ref('');
const showModal = ref(false);
const detailItem = ref<any>(null);

const detailMeta = computed(() => detailItem.value ? [
  { label: '用户', value: detailItem.value.nickname || detailItem.value.username },
  { label: '会话', value: detailItem.value.chatId },
  { label: '消息', value: `${detailItem.value.messageCount} 条` }
] : []);

const detailSessions = computed(() => detailItem.value ? [detailItem.value] : []);

function openDetail(item: any) {
  detailItem.value = item;
  showModal.value = true;
}

function closeDetail() {
  showModal.value = false;
  detailItem.value = null;
}

async function loadData() {
  const params = `page=${page.value}&pageSize=${pageSize}${userId.value ? `&userId=${encodeURIComponent(userId.value)}` : ''}`;
  const res = await api.getAdminChatHistory(params);
  if (res.code === 0) { list.value = res.data.list; total.value = res.data.total; }
}

function goPage(p: number) {
  page.value = p;
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.msg-count-tag {
  background: var(--tag-bg);
  color: var(--primary);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.preview-cell {
  max-width: 260px;
  color: var(--text-tertiary);
  font-size: 13px;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  min-width: 200px;
}
.search-input-wrap svg { color: var(--text-light); flex-shrink: 0; }
.search-input-wrap input {
  flex:1;
  background: transparent;
  border: none;
  padding:9px 0;
  font-size:13px;
  color: var(--text);
  outline:none;
}
</style>
