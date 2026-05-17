<template>
  <div class="page-container">
    <PageHeader title="技能执行记录" desc="查看所有技能执行历史" />

    <vxe-table
      v-if="list.length"
      :data="list"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'id' }"
      round
    >
      <vxe-column field="id" title="ID" width="80" align="center" />
      <vxe-column field="skillName" title="技能名称" min-width="140" />
      <vxe-column field="userInput" title="用户输入" min-width="200">
        <template #default="{ row }">
          <span :title="row.userInput">{{ truncate(row.userInput, TRUNCATE.prompt) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="llmResult" title="执行结果" min-width="200">
        <template #default="{ row }">
          <span :title="row.llmResult">{{ truncate(row.llmResult, TRUNCATE.result) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="执行时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <div class="cell-action">
            <button class="btn btn-sm" @click="viewDetail(row)">查看</button>
            <button class="btn btn-sm btn-danger" @click="doDelete(row.id)">删除</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无记录" desc="暂无技能执行记录" />

    <Pagination :page="page" :pageSize="pageSize" :total="total" @change="goPage" />

    <div class="modal-overlay" v-if="showDetail" @click.self="showDetail = false">
      <div class="modal detail-modal">
        <h3>执行详情</h3>
        <div class="detail-section">
          <label>技能名称</label>
          <p>{{ detailItem?.skillName }}</p>
        </div>
        <div class="detail-section">
          <label>用户输入</label>
          <pre>{{ detailItem?.userInput }}</pre>
        </div>
        <div class="detail-section">
          <label>执行结果</label>
          <div class="detail-result">{{ detailItem?.llmResult }}</div>
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
  const res = await api.getSkillExecutions(`page=${page.value}&pageSize=${pageSize}`);
  if (res.code === 0) { list.value = res.data.list; total.value = res.data.total; }
}

function viewDetail(item: any) { detailItem.value = item; showDetail.value = true; }

async function doDelete(id: number) {
  const confirmed = await showConfirm('确定删除该记录？');
  if (!confirmed) return;
  await api.deleteSkillExecution(id);
  toastSuccess('记录已删除');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
.cell-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .modal { width: 90%; padding: 20px; }
  .detail-modal { width: 90%; }
}
</style>