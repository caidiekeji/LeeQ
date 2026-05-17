<template>
  <div class="chat-content">
    <div class="anchor-bar" v-if="anchorMessages.length > 1"
      @mouseenter="anchorExpanded = true"
      @mouseleave="anchorExpanded = false"
    >
      <div
        v-for="userMsg in (anchorExpanded ? anchorMessages : visibleAnchors)"
        :key="userMsg.globalIdx"
        class="anchor-item"
        :class="{ expanded: anchorExpanded }"
        @click="scrollToAnchor(userMsg.globalIdx)"
        :title="userMsg.content"
      >
        <span class="anchor-text" v-show="anchorExpanded">{{ userMsg.content }}</span>
        <svg class="anchor-dot" width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
          <rect width="16" height="4" rx="2"/>
        </svg>
      </div>
      <div class="anchor-item anchor-more-item" v-if="anchorMessages.length > 5 && !anchorExpanded" @mouseenter="anchorExpanded = true">
        <svg class="anchor-dot" width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
          <rect width="16" height="4" rx="2"/>
        </svg>
      </div>
    </div>
    <div class="chat-messages" ref="chatMessagesRef" @scroll="onScroll">
      <template v-for="(msg, idx) in messages" :key="idx">
        <div class="message-wrapper">
          <MessageItem
            :role="msg.role"
            :content="msg.content"
            :message-id="`msg-${idx}`"
            :loading="chatLoading && idx === messages.length - 1 && msg.role === 'assistant'"
            :attachments="msg.attachments || []"
            :skill-tag="msg.skillTag || ''"
            :message-type="msg.messageType || 'text'"
            :removed-file-names="msg.removedFileNames || []"
            @copyContent="$emit('copyMessage', $event)"
            @edit="$emit('editMessage', $event)"
          >
            <template v-if="msg.role === 'assistant' && idx === messages.length - 1 && !chatLoading" #assistant-actions>
              <MsgActionBtn icon="useful" :active="feedback === 'useful'" title="有用" @click="$emit('submitFeedback', 'useful')" />
              <MsgActionBtn icon="useless" :active="feedback === 'useless'" title="无用" @click="$emit('submitFeedback', 'useless')" />
            </template>
          </MessageItem>
        </div>
      </template>
      <div v-if="chatLoading && !hasAssistantMessage" class="message-wrapper">
        <MessageItem role="assistant" content="" :loading="true" />
      </div>
    </div>
    <button class="scroll-bottom-btn" v-show="!isAtBottom" @click="scrollToBottom" title="回到底部">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import MessageItem from './MessageItem.vue';
import MsgActionBtn from './MsgActionBtn.vue';

interface ChatMessage {
  role: string;
  content: string;
  attachments?: Array<{ name: string; type: string; status: string }>;
  skillTag?: string;
  messageType?: string;
  removedFileNames?: string[];
}

const props = defineProps<{
  messages: ChatMessage[];
  chatLoading: boolean;
  feedback?: string;
}>();

const emit = defineEmits<{
  copyMessage: [text: string];
  editMessage: [text: string];
  scrollToMessage: [idx: number];
  submitFeedback: [rating: string];
}>();

const chatMessagesRef = ref<HTMLDivElement>();
const anchorExpanded = ref(false);
const isAtBottom = ref(true);

const hasAssistantMessage = computed(() => props.messages.some(m => m.role === 'assistant'));

const anchorMessages = computed(() =>
  props.messages
    .map((m, i) => ({ ...m, globalIdx: i }))
    .filter(m => m.role === 'user' && m.messageType !== 'context')
);

const visibleAnchors = computed(() => anchorMessages.value.slice(0, 5));

function onScroll() {
  const el = chatMessagesRef.value;
  if (!el) return;
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
}

function scrollToBottom() {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
      isAtBottom.value = true;
    }
  });
}

function scrollToAnchor(idx: number) {
  nextTick(() => {
    const el = document.getElementById(`msg-${idx}`);
    if (el && chatMessagesRef.value) {
      const container = chatMessagesRef.value;
      const elTop = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: elTop, behavior: 'smooth' });
    }
    emit('scrollToMessage', idx);
  });
}

watch(() => props.messages.length, scrollToBottom);

watch(() => {
  const last = props.messages[props.messages.length - 1];
  return last?.content;
}, scrollToBottom);

watch(() => props.chatLoading, (v) => {
  if (v) scrollToBottom();
});

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: var(--msg-container-gap);
  padding: var(--msg-container-padding);
  overflow-y: auto;
  flex: 1;
  position: relative;
  align-items: center;
}

.message-wrapper {
  width: 100%;
  max-width: var(--msg-wrapper-max-width);
  display: flex;
}

.anchor-bar {
  position: fixed;
  right: var(--anchor-bar-right);
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--anchor-bar-z);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 10px 6px;
  max-height: 380px;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.chat-content:hover .anchor-bar {
  opacity: 1;
  pointer-events: auto;
}

.anchor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  color: var(--text-light);
  transition: all 0.15s;
  border-radius: 4px;
  padding: 3px 6px;
}

.anchor-item:hover {
  color: var(--primary);
}

.anchor-item:hover .anchor-dot {
  color: var(--primary);
}

.anchor-dot {
  flex-shrink: 0;
  transition: color 0.15s;
}

.anchor-text {
  font-size: 12px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary, #6b7280);
  transition: color 0.15s;
  text-align: left;
}

.anchor-item:hover .anchor-text {
  color: var(--primary);
}

.anchor-more-item {
  justify-content: center;
  padding: 5px 6px;
  opacity: 0.6;
}

.scroll-bottom-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border, #e5e7eb);
  background: var(--card-bg, #fff);
  color: var(--text-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: all 0.2s;
  z-index: 10;
}
.scroll-bottom-btn:hover {
  background: var(--primary, #3b82f6);
  color: #fff;
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}
</style>