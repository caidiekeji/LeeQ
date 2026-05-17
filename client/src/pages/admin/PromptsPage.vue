<!-- LLM提示词管理页 -->
<template>
  <div class="prompts-page">
    <p class="page-desc">管理所有LLM（大模型）使用的系统提示词和约束词。修改后立即生效，无需重启服务。</p>

    <div class="toolbar">
      <span class="toolbar-info">共 {{ prompts.length }} 条提示词</span>
      <span class="toolbar-info">修改自动刷新生效</span>
    </div>

    <vxe-table
      :data="prompts"
      stripe
      show-overflow="title"
      :row-config="{ keyField: 'id' }"
      round
    >
      <vxe-column field="id" title="ID" width="60" align="center" />
      <vxe-column field="promptKey" title="唯一标识" width="160">
        <template #default="{ row }">
          <code class="key-code">{{ row.promptKey }}</code>
        </template>
      </vxe-column>
      <vxe-column field="promptType" title="类型" width="110" align="center">
        <template #default="{ row }">
          <span :class="['type-tag', row.promptType]">{{ row.promptType === 'system' ? '系统提示' : '用户提示' }}</span>
        </template>
      </vxe-column>
      <vxe-column field="description" title="功能说明" min-width="150" />
      <vxe-column field="content" title="提示词内容" min-width="300">
        <template #default="{ row }">
          <span class="content-preview" :title="row.content">{{ row.content.substring(0, 80) }}{{ row.content.length > 80 ? '...' : '' }}</span>
        </template>
      </vxe-column>
      <vxe-column field="updatedAt" title="最后更新" width="140" align="center">
        <template #default="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </vxe-column>
      <vxe-column title="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <button class="btn btn-primary btn-sm" @click="startEdit(row)">编辑</button>
        </template>
      </vxe-column>
    </vxe-table>

    <!-- 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="editing" class="prompt-edit-overlay" @click.self="cancelEdit">
        <div class="prompt-edit-dialog">
          <div class="prompt-edit-header">
            <h3>编辑提示词</h3>
            <button class="prompt-edit-close" @click="cancelEdit">&times;</button>
          </div>
          <div class="prompt-edit-meta">
            <span><b>标识：</b><code>{{ editing.promptKey }}</code></span>
            <span><b>类型：</b>{{ editing.promptType === 'system' ? '系统提示' : '用户提示' }}</span>
            <span><b>说明：</b>{{ editing.description }}</span>
          </div>
          <div class="prompt-edit-body">
            <textarea
              v-model="editContent"
              class="prompt-textarea"
              placeholder="请输入提示词内容"
            ></textarea>
          </div>
          <div class="prompt-edit-footer">
            <span class="prompt-edit-hint">修改后保存立即生效，无需重启服务。</span>
            <div class="prompt-edit-btns">
              <button class="btn" @click="cancelEdit">取消</button>
              <button class="btn btn-primary" @click="saveEdit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';

interface PromptItem {
  id: number;
  promptKey: string;
  promptType: string;
  content: string;
  description: string;
  updatedAt: string;
}

const prompts = ref<PromptItem[]>([]);
const editing = ref<PromptItem | null>(null);
const editContent = ref('');
const saving = ref(false);

onMounted(() => {
  loadPrompts();
});

async function loadPrompts() {
  const res = await api.getPrompts();
  if (res.code === 0) {
    prompts.value = res.data;
  }
}

function startEdit(item: PromptItem) {
  editing.value = item;
  editContent.value = item.content;
}

function cancelEdit() {
  editing.value = null;
  editContent.value = '';
}

async function saveEdit() {
  if (!editing.value || !editContent.value.trim()) return;
  saving.value = true;
  const res = await api.updatePrompt(editing.value.id, editContent.value);
  if (res.code === 0) {
    const item = prompts.value.find(p => p.id === editing.value!.id);
    if (item) {
      item.content = editContent.value;
      item.updatedAt = new Date().toISOString();
    }
    cancelEdit();
  } else {
    alert('保存失败: ' + res.message);
  }
  saving.value = false;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
}
</script>

<style scoped>
.prompts-page { max-width: 1200px; }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.key-code {
  font-size: 12px;
  background: var(--bg-input);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.type-tag {
  display: inline-block;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.type-tag.system {
  background: var(--primary-bg);
  color: var(--primary);
}

.type-tag.user {
  background: #fef3c7;
  color: #92400e;
}

.content-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  display: block;
}

.btn-sm {
  padding: 4px 14px;
  font-size: 13px;
}

/* 编辑弹窗 */
.prompt-edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-edit-dialog {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
  width: 720px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.prompt-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.prompt-edit-header h3 {
  margin: 0;
  font-size: 17px;
  color: var(--text);
  font-weight: 600;
}

.prompt-edit-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 22px;
  color: var(--text-light);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.prompt-edit-close:hover {
  background: var(--bg-input);
  color: var(--text);
}

.prompt-edit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.prompt-edit-meta b {
  color: var(--text);
}

.prompt-edit-meta code {
  font-size: 12px;
  background: var(--bg-input);
  padding: 1px 6px;
  border-radius: 3px;
}

.prompt-edit-body {
  flex: 1;
  overflow: hidden;
  padding: 16px 24px;
}

.prompt-textarea {
  width: 100%;
  height: 100%;
  min-height: 260px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.7;
  resize: none;
  background: var(--bg-input);
  color: var(--text);
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.prompt-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.prompt-edit-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.prompt-edit-hint {
  font-size: 12px;
  color: var(--text-light);
}

.prompt-edit-btns {
  display: flex;
  gap: 10px;
}
</style>