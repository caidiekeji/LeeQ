<template>
  <div class="message-item" :class="[role, messageType]" :id="messageId">
    <div class="message-avatar" v-if="!(messageType === 'context')">
      <svg v-if="role === 'user'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4-4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    </div>

    <!-- 纯操作气泡（无文本，仅文件/技能操作） -->
    <div v-if="messageType === 'context'" class="msg-wrap context-msg-wrap">
      <div class="message-body context-body">
        <div class="context-text">
          <span v-if="removedFileNames.length > 0">🗑 已移除文件: {{ removedFileNames.join(', ') }}</span>
        </div>
      </div>
    </div>

    <!-- 用户消息（含附件区+文本区） -->
    <div v-else-if="role === 'user'" class="msg-wrap user-msg-wrap">
      <!-- 附件区 -->
      <div class="attachment-area" v-if="attachments.length > 0 || skillTag">
        <div class="attach-chips">
          <div v-for="file in attachments" :key="file.name" class="attach-chip file-chip" :class="{ 'file-error': file.status === 'parse_error' }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="attach-name">{{ file.name }}</span>
            <span v-if="file.status === 'parse_error'" class="attach-status error">⚠</span>
            <span v-else class="attach-status ok">✓</span>
          </div>
          <div v-if="skillTag" class="attach-chip skill-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            </svg>
            <span class="attach-name">{{ skillTag }}</span>
          </div>
        </div>
      </div>
      <div class="message-body">
        <div class="message-text">{{ content }}</div>
      </div>
      <div class="msg-actions-below">
        <slot name="actions">
          <MsgActionBtn icon="copy" :copied="copied" title="复制" @click="doCopy" />
          <MsgActionBtn icon="edit" title="编辑" @click="$emit('edit', content)" />
        </slot>
      </div>
    </div>

    <!-- AI 消息 -->
    <div v-else class="msg-wrap assistant-msg-wrap">
      <div class="message-body">
        <div v-if="loading && !content" class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <div v-if="content" class="message-text markdown-body" v-html="renderedContent"></div>
      </div>
      <div v-if="content && !loading" class="msg-actions-below">
        <MsgActionBtn icon="copy" :copied="copied" title="复制" @click="doCopy" />
        <slot name="assistant-actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { renderMarkdown, runMermaid } from '../../../utils/markdown';
import MsgActionBtn from './MsgActionBtn.vue';

interface FileAttachment {
  name: string;
  type: string;
  status: 'parsed' | 'parse_error' | 'parsing';
}

const props = withDefaults(defineProps<{
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;
  loading?: boolean;
  attachments?: FileAttachment[];
  skillTag?: string;
  messageType?: string;
  removedFileNames?: string[];
}>(), {
  messageId: '',
  loading: false,
  attachments: () => [],
  skillTag: '',
  messageType: 'text',
  removedFileNames: () => [],
});

const emit = defineEmits<{
  copyContent: [text: string];
  edit: [text: string];
}>();

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

function doCopy() {
  emit('copyContent', props.content);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => { copied.value = false; }, 1500);
}

const renderedContent = computed(() => renderMarkdown(props.content));

watch(() => props.content, () => {
  if (props.content && props.role === 'assistant') {
    nextTick(() => {
      const el = document.getElementById(props.messageId || '');
      if (el) runMermaid(el);
    });
  }
});

onMounted(() => {
  if (props.content && props.role === 'assistant') {
    nextTick(() => {
      const el = document.getElementById(props.messageId || '');
      if (el) runMermaid(el);
    });
  }
});
</script>

<style scoped>
.message-item {
  display: flex;
  gap: var(--msg-gap);
  animation: fadeUp 0.3s ease;
  width: 100%;
  overflow: visible;
}

.message-item.user { flex-direction: row-reverse; }
.message-item.context { justify-content: center; }

.message-avatar {
  width: var(--msg-avatar-size);
  height: var(--msg-avatar-size);
  border-radius: 50%;
  background: var(--bg-input);
  display: var(--msg-avatar-display);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.message-avatar svg {
  width: var(--msg-avatar-icon-size);
  height: var(--msg-avatar-icon-size);
}

.msg-wrap {
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

.user-msg-wrap { align-items: flex-end; max-width: var(--msg-user-max-width); }
.user-msg-wrap .message-body { width: auto; }
.assistant-msg-wrap { align-items: flex-start; flex: 1; }
.context-msg-wrap { align-items: center; }

.user-msg-wrap:hover .msg-actions-below,
.assistant-msg-wrap:hover .msg-actions-below {
  visibility: visible;
  opacity: 1;
}

.message-body {
  padding: var(--msg-padding-y) var(--msg-padding-x);
  font-size: var(--msg-font-size);
  line-height: var(--msg-line-height);
  max-width: var(--msg-body-max-width);
}

.message-item.user .message-body {
  background: var(--gradient-btn);
  color: #fff;
  border-radius: var(--msg-radius-user);
}

.message-item.assistant .message-body {
  background: var(--bg-card);
  border-radius: var(--msg-radius-assistant);
}

.message-item.user .message-text { color: #fff; }
.message-item.assistant .message-text { color: var(--text); overflow-wrap: break-word; }

/* 纯操作气泡 */
.context-body {
  background: transparent !important;
  padding: 4px 12px;
  max-width: none;
}
.context-text {
  font-size: 12px;
  color: var(--text-light);
}

/* 附件区 */
.attachment-area {
  margin-bottom: 6px;
}
.attach-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 12px;
  white-space: nowrap;
}
.file-chip {
  background: rgba(37, 99, 235, 0.12);
  color: #2563EB;
}
.file-chip.file-error {
  background: rgba(239, 68, 68, 0.12);
  color: #EF4444;
}
.skill-chip {
  background: rgba(139, 92, 246, 0.12);
  color: #8B5CF6;
}
.attach-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.attach-status {
  font-size: 10px;
}
.attach-status.ok { color: var(--success); }
.attach-status.error { color: var(--danger); }

.msg-actions-below {
  visibility: hidden;
  opacity: 0;
  display: flex;
  gap: var(--msg-actions-gap);
  margin-top: var(--msg-actions-mt);
  transition: opacity 0.2s ease, visibility 0.2s ease;
}
.user-msg-wrap .msg-actions-below { justify-content: flex-end; }

.typing-indicator {
  display: flex;
  gap: var(--msg-typing-dot-gap);
  padding: 4px 0;
}

.typing-indicator span {
  width: var(--msg-typing-dot-size);
  height: var(--msg-typing-dot-size);
  border-radius: 50%;
  background: var(--text-light);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>