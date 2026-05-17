<template>
  <div class="page-container">
    <PageHeader title="文档分析记录" desc="查看所有文档分析历史" />

    <vxe-table
      v-if="list.length"
      :data="list"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'id' }"
      round
    >
      <vxe-column field="id" title="ID" width="80" align="center">
        <template #default="{ row }">
          <span class="cell-id">{{ row.id }}</span>
        </template>
      </vxe-column>
      <vxe-column field="fileName" title="文件名" min-width="160">
        <template #default="{ row }">
          {{ row.fileName || '-' }}
        </template>
      </vxe-column>
      <vxe-column field="fileType" title="文件类型" width="100" align="center">
        <template #default="{ row }">
          <span class="type-tag">{{ row.fileType || '-' }}</span>
        </template>
      </vxe-column>
      <vxe-column field="userInput" title="用户输入" min-width="180">
        <template #default="{ row }">
          <span class="text-ellipsis" :title="row.userInput">{{ truncate(row.userInput, TRUNCATE.input) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="llmResult" title="分析结果" min-width="200">
        <template #default="{ row }">
          <span class="text-ellipsis" :title="row.llmResult">{{ truncate(row.llmResult, TRUNCATE.result) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="创建时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <div class="action-cell">
            <button class="btn btn-sm" @click="viewDetail(row)">查看</button>
            <button class="btn btn-sm btn-danger" @click="doDelete(row.id)">删除</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无记录" desc="用户上传并分析文档后将在此显示" />

    <Pagination :page="page" :pageSize="pageSize" :total="total" @change="goPage" />

    <div class="modal-overlay" v-if="showDetail" @click.self="showDetail = false">
      <div class="modal detail-modal">
        <h3>分析详情</h3>
        <div class="detail-section">
          <label>文件名</label>
          <p>{{ detailItem?.fileName || '无文件' }} <span class="type-tag" v-if="detailItem?.fileType">.{{ detailItem?.fileType }}</span></p>
        </div>
        <div class="detail-section">
          <label>用户输入</label>
          <pre>{{ detailItem?.userInput || '无' }}</pre>
        </div>
        <div class="detail-section">
          <label>分析结果</label>
          <div class="detail-result">{{ detailItem?.llmResult || '无' }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showDetail = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate, truncate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE, TRUNCATE } from '../../utils/constants';
import { showConfirm, toastSuccess } from '../../utils/toast';
import EmptyState from '../../components/admin/EmptyState.vue';
import Pagination from '../../components/admin/Pagination.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const showDetail = ref(false);
const detailItem = ref<any>(null);

function goPage(p: number) { page.value = p; loadData(); }

async function loadData() {
  const res = await api.getDocumentAnalysis(`page=${page.value}&pageSize=${pageSize}`);
  if (res.code === 0) { list.value = res.data.list; total.value = res.data.total; }
}

function viewDetail(item: any) { detailItem.value = item; showDetail.value = true; }

async function doDelete(id: number) {
  const confirmed = await showConfirm('确定删除该记录？');
  if (!confirmed) return;
  await api.deleteDocumentAnalysis(id);
  toastSuccess('记录已删除');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
@media (max-width: 768px) {
  .detail-modal { width: 90%; }
}
</style>
