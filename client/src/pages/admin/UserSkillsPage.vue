<template>
  <div class="page-container">
    <PageHeader title="用户自定义技能" desc="管理所有用户创建的自定义技能" />

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
      <vxe-column field="userId" title="用户" min-width="140">
        <template #default="{ row }">
          {{ row.nickname || row.username }}<span class="uid"> (ID:{{ row.userId }})</span>
        </template>
      </vxe-column>
      <vxe-column field="skillName" title="技能名称" min-width="120" />
      <vxe-column field="promptTemplate" title="Prompt模板" min-width="200">
        <template #default="{ row }">
          <span class="text-ellipsis" :title="row.promptTemplate">{{ truncate(row.promptTemplate, TRUNCATE.prompt) }}</span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="创建时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </vxe-column>
      <vxe-column field="updatedAt" title="更新时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <div class="action-cell">
            <button class="btn btn-sm btn-danger" @click="doDelete(row)">删除</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无用户自定义技能" desc="用户创建自定义技能后将在此显示" />

    <Pagination :page="page" :pageSize="pageSize" :total="total" @change="goPage" />
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

function goPage(p: number) { page.value = p; loadData(); }

async function loadData() {
  const res = await api.getAdminUserSkills(`page=${page.value}&pageSize=${pageSize}`);
  if (res.code === 0) { list.value = res.data.list; total.value = res.data.total; }
}

async function doDelete(item: any) {
  const confirmed = await showConfirm(`确定删除用户「${item.username || item.userId}」的技能「${item.skillName}」？`);
  if (!confirmed) return;
  await api.deleteAdminUserSkill(item.id);
  toastSuccess('技能已删除');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
@media (max-width: 768px) {
  .text-cell { max-width: 120px; }
  .uid { display: none; }
}
</style>
