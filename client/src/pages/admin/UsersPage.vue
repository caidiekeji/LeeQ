<template>
  <div class="page-container">
    <PageHeader title="用户管理" desc="管理所有注册用户">
      <template #actions>
        <SearchBar v-model="keyword" placeholder="搜索用户名或昵称..." @search="loadData" />
      </template>
    </PageHeader>

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
          <span class="mono">{{ row.id }}</span>
        </template>
      </vxe-column>
      <vxe-column field="username" title="用户名" min-width="120" />
      <vxe-column field="nickname" title="昵称" min-width="120">
        <template #default="{ row }">
          {{ row.nickname || '-' }}
        </template>
      </vxe-column>
      <vxe-column field="status" title="状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="['badge', row.status === 1 ? 'badge-success' : 'badge-danger']">
            {{ row.status === 1 ? '正常' : '已禁用' }}
          </span>
        </template>
      </vxe-column>
      <vxe-column field="createdAt" title="注册时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <div class="cell-action">
            <button class="btn btn-sm btn-outline" :disabled="actionLoading.has(row.id)" @click="toggleStatus(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </button>
            <button class="btn btn-sm btn-danger" :disabled="actionLoading.has(row.id)" @click="doDelete(row)">删除</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无用户" desc="等待用户注册后将在此显示" />

    <Pagination :page :pageSize :total @change="goPage" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { showConfirm, toastSuccess } from '../../utils/toast';
import Pagination from '../../components/admin/Pagination.vue';
import SearchBar from '../../components/admin/SearchBar.vue';
import EmptyState from '../../components/admin/EmptyState.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = DEFAULT_PAGE_SIZE;
const keyword = ref('');
const actionLoading = ref<Set<string | number>>(new Set());

async function loadData() {
  const params = new URLSearchParams();
  params.set('page', String(page.value));
  params.set('pageSize', String(pageSize));
  if (keyword.value) params.set('keyword', keyword.value);
  const res = await api.getUsers(params.toString());
  if (res.code === 0) { list.value = res.data.list; total.value = res.data.total; }
}

function goPage(p: number) {
  page.value = p;
  loadData();
}

async function toggleStatus(item: any) {
  const confirmed = await showConfirm(item.status === 1 ? '确定禁用该用户？' : '确定启用该用户？');
  if (!confirmed) return;
  actionLoading.value.add(item.id);
  try {
    await api.updateUser(item.id, { status: item.status === 1 ? 0 : 1 });
    toastSuccess(item.status === 1 ? '用户已禁用' : '用户已启用');
    await loadData();
  } finally {
    actionLoading.value.delete(item.id);
  }
}

async function doDelete(item: any) {
  const confirmed = await showConfirm('确定删除该用户？此操作不可恢复');
  if (!confirmed) return;
  actionLoading.value.add(item.id);
  try {
    await api.deleteUser(item.id);
    toastSuccess('用户已删除');
    await loadData();
  } finally {
    actionLoading.value.delete(item.id);
  }
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
</style>