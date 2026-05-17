<template>
  <div v-if="total > pageSize" class="pagination">
    <button :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
    <button class="active">{{ page }}</button>
    <button :disabled="page >= Math.ceil(total / pageSize)" @click="$emit('change', page + 1)">下一页</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  page: number
  pageSize: number
  total: number
}>();
defineEmits<{
  change: [page: number]
}>();
</script>

<style scoped>
.pagination {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 24px;
}
.pagination button {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.pagination button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-bg);
}
.pagination button.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
