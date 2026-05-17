<template>
  <div class="empty-state fade-up">
    <div class="empty-icon">
      <slot name="icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </slot>
    </div>
    <h3>{{ title }}</h3>
    <p v-if="desc">{{ desc }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
}>();
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
}
.empty-icon { color: var(--text-light); margin-bottom: 16px; }
.empty-state h3 { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
.empty-state p { font-size: 14px; margin: 0; }
.empty-action { margin-top: 20px; }
</style>
