<template>
  <div class="search-layout-wrapper">
    <div class="search-main" :class="{ 'align-center': !currentQuery && answerState === 'idle' }">
      <div class="search-messages" ref="searchMessagesRef">
        <div v-if="currentQuery" class="message-wrapper">
          <MessageItem
            role="user"
            :content="currentQuery"
            @copyContent="$emit('copyMessage', $event)"
            @edit="$emit('editMessage', $event)"
          />
        </div>

        <div class="message-wrapper">
          <MessageItem
            role="assistant"
            :content="answerText"
            :loading="answerState === 'loading' || answerState === 'streaming'"
            @copyContent="$emit('copyMessage', $event)"
          >
            <template v-if="answerState === 'done'" #assistant-actions>
              <MsgActionBtn icon="useful" :active="feedback === 'useful'" title="有用" @click="doFeedback('useful')" />
              <MsgActionBtn icon="useless" :active="feedback === 'useless'" title="无用" @click="doFeedback('useless')" />
            </template>
          </MessageItem>
        </div>

        <div v-if="answerState === 'error'" class="answer-error">
          答案生成失败，<a href="#" @click.prevent="$emit('retry')">点击重试</a>
        </div>
      </div>
    </div>

    <aside class="results-sidebar" :class="{ open: showResults }">
      <div class="results-sidebar-header">
        <div class="results-sidebar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>搜索结果</span>
        </div>
        <button class="close-results-btn" @click="$emit('toggleResults')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="results-sidebar-content">
        <div class="result-item" v-for="r in results" :key="r.docId">
          <a :href="r.url" target="_blank" class="result-title">{{ r.title }}</a>
          <div class="result-domain">
            <span class="result-domain-text">{{ r.domain }}</span>
            <span class="result-engine-tag">{{ r.engine }}</span>
          </div>
          <p class="result-snippet">{{ r.snippet }}</p>
        </div>

        <div class="result-empty" v-if="!results.length && answerState !== 'loading'">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="result-empty-icon">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <p>未找到相关内容</p>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import MessageItem from './MessageItem.vue';
import MsgActionBtn from './MsgActionBtn.vue';

const props = defineProps<{
  searchResults: any;
  results: any[];
  answerState: string;
  answerText: string;
  currentQuery: string;
  showResults: boolean;
}>();

const emit = defineEmits<{
  copyMessage: [text: string];
  editMessage: [text: string];
  submitFeedback: [rating: string];
  toggleResults: [];
  retry: [];
}>();

const searchMessagesRef = ref<HTMLDivElement>();
const feedback = ref('');

function doFeedback(rating: string) {
  feedback.value = rating;
  emit('submitFeedback', rating);
}

function scrollToBottom() {
  nextTick(() => {
    if (searchMessagesRef.value) {
      searchMessagesRef.value.scrollTop = searchMessagesRef.value.scrollHeight;
    }
  });
}

watch(() => props.answerText, (v) => {
  if (v) scrollToBottom();
});
</script>

<style scoped>
.search-layout-wrapper {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.search-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow-y: auto;
  min-height: 0;
}

.search-main.align-center {
  justify-content: center;
}

.search-main::-webkit-scrollbar { display: none; width: 0; height: 0; }

.search-messages {
  display: flex;
  flex-direction: column;
  gap: var(--msg-container-gap);
  padding: var(--msg-container-padding);
  width: 100%;
  overflow-y: auto;
  flex: 1;
  align-items: center;
}

.message-wrapper {
  width: 100%;
  max-width: var(--msg-wrapper-max-width);
}

.answer-error {
  padding: 16px 0;
  color: var(--danger);
  font-size: 14px;
}

.results-sidebar {
  width: 0;
  overflow: hidden;
  background: var(--bg-card);
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.results-sidebar.open {
  width: 320px;
}

.results-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  height: 52px;
}

.results-sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.close-results-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.close-results-btn:hover {
  background: var(--bg-input);
  color: var(--danger);
}

.results-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.result-item {
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.result-item:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
  line-height: 1.4;
}

.result-domain {
  font-size: 11px;
  color: var(--text-light);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-domain-text {
  color: var(--text-light);
}

.result-engine-tag {
  font-size: 10px;
  color: #fff;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  background: var(--gradient-primary);
}

.result-snippet {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--text-light);
  font-size: 13px;
  text-align: center;
}

.result-empty-icon {
  color: var(--text-light);
  margin-bottom: 8px;
}

@media (max-width: 768px) {
  .results-sidebar.open {
    width: 280px;
  }
}

@media (max-width: 480px) {
  .results-sidebar.open {
    width: 100%;
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    z-index: 100;
  }
}
</style>