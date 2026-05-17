<template>
  <Teleport to="body">
    <div class="cdm-overlay" v-show="visible" @click.self="$emit('close')">
      <div class="cdm-dialog">
        <div class="cdm-header">
          <h3>{{ title }}</h3>
          <button class="cdm-close" @click="$emit('close')">&times;</button>
        </div>
        <div class="cdm-meta" v-if="meta && meta.length">
          <span v-for="(m, i) in meta" :key="i"><b>{{ m.label }}：</b>{{ m.value }}</span>
        </div>
        <div class="cdm-body">
          <div class="cdm-session" v-for="item in sessions" :key="item.chatId">
            <div class="cdm-session-head" @click="toggle(item.chatId)">
              <span class="cdm-session-user">{{ item.nickname || item.username }}</span>
              <span class="cdm-session-time">{{ formatDate(item.firstCreated) }}</span>
              <span class="cdm-session-count">{{ item.messageCount }} 条消息</span>
              <svg class="cdm-expand" :class="{ expanded: expandedMap[item.chatId] }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="cdm-session-msgs" v-show="expandedMap[item.chatId]">
              <div class="cdm-msg" v-for="msg in item.messages" :key="msg.id" :class="'cdm-msg-' + msg.role">
                <div class="cdm-msg-label">{{ msg.role === 'assistant' ? 'AI 回答' : '用户提问' }}</div>
                <div class="cdm-msg-text">{{ msg.content }}</div>
                <div class="cdm-msg-time">{{ formatDate(msg.createdAt) }}</div>
              </div>
            </div>
          </div>
          <div class="cdm-empty" v-if="sessions.length === 0">
            <p>{{ emptyText }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  meta?: Array<{ label: string; value: string }>;
  sessions?: any[];
  emptyText?: string;
}>(), {
  title: '对话详情',
  sessions: () => [],
  emptyText: '暂无聊天记录'
});

defineEmits<{ close: [] }>();

const expandedMap = reactive<Record<string, boolean>>({});

function toggle(chatId: string) {
  expandedMap[chatId] = !expandedMap[chatId];
}

function formatDate(d: string) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }

watch(() => props.visible, (v) => {
  if (v) Object.keys(expandedMap).forEach(k => delete expandedMap[k]);
});
</script>

<style>
.cdm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.cdm-dialog {
  background: var(--bg-card);
  border-radius: 12px;
  width: 720px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.cdm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.cdm-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.cdm-close {
  background: none; border: none; font-size: 22px; cursor: pointer;
  color: var(--text-tertiary); line-height: 1; padding: 0 4px;
}
.cdm-close:hover { color: var(--text); }
.cdm-meta {
  display: flex; gap: 20px; padding: 10px 20px; font-size: 13px;
  color: var(--text-secondary); background: var(--bg-subtle);
  border-bottom: 1px solid var(--border); flex-wrap: wrap; flex-shrink: 0;
}
.cdm-body { flex: 1 1 0%; overflow-y: auto; padding: 12px 16px; }
.cdm-empty { padding: 40px 20px; text-align: center; color: var(--text-tertiary); }

.cdm-session { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
.cdm-session-head {
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  cursor: pointer; user-select: none; background: var(--bg-subtle);
  transition: background 0.15s; font-size: 13px; flex-wrap: wrap;
}
.cdm-session-head:hover { background: var(--bg-input); }
.cdm-session-user { font-weight: 600; color: var(--text); }
.cdm-session-time { color: var(--text-secondary); }
.cdm-session-count {
  background: var(--tag-bg); color: var(--primary);
  padding: 1px 8px; border-radius: 10px; font-size: 12px;
}
.cdm-expand { flex-shrink: 0; transition: transform 0.2s; color: var(--text-tertiary); }
.cdm-expand.expanded { transform: rotate(180deg); }

.cdm-session-msgs { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border); }
.cdm-msg { border-radius: 6px; padding: 10px 14px; border: 1px solid var(--border); }
.cdm-msg-user { background: linear-gradient(135deg, var(--primary-bg) 0%, var(--bg-card) 100%); border-left: 3px solid var(--primary); }
.cdm-msg-assistant { background: linear-gradient(135deg, var(--success-bg) 0%, var(--bg-card) 100%); border-left: 3px solid var(--success); }
.cdm-msg-label { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.cdm-msg-user .cdm-msg-label { color: var(--primary); }
.cdm-msg-assistant .cdm-msg-label { color: var(--success); }
.cdm-msg-text { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; margin-bottom: 2px; }
.cdm-msg-time { font-size: 10px; color: var(--text-tertiary); text-align: right; }

@media (max-width: 768px) {
  .cdm-dialog { width: 96vw; }
  .cdm-meta { gap: 10px; }
}
</style>
