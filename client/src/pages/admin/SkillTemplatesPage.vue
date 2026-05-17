<template>
  <div class="page-container">
    <PageHeader title="技能模板" desc="管理和配置系统技能模板">
      <template #actions>
        <button class="btn btn-primary btn-sm" @click="openCreate">+ 新增技能</button>
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
          <span class="cell-id">{{ row.id }}</span>
        </template>
      </vxe-column>
      <vxe-column field="skillName" title="技能名称" min-width="120" />
      <vxe-column field="skillKey" title="技能标识" min-width="120">
        <template #default="{ row }">
          <code>{{ row.skillKey }}</code>
        </template>
      </vxe-column>
      <vxe-column field="description" title="描述" min-width="200">
        <template #default="{ row }">
          <span class="desc-cell">{{ row.description }}</span>
        </template>
      </vxe-column>
      <vxe-column field="status" title="状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="['status-tag', row.status === 1 ? 'status-on' : 'status-off']">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </span>
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
            <button class="btn btn-sm" @click="openEdit(row)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="doDelete(row.id)">删除</button>
          </div>
        </template>
      </vxe-column>
    </vxe-table>

    <EmptyState v-else title="暂无技能模板" desc="点击「新增技能」按钮创建第一个模板" />

    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ editingId ? '编辑技能' : '新增技能' }}</h3>
        <div class="form-group">
          <label>技能名称</label>
          <input v-model="form.skillName" placeholder="技能名称" />
        </div>
        <div class="form-group">
          <label>技能标识</label>
          <input v-model="form.skillKey" placeholder="技能标识 (英文)" />
        </div>
        <div class="form-group">
          <label>Prompt 模板</label>
          <textarea v-model="form.promptTemplate" placeholder="Prompt 模板" rows="4"></textarea>
        </div>
        <div class="form-group">
          <label>描述</label>
          <input v-model="form.description" placeholder="技能描述" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="form.status">
            <option :value="1">启用</option>
            <option :value="0">禁用</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="doSave" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { toastSuccess, toastError, showConfirm } from '../../utils/toast';
import EmptyState from '../../components/admin/EmptyState.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

interface SkillTemplate {
  id: number;
  skillName: string;
  skillKey: string;
  promptTemplate: string;
  description: string;
  status: number;
  createdAt: string;
}

const list = ref<SkillTemplate[]>([]);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const form = ref({ skillName: '', skillKey: '', promptTemplate: '', description: '', status: 1 });

async function loadData() {
  const res = await api.getSkillTemplates();
  if (res.code === 0) list.value = res.data;
}

function openCreate() {
  editingId.value = null;
  form.value = { skillName: '', skillKey: '', promptTemplate: '', description: '', status: 1 };
  showModal.value = true;
}

function openEdit(item: SkillTemplate) {
  editingId.value = item.id;
  form.value = { skillName: item.skillName, skillKey: item.skillKey, promptTemplate: item.promptTemplate, description: item.description, status: item.status };
  showModal.value = true;
}

async function doSave() {
  if (!form.value.skillName || !form.value.skillKey || !form.value.promptTemplate) { toastError('请填写完整信息'); return; }
  saving.value = true;
  try {
    if (editingId.value) { await api.updateSkillTemplate(editingId.value, form.value); toastSuccess('技能已更新'); }
    else {
      const res = await api.createSkillTemplate(form.value);
      if (res.code !== 0) { toastError(res.message); saving.value = false; return; }
      toastSuccess('技能已创建');
    }
    showModal.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
}

async function doDelete(id: number) {
  const confirmed = await showConfirm('确定删除该技能模板？');
  if (!confirmed) return;
  await api.deleteSkillTemplate(id);
  toastSuccess('技能已删除');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
@media (max-width: 768px) {
  .modal { width: 90%; padding: 20px; }
}
</style>