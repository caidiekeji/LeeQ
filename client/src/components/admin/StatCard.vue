<template>
  <div class="stat-card">
    <div class="stat-icon" :class="'stat-icon-' + color">
      <slot name="icon"></slot>
    </div>
    <div class="stat-info">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">
        <span class="count-up">{{ value }}</span>
        <span v-if="unit" class="stat-unit">{{ unit }}</span>
      </div>
    </div>
    <div v-if="trend !== undefined" class="stat-trend" :class="trend >= 0 ? 'trend-up' : 'trend-down'">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline v-if="trend >= 0" points="18 9 12 3 6 9"/><line v-if="trend >= 0" x1="12" y1="3" x2="12" y2="21"/>
        <polyline v-if="trend < 0" points="6 15 12 21 18 15"/><line v-if="trend < 0" x1="12" y1="21" x2="12" y2="3"/>
      </svg>
      <span>{{ Math.abs(trend) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  unit?: string
  trend?: number
  color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'rose'
}>();
</script>

<style scoped>
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: box-shadow 0.3s;
}

.stat-card:hover {
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-blue { background: #E6F7FF; color: #1890FF; }
.stat-icon-green { background: #F6FFED; color: #52C41A; }
.stat-icon-purple { background: #F9F0FF; color: #722ED1; }
.stat-icon-orange { background: #FFF7E6; color: #FA8C16; }
.stat-icon-cyan { background: #E6FFFB; color: #13C2C2; }
.stat-icon-rose { background: #FFF0F6; color: #EB2F96; }

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1;
}

.stat-value {
  font-size: 30px;
  font-weight: 600;
  color: var(--text);
  line-height: 38px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.stat-unit {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: 4px;
  font-weight: 400;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 4px;
}

.trend-up { color: #CF1322; }
.trend-up svg { color: #CF1322; }
.trend-down { color: #52C41A; }
.trend-down svg { color: #52C41A; }
</style>