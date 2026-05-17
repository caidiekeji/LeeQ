<template>
  <button
    class="msg-action-btn"
    :class="{ active, copied }"
    @click="handleClick"
    :title="title"
  >
    <svg
      v-if="icon === 'copy'"
      v-show="!copied"
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    <svg
      v-if="icon === 'copy'"
      v-show="copied"
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
    >
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <svg
      v-if="icon === 'useful'"
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>
    <svg
      v-if="icon === 'useless'"
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
    </svg>
    <svg
      v-if="icon === 'edit'"
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  icon: 'copy' | 'useful' | 'useless' | 'edit';
  title?: string;
  active?: boolean;
  copied?: boolean;
}>(), {
  title: '',
  active: false,
  copied: false,
});

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  emit('click');
}
</script>

<style scoped>
.msg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--msg-btn-size);
  height: var(--msg-btn-size);
  border: 1px solid var(--border);
  border-radius: var(--msg-btn-radius);
  background: var(--bg-card);
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.msg-action-btn:hover {
  background: var(--bg-input);
  color: var(--text);
  border-color: var(--text-light);
}

.msg-action-btn.copied {
  color: var(--success);
  border-color: var(--success);
  background: var(--success-bg);
}

.msg-action-btn.active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-bg);
}
</style>