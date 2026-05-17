<template>
  <div class="search-page">
    <header class="search-header">
      <div class="container header-inner">
        <router-link to="/" class="mini-logo">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#miniLogoGrad)"/>
            <path d="M14 28c2-4 4-8 10-8s8 4 10 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="18" r="3" fill="#fff"/>
            <defs><linearGradient id="miniLogoGrad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#4F6EF7"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
          </svg>
          <span>LeeQ</span>
        </router-link>
        <div class="header-input-row">
          <div class="header-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon-sm"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input v-model="query" @keydown.enter="doSearch" placeholder="继续搜索..." />
            <button class="header-send-btn" @click="doSearch">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="container search-content">
      <div class="search-info" v-if="searchData">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        约 {{ formatNum(searchData.totalResults) }} 条结果 · 耗时 {{ searchData.elapsedMs }}ms
      </div>

      <div class="search-layout">
        <div class="main-col">
          <!-- AI答案 -->
          <div class="answer-block">
            <div class="answer-header-bar">
              <div class="ai-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                AI 答案
              </div>
              <span v-if="answerState === 'streaming'" class="streaming-dot"></span>
            </div>

            <div class="answer-body">
              <div v-if="answerState === 'loading'" class="skeleton-answer">
                <div class="skeleton" style="height:14px;width:85%;margin-bottom:10px"></div>
                <div class="skeleton" style="height:14px;width:92%;margin-bottom:10px"></div>
                <div class="skeleton" style="height:14px;width:65%;margin-bottom:10px"></div>
                <div class="skeleton" style="height:14px;width:78%;margin-bottom:10px"></div>
                <div class="skeleton" style="height:14px;width:55%"></div>
              </div>
              <div v-else-if="answerState === 'streaming' || answerState === 'done'" ref="answerEl" class="answer-text markdown-body" v-html="renderedAnswer"></div>
              <div v-else-if="answerState === 'error'" class="answer-error">
                <p>答案生成失败，<a href="#" @click.prevent="doSearch">点击重试</a></p>
              </div>
            </div>

            <div class="answer-citations" v-if="citations.length">
              <div class="citation-header">参考来源</div>
              <div class="citation-list">
                <a v-for="c in citations" :key="c.index" :href="c.url" target="_blank" class="citation-link">
                  <span class="citation-idx">[{{ c.index }}]</span>
                  <span>{{ c.title }}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            </div>

            <div class="answer-actions" v-if="answerState === 'done'">
              <MsgActionBtn icon="copy" :copied="copied" title="复制答案" @click="copyAnswer" />
              <MsgActionBtn icon="useful" :active="feedback === 'useful'" title="有用" @click="submitFeedback('useful')" />
              <MsgActionBtn icon="useless" :active="feedback === 'useless'" title="无用" @click="submitFeedback('useless')" />
            </div>
          </div>

          <!-- 搜索结果列表 -->
          <div class="results-list" v-if="results.length">
            <div class="result-item" v-for="r in results" :key="r.docId">
              <div class="result-header">
                <div class="result-favicon">{{ r.domain?.charAt(0).toUpperCase() }}</div>
                <div class="result-domain-info">
                  <span class="result-domain">{{ r.domain }}</span>
                  <span class="result-engine-tag">{{ r.engine }}</span>
                  <span class="result-score">相关性 {{ Math.round(r.score * 100) }}%</span>
                </div>
              </div>
              <a :href="r.url" target="_blank" class="result-title">{{ r.title }}</a>
              <p class="result-snippet">{{ r.snippet }}</p>
              <router-link :to="`/content/${r.docId}`" class="result-view-link">
                查看全文
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </router-link>
            </div>

            <div class="pagination" v-if="searchData && searchData.totalResults > 20">
              <button :disabled="page <= 1" @click="changePage(page - 1)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                上一页
              </button>
              <button v-for="p in totalPages" :key="p" :class="{ active: p === page }" @click="changePage(p)">{{ p }}</button>
              <button :disabled="page >= totalPages" @click="changePage(page + 1)">
                下一页
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div class="empty-state" v-if="!results.length && answerState !== 'loading' && searchData">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-light);margin-bottom:16px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <h3>未找到相关内容</h3>
            <p>请尝试其他关键词或调整搜索模式</p>
          </div>
        </div>

        <!-- 右侧面板 -->
        <aside class="side-col">
          <div class="side-card">
            <div class="side-card-title">搜索历史</div>
            <div class="history-list" v-if="searchHistory.length">
              <a v-for="(h, i) in searchHistory" :key="i" @click="searchFromHistory(h)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ h }}
              </a>
            </div>
            <div v-else class="history-empty">暂无搜索记录</div>
            <button v-if="searchHistory.length" class="clear-history-btn" @click="clearHistory">清空历史记录</button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, createStream } from '../../utils/api';
import { renderMarkdown, runMermaid, copyToClipboard } from '../../utils/markdown';
import MsgActionBtn from './components/MsgActionBtn.vue';

const route = useRoute();
const router = useRouter();
const query = ref('');
const page = ref(1);
const searchData = ref<any>(null);
const results = ref<any[]>([]);
const answerState = ref<'idle'|'loading'|'streaming'|'done'|'error'>('idle');
const answerText = ref('');
const citations = ref<any[]>([]);
const searchId = ref('');
let eventSource: EventSource | null = null;

const searchHistory = ref<string[]>(JSON.parse(localStorage.getItem('searchHistory') || '[]'));
const answerEl = ref<HTMLElement>();
const feedback = ref('');
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const totalPages = computed(() => searchData.value ? Math.min(5, Math.ceil(searchData.value.totalResults / 20)) : 0);
const renderedAnswer = computed(() => renderMarkdown(answerText.value));

function formatNum(n: number) { return n ? n.toLocaleString() : '0'; }

watch(answerState, (v) => {
  if (v === 'done' && answerEl.value) {
    nextTick(() => runMermaid(answerEl.value!));
  }
});

function doSearch() {
  if (!query.value.trim()) return;
  router.push({ name: 'search', query: { ...route.query, q: query.value } });
}

function changePage(p: number) {
  page.value = p;
  router.push({ name: 'search', query: { ...route.query, q: query.value, page: p } });
  performSearch(query.value, p);
}

function searchFromHistory(word: string) {
  query.value = word;
  doSearch();
}

async function performSearch(q: string, p: number = 1) {
  answerState.value = 'loading';
  results.value = [];
  citations.value = [];
  answerText.value = '';

  const mode = (route.query.mode as string) || 'search';
  const url = (route.query.url as string) || '';

  const res = await api.search({ query: q, mode, url, page: p });
  if (res.code === 0) {
    searchData.value = res.data;
    results.value = res.data.results;
    searchId.value = res.data.searchId;

    if (!searchHistory.value.includes(q)) {
      searchHistory.value.unshift(q);
      if (searchHistory.value.length > 20) searchHistory.value.pop();
      localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
    }

    connectStream(res.data.aiAnswer.streamUrl);
  } else {
    answerState.value = 'error';
  }
}

function connectStream(streamUrl: string) {
  answerState.value = 'streaming';
  eventSource = createStream(streamUrl);

  eventSource.addEventListener('start', () => {});

  eventSource.addEventListener('chunk', (e: MessageEvent) => {
    const { text } = JSON.parse(e.data);
    answerText.value += text;
    autoScroll();
  });

  eventSource.addEventListener('citation', (e: MessageEvent) => {
    const { sources } = JSON.parse(e.data);
    citations.value = sources;
  });

  eventSource.addEventListener('done', () => {
    answerState.value = 'done';
    eventSource?.close();
  });

  eventSource.addEventListener('error', () => {
    if (answerText.value) {
      answerState.value = 'done';
    } else {
      answerState.value = 'error';
    }
    eventSource?.close();
  });
}

function copyAnswer() {
  copyToClipboard(answerText.value);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => { copied.value = false; }, 1500);
}

async function submitFeedback(rating: string) {
  feedback.value = rating;
  await api.submitFeedback({ searchId: searchId.value, rating });
}

function clearHistory() {
  searchHistory.value = [];
  localStorage.removeItem('searchHistory');
}

function autoScroll() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

watch(() => route.query.q, (val) => {
  if (val) {
    query.value = val as string;
    const p = Number(route.query.page) || 1;
    page.value = p;
    performSearch(val as string, p);
  }
}, { immediate: true });

onUnmounted(() => {
  eventSource?.close();
});
</script>

<style scoped>
.search-page {
  min-height: 100vh;
  background: var(--bg);
}

/* 隐藏滚动条但保留滚动功能 */
.search-page::-webkit-scrollbar { display: none; width: 0; height: 0; }
.search-page *::-webkit-scrollbar { display: none; width: 0; height: 0; }

.search-header {
  background: var(--bg-card);
  padding: 12px 0; position: sticky; top: 0; z-index: 50;
  box-shadow: var(--shadow);
}
.header-inner { display: flex; align-items: center; gap: 20px; }
.mini-logo {
  display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700;
  color: var(--text); text-decoration: none; flex-shrink: 0;
}
.header-input-row { flex: 1; max-width: 640px; }
.header-search-wrap {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg);
  border-radius: var(--radius); padding: 4px 8px 4px 14px;
  transition: box-shadow .2s;
}
.header-search-wrap:focus-within {
  box-shadow: 0 0 0 2px rgba(79,110,247,.15);
}
.search-icon-sm { color: var(--text-light); flex-shrink: 0; }
.header-search-wrap input {
  flex: 1; background: transparent; border: none; padding: 8px 0;
  font-size: 14px; color: var(--text); outline: none; box-shadow: none;
}
.header-search-wrap input::placeholder { color: var(--text-light); }
.header-send-btn {
  width: 34px; height: 34px; border-radius: 8px; border: none;
  background: var(--gradient-btn);
  color: #fff; cursor: pointer; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0; transition: all .2s;
}
.header-send-btn:hover { box-shadow: 0 2px 12px rgba(79,110,247,.4); }

.search-content { padding-top: 24px; padding-bottom: 80px; }
.search-info {
  display: flex; align-items: center; gap: 6px;
  color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;
}

.search-layout { display: flex; gap: 28px; }
.main-col { flex: 1; min-width: 0; }
.side-col { width: 240px; flex-shrink: 0; }

/* AI答案区域 */
.answer-block {
  background: var(--bg-card);
  border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px;
  animation: fadeUp .4s ease;
}
.answer-header-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.ai-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(79,110,247,.2), rgba(139,92,246,.2));
  color: var(--primary-light); padding: 4px 14px; border-radius: 20px;
  font-size: 13px; font-weight: 600;
}
.streaming-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--success); animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

.skeleton-answer { padding: 8px 0; }
.answer-text { font-size: 15px; line-height: 1.85; }
.answer-error { padding: 16px 0; color: var(--danger); font-size: 14px; }

.answer-citations {
  padding-top: 18px; margin-top: 20px;
}
.citation-header { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; }
.citation-list { display: flex; flex-direction: column; gap: 8px; }
.citation-link {
  display: flex; align-items: center; gap: 8px; font-size: 13px;
  color: var(--text-secondary); padding: 8px 12px;
  border-radius: var(--radius-sm); transition: all .2s;
}
.citation-link:hover { background: var(--bg-input); color: var(--text); text-decoration: none; }
.citation-link svg { opacity: .5; margin-left: auto; flex-shrink: 0; }
.citation-idx { color: var(--primary-light); font-weight: 600; }

.answer-actions {
  display: flex; gap: 8px;
  padding-top: 18px; margin-top: 20px;
}

/* 搜索结果列表 */
.result-item {
  background: var(--bg-card);
  border-radius: var(--radius); padding: 18px; margin-bottom: 12px;
}
.result-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.result-favicon {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--gradient-primary);
  color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.result-domain-info { display: flex; align-items: center; gap: 10px; }
.result-domain { font-size: 12px; color: var(--text-secondary); }
.result-engine-tag {
  font-size: 11px; color: #fff; padding: 2px 8px; border-radius: 10px;
  font-weight: 600; background: var(--gradient-primary);
}
.result-score { font-size: 11px; color: var(--primary-light); background: rgba(79,110,247,.1); padding: 2px 8px; border-radius: 10px; }
.result-title { font-size: 16px; font-weight: 600; color: var(--text); display: block; margin-bottom: 6px; transition: color .2s; }
.result-title:hover { color: var(--primary-light); }
.result-snippet { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
.result-view-link {
  font-size: 13px; color: var(--primary-light); display: inline-flex; align-items: center; gap: 4px;
}

/* 侧边栏 */
.side-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg); padding: 18px;
  position: sticky; top: 80px;
}
.side-card-title { font-size: 14px; font-weight: 600; margin-bottom: 14px; }
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-list a {
  display: flex; align-items: center; gap: 8px; font-size: 13px;
  color: var(--text-secondary); cursor: pointer; padding: 8px 10px;
  border-radius: var(--radius-sm); transition: all .15s; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.history-list a:hover { background: var(--bg-input); color: var(--text); }
.history-empty { color: var(--text-light); font-size: 13px; padding: 12px 0; }
.clear-history-btn {
  width: 100%; margin-top: 14px; padding: 8px;
  border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary);
  font-size: 13px; cursor: pointer; transition: all .2s; border: none;
}
.clear-history-btn:hover { color: var(--danger); }

@media (max-width: 768px) {
  .search-layout { flex-direction: column; gap: 16px; }
  .side-col { width: 100%; }
  .mini-logo { font-size: 14px; }
  .mini-logo svg { width: 20px; height: 20px; }
  .header-input-row { max-width: none; }
  .search-content { padding-top: 16px; }
  .answer-block { padding: 16px; margin-bottom: 16px; border-radius: var(--radius); }
  .answer-header-bar { margin-bottom: 14px; gap: 8px; }
  .ai-badge { font-size: 12px; padding: 3px 10px; }
  .result-item { padding: 14px; margin-bottom: 8px; }
  .result-title { font-size: 15px; }
  .result-snippet { font-size: 13px; }
  .side-card { position: static; padding: 14px; }
  .pagination button { padding: 6px 10px; font-size: 13px; }
}

@media (max-width: 480px) {
  .header-inner { gap: 8px; flex-wrap: nowrap; }
  .mini-logo span { display: none; }
  .header-search-wrap { gap: 6px; padding: 3px 6px 3px 10px; }
  .header-send-btn { width: 30px; height: 30px; }
  .header-search-wrap input { font-size: 13px; padding: 6px 0; }
  .search-info { font-size: 12px; }
  .answer-block { padding: 12px; margin-bottom: 12px; }
  .answer-text { font-size: 14px; line-height: 1.7; }
  .result-item { padding: 12px; }
  .result-title { font-size: 14px; }
  .result-snippet { font-size: 13px; line-height: 1.5; }
  .side-card { padding: 12px; }
  .side-card-title { font-size: 13px; }
  .history-list a { padding: 7px 8px; font-size: 12px; }
  .clear-history-btn { padding: 6px; font-size: 12px; }
}
</style>
