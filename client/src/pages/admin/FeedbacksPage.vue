<template>
  <div class="page-container">
    <PageHeader title="用户反馈" desc="查看用户对 AI 答案的评价" />

    <vxe-table
      v-if="feedbacks.length"
      :data="feedbacks"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'feedbackId' }"
      round
    >
      <vxe-column field="feedbackId" title="ID" width="80" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.feedbackId }}</span>
        </template>
      </vxe-column>
      <vxe-column field="searchId" title="搜索 ID" width="100" align="center">
        <template #default="{ row }">
          <span class="mono">{{ row.searchId }}</span>
        </template>
      </vxe-column>
      <vxe-column field="query" title="搜索词" min-width="200">
        <template #default="{ row }">
          <span v-if="row.query" class="query-link" @click="openChatModal(row.query)">{{ row.query }}</span>
          <span v-else class="query-empty">-</span>
        </template>
      </vxe-column>
      <vxe-column field="rating" title="评价" width="110" align="center">
        <template #default="{ row }">
          <span :class="['badge', row.rating === 'useful' ? 'badge-success' : 'badge-danger']">
            {{ row.rating === 'useful' ? '👍 有用' : '👎 无用' }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="时间" width="170" align="center">
        <template #default="{ row }">
          <span class="mono">{{ formatDate(row.createdAt) }}</span>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无反馈记录" desc="用户对 AI 答案的评价将在这里显示" />

    <Pagination :page :pageSize :total @change="goPage" />

    <ChatDetailModal
      :visible="showModal"
      :title="'关联聊天记录「' + modalKeyword + '」'"
      :sessions="chatList"
      empty-text="未找到与该搜索词相关的聊天记录"
      @close="closeModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from '../../utils/constants';
import Pagination from '../../components/admin/Pagination.vue';
import ChatDetailModal from '../../components/admin/ChatDetailModal.vue';
import EmptyState from '../../components/admin/EmptyState.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const feedbacks = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const showModal = ref(false);
const modalKeyword = ref('');
const chatList = ref<any[]>([]);

async function loadFeedbacks() {
  const res = await api.getFeedbacks(`page=${page.value}&pageSize=${pageSize}`);
  if (res.code === 0) { feedbacks.value = res.data.list; total.value = res.data.total; }
}

function goPage(p: number) {
  page.value = p;
  loadFeedbacks();
}

async function openChatModal(keyword: string) {
  modalKeyword.value = keyword;
  showModal.value = true;
  chatList.value = [];
  const res = await api.getAdminChatHistory(`page=${DEFAULT_PAGE}&pageSize=${DEFAULT_PAGE_SIZE}&keyword=${encodeURIComponent(keyword)}`);
  if (res.code === 0) { chatList.value = res.data.list; }
}

function closeModal() {
  showModal.value = false;
  modalKeyword.value = '';
  chatList.value = [];
}

onMounted(loadFeedbacks);
</script>

<style scoped>
.cell-query {
  max-width: 300px;
}
.cell-time {
  font-size: 13px;
  white-space: nowrap;
}
.query-link {
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}
.query-link:hover {
  color: var(--primary-dark);
  text-decoration-style: solid;
}
.query-empty {
  color: var(--text-tertiary);
}
</style>