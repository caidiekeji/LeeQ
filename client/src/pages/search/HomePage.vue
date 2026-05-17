<template>
  <div class="home-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <HomeSidebar
      :sidebarCollapsed="sidebarCollapsed"
      :historyList="historyList"
      :mode="mode"
      :isLoggedIn="isLoggedIn"
      :userInfo="userInfo"
      @toggleCollapse="sidebarCollapsed = !sidebarCollapsed"
      @resetHome="resetHome"
      @startNewChat="startNewChat"
      @clearHistory="clearHistory"
      @clickHistory="clickHistory"
      @removeHistory="removeHistory"
      @openCreateSkill="showSkillModal = true"
      @openLogin="showLoginModal = true"
      @openUserCenter="showUserCenter = true"
      @logout="doLogout"
    />

    <main class="main-content" :class="{ 'main-center': !searchResults && answerState === 'idle' && chatMessages.length === 0 && searchTurns.length === 0 }">
      <div class="content-scroll" :class="{
        'has-content': searchResults || answerState !== 'idle' || chatMessages.length > 0 || searchTurns.length > 0,
        'center-content': !searchResults && answerState === 'idle' && chatMessages.length === 0 && searchTurns.length === 0,
        'search-flow-layout': !isChatMode && searchTurns.length > 0
      }">
        <button
          v-if="!isChatMode && (searchResults || answerState !== 'idle' || searchTurns.length > 0)"
          class="results-float-toggle"
          :class="{ open: showResults }"
          @click="showResults = !showResults"
          :title="showResults ? '隐藏结果' : '显示结果'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toggle-icon-svg">
            <polyline v-if="showResults" points="9 18 15 12 9 6"/>
            <polyline v-else points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <ChatPanel
          v-if="isChatMode && chatMessages.length > 0"
          :messages="chatMessages"
          :chatLoading="chatLoading"
          :feedback="chatFeedback"
          @copyMessage="copyMessage"
          @editMessage="editMessage"
          @scrollToMessage="scrollToMessage"
          @submitFeedback="submitFeedback"
        />

        <!-- 搜索模式：连续消息流展示 -->
        <template v-if="!isChatMode && searchTurns.length > 0">
          <div class="search-turns-flow" ref="searchTurnsRef" @scroll="onSearchScroll">
            <template v-for="(turn, idx) in searchTurns" :key="idx">
              <!-- 用户查询气泡 -->
              <div class="message-wrapper">
                <MessageItem
                  role="user"
                  :content="turn.query"
                  @copyContent="copyMessage"
                  @edit="editMessage"
                />
              </div>
              <!-- AI回答气泡 -->
              <div class="message-wrapper">
                <MessageItem
                  role="assistant"
                  :content="turn.answer"
                  :loading="idx === searchTurns.length - 1 && (answerState === 'loading' || answerState === 'streaming')"
                  @copyContent="copyMessage"
                >
                  <template v-if="idx === searchTurns.length - 1 && answerState === 'done'" #assistant-actions>
                    <MsgActionBtn icon="useful" :active="feedback === 'useful'" title="有用" @click="submitFeedback('useful')" />
                    <MsgActionBtn icon="useless" :active="feedback === 'useless'" title="无用" @click="submitFeedback('useless')" />
                  </template>
                </MessageItem>
              </div>
            </template>
          </div>

          <button class="search-scroll-bottom-btn" v-show="!isSearchAtBottom" @click="scrollSearchToBottom" title="回到底部">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <!-- 搜索结果侧栏（仅一个，显示最新 turn 的结果） -->
          <aside class="results-sidebar" :class="{ open: showResults }">
            <div class="results-sidebar-header">
              <div class="results-sidebar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>搜索结果</span>
              </div>
              <button class="close-results-btn" @click="showResults = !showResults">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="results-sidebar-content">
              <div v-if="latestSearchTurn" class="result-item" v-for="(r, ri) in latestSearchTurn.results" :key="ri">
                <a :href="r.url" target="_blank" class="result-title">{{ r.title }}</a>
                <div class="result-domain">
                  <span class="result-domain-text">{{ r.domain }}</span>
                  <span class="result-engine-tag">{{ r.engine }}</span>
                </div>
                <p class="result-snippet">{{ r.snippet }}</p>
              </div>
              <div class="result-empty" v-if="!latestSearchTurn?.results.length && answerState !== 'loading'">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <p>未找到相关内容</p>
              </div>
            </div>
          </aside>
        </template>
      </div>

      <SearchFooter
        ref="searchFooterRef"
        v-model="query"
        v-model:targetUrl="targetUrl"
        :mode="mode"
        :loading="loading"
        :chatLoading="chatLoading"
        :isStreaming="answerState === 'streaming' || chatLoading"
        @search="doSearch"
        @switchMode="switchMode"
        @stop="stopGenerating"
        @file-change="handleFileChange"
        @skill-change="handleSkillChange"
      />

      <CreateSkillModal v-if="showSkillModal" @close="showSkillModal = false" />
      <LoginRegisterModal v-if="showLoginModal" @close="showLoginModal = false" />
      <UserCenterPanel v-if="showUserCenter" @close="showUserCenter = false" @logout="doLogout" @profileUpdated="onProfileUpdated" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { api, createStream } from '../../utils/api';
import { copyToClipboard } from '../../utils/markdown';
import HomeSidebar from './components/HomeSidebar.vue';
import ChatPanel from './components/ChatPanel.vue';
import SearchResultPanel from './components/SearchResultPanel.vue';
import SearchFooter from './components/SearchFooter.vue';
import CreateSkillModal from './components/CreateSkillModal.vue';
import LoginRegisterModal from './components/LoginRegisterModal.vue';
import UserCenterPanel from './components/UserCenterPanel.vue';
import MessageItem from './components/MessageItem.vue';
import MsgActionBtn from './components/MsgActionBtn.vue';

const query = ref('');
const targetUrl = ref('');
const mode = ref<'search'|'summarize'|'chat'>('search');
const loading = ref(false);
const sidebarCollapsed = ref(false);
const showResults = ref(false);
const showSkillModal = ref(false);
const showLoginModal = ref(false);
const showUserCenter = ref(false);
const isLoggedIn = ref(!!localStorage.getItem('userToken'));
const userInfo = ref<any>(JSON.parse(localStorage.getItem('userInfo') || '{}'));
const searchFooterRef = ref<InstanceType<typeof SearchFooter>>();
const attachedFile = ref<File | null>(null);
const selectedSkill = ref<{ source: string; id: string; name: string } | null>(null);
const seoSettings = ref<any>({
  siteTitle: 'LeeQ AI Search',
  siteDescription: '基于AI的智能搜索服务',
  keywords: 'AI搜索,智能问答,RAG',
  homeTitle: '首页 - LeeQ AI Search',
  homeDescription: 'LeeQ AI Search - 基于AI的智能搜索服务',
  copyright: '© 2026 LeeQ AI Search. All rights reserved.'
});

interface HistoryItem {
  text: string;
  type: 'search' | 'chat';
  timestamp: number;
  messages?: Array<{ role: string; content: string }>;
  chatId?: string;
}

const rawHistory = ref<HistoryItem[]>(JSON.parse(localStorage.getItem('userHistory') || '[]'));
const historyList = computed(() => rawHistory.value.slice(0, 20));

const searchResults = ref<any>(null);
const results = ref<any[]>([]);
const answerState = ref<'idle'|'loading'|'streaming'|'done'|'error'>('idle');
const answerText = ref('');
const citations = ref<any[]>([]);
const searchId = ref('');
const currentQuery = ref('');
let eventSource: EventSource | null = null;

// 搜索轮次数组 - 每次搜索形成一条完整的问+答+结果记录，类似聊天消息流
interface SearchTurn {
  query: string;
  results: any[];
  answer: string;
  citations: any[];
  state: 'loading' | 'streaming' | 'done' | 'error';
  showResults: boolean;
}
const searchTurns = ref<SearchTurn[]>([]);
const searchTurnsRef = ref<HTMLDivElement>();
const isSearchAtBottom = ref(true);
const latestSearchTurn = computed(() => searchTurns.value.length > 0 ? searchTurns.value[searchTurns.value.length - 1] : null);

const chatMessages = ref<Array<{role: string, content: string, attachments?: any[], skillTag?: string, messageType?: string, removedFileNames?: string[]}>>([]);
const chatLoading = ref(false);
const currentChatId = ref('');
const chatFeedback = ref('');
const feedback = ref('');
let chatEventSource: EventSource | null = null;

const isChatMode = computed(() => mode.value === 'chat');

// 搜索流自动滚动逻辑
function onSearchScroll() {
  const el = searchTurnsRef.value;
  if (!el) return;
  isSearchAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
}

function scrollSearchToBottom() {
  nextTick(() => {
    if (searchTurnsRef.value) {
      searchTurnsRef.value.scrollTop = searchTurnsRef.value.scrollHeight;
      isSearchAtBottom.value = true;
    }
  });
}

// 新搜索轮次 → 自动滚到底部
watch(() => searchTurns.value.length, () => {
  nextTick(() => scrollSearchToBottom());
});

// 流式输出时跟随滚动
watch(() => {
  const last = searchTurns.value[searchTurns.value.length - 1];
  return last?.answer;
}, () => {
  if (isSearchAtBottom.value) scrollSearchToBottom();
});

// 开始加载时滚到底部
watch(answerState, (v) => {
  if (v === 'loading') scrollSearchToBottom();
});

function savePersistedState() {
  if (mode.value === 'chat' && chatMessages.value.length > 0) {
    localStorage.setItem('persistedMode', 'chat');
    localStorage.setItem('persistedChatMessages', JSON.stringify(chatMessages.value));
    localStorage.setItem('persistedChatId', currentChatId.value);
    localStorage.removeItem('persistedSearchState');
  } else if (answerState.value !== 'idle' && answerState.value !== 'loading') {
    localStorage.setItem('persistedMode', mode.value);
    localStorage.setItem('persistedSearchState', JSON.stringify({
      searchTurns: searchTurns.value,
      searchResults: searchResults.value,
      results: results.value,
      answerState: answerState.value,
      answerText: answerText.value,
      citations: citations.value,
      currentQuery: currentQuery.value,
      showResults: showResults.value
    }));
    localStorage.removeItem('persistedChatMessages');
    localStorage.removeItem('persistedChatId');
  }
}

function clearPersistedState() {
  localStorage.removeItem('persistedMode');
  localStorage.removeItem('persistedChatMessages');
  localStorage.removeItem('persistedChatId');
  localStorage.removeItem('persistedSearchState');
}

watch(answerState, (v) => { if (v === 'done' || v === 'error') savePersistedState(); });
watch(chatLoading, (v) => { if (!v && chatMessages.value.length > 0) savePersistedState(); });
watch(mode, (newMode) => {
  if (newMode === 'chat' && chatMessages.value.length > 0) savePersistedState();
  else if (newMode !== 'chat' && answerState.value !== 'idle' && answerState.value !== 'loading') savePersistedState();
});

function handleFileChange(file: File | null) {
  attachedFile.value = file;
}

function handleSkillChange(skill: { source: string; id: string; name: string } | null) {
  selectedSkill.value = skill;
}

function handleFooterState(e: Event) {
  const detail = (e as CustomEvent).detail;
  attachedFile.value = detail.attachment;
  selectedSkill.value = detail.skill;
}

function handleUserLogin() {
  isLoggedIn.value = true;
  userInfo.value = JSON.parse(localStorage.getItem('userInfo') || '{}');
}

onMounted(async () => {
  try {
    const seoRes = await api.getSeoSettings();
    if (seoRes.code === 0 && seoRes.data) {
      seoSettings.value = { ...seoSettings.value, ...seoRes.data };
      document.title = seoSettings.value.homeTitle || seoSettings.value.siteTitle;

      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', seoSettings.value.homeDescription || seoSettings.value.siteDescription);
      }

      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', seoSettings.value.keywords);
      }
    }
  } catch (err) {
    console.error('获取SEO配置失败:', err);
  }

  if (isLoggedIn.value) {
    try {
      const chatHistoryRes = await api.getChatHistory();
      if (chatHistoryRes.code === 0 && chatHistoryRes.data) {
        const dbHistory: HistoryItem[] = chatHistoryRes.data.map((item: any) => ({
          text: item.messages?.[0]?.content || '对话',
          type: 'chat' as const,
          timestamp: item.messages?.[0]?.createdAt ? new Date(item.messages[0].createdAt).getTime() : Date.now(),
          messages: item.messages || [],
          chatId: item.chatId
        }));
        rawHistory.value = [...dbHistory, ...rawHistory.value.filter(h => h.type === 'search')];
        localStorage.setItem('userHistory', JSON.stringify(rawHistory.value));
      }
    } catch (err) {
      console.error('加载聊天历史失败:', err);
    }
  }

  const pm = localStorage.getItem('persistedMode');
  const isReturnVisit = sessionStorage.getItem('hasVisitedHome');
  if (pm && isReturnVisit) {
    mode.value = pm as 'search' | 'summarize' | 'chat';
    if (pm === 'chat') {
      const msgs = localStorage.getItem('persistedChatMessages');
      const cid = localStorage.getItem('persistedChatId');
      if (msgs) chatMessages.value = JSON.parse(msgs);
      if (cid) currentChatId.value = cid;
    } else {
      const ss = localStorage.getItem('persistedSearchState');
      if (ss) {
        try {
          const s = JSON.parse(ss);
          searchTurns.value = s.searchTurns || [];
          searchResults.value = s.searchResults;
          results.value = s.results || [];
          answerState.value = s.answerState || 'idle';
          answerText.value = s.answerText || '';
          citations.value = s.citations || [];
          currentQuery.value = s.currentQuery || '';
          showResults.value = s.showResults || false;
        } catch {}
      }
    }
  }

  window.addEventListener('footer-state-change', handleFooterState);
  window.addEventListener('user-login', handleUserLogin);
  sessionStorage.setItem('hasVisitedHome', '1');
});

onUnmounted(() => {
  eventSource?.close();
  chatEventSource?.close();
  window.removeEventListener('footer-state-change', handleFooterState);
  window.removeEventListener('user-login', handleUserLogin);
});

async function doSearch() {
  if (mode.value === 'chat') {
    const q = query.value;
    query.value = '';
    if (!q.trim() && !attachedFile.value) return;
    await sendChat(q.trim() || '请分析上传的文件');
  } else if (attachedFile.value) { doDocumentAnalysis(); return; }
  else if (selectedSkill.value) { doSkillExecution(); return; }
  else if (mode.value === 'search' && !query.value.trim()) return;
  else if (mode.value === 'summarize' && !query.value.trim()) return;

  if (mode.value !== 'chat') {
    loading.value = true;
    currentQuery.value = query.value;
    const q = query.value;
    query.value = '';
    await performSearch(q);
  }
}

function switchMode(newMode: 'search'|'summarize'|'chat') {
  mode.value = newMode;
}

async function doDocumentAnalysis() {
  if (!attachedFile.value) return;
  loading.value = true;
  currentQuery.value = query.value || '请分析文档';
  const file = attachedFile.value;
  const userInput = query.value;
  query.value = '';
  answerState.value = 'streaming';
  results.value = [];
  answerText.value = '';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('userInput', userInput);

  try {
    const res = await api.uploadDocument(formData);
    if (res.code !== 0) {
      answerState.value = 'error';
      answerText.value = res.message || '文档上传失败';
      loading.value = false;
      cleanupFooterContext();
      return;
    }

    cleanupFooterContext();

    const { docId } = res.data;
    const streamUrl = `/api/v1/document/analyze/stream?docId=${encodeURIComponent(docId)}`;

    const docEventSource = createStream(streamUrl);

    docEventSource.addEventListener('start', () => {});

    docEventSource.addEventListener('chunk', (e: MessageEvent) => {
      const { text } = JSON.parse(e.data);
      answerText.value += text;
    });

    docEventSource.addEventListener('done', () => {
      answerState.value = 'done';
      loading.value = false;
      docEventSource.close();
    });

    docEventSource.addEventListener('error', () => {
      if (!answerText.value) {
        answerText.value = '文档分析失败，请重试';
      }
      answerState.value = 'done';
      loading.value = false;
      docEventSource.close();
    });
  } catch (err: any) {
    loading.value = false;
    answerState.value = 'error';
    answerText.value = err.message || '文档分析失败，请重试';
    cleanupFooterContext();
  }
}

async function doSkillExecution() {
  if (!selectedSkill.value || !query.value.trim()) return;
  loading.value = true;
  currentQuery.value = query.value;
  const skill = selectedSkill.value;
  const inputText = query.value;
  query.value = '';
  answerState.value = 'streaming';
  results.value = [];
  answerText.value = '';

  let fileContext = '';
  
  if (attachedFile.value) {
    const formData = new FormData();
    formData.append('file', attachedFile.value);
    formData.append('userInput', '');
    
    const uploadRes = await api.uploadDocument(formData);
    if (uploadRes.code !== 0) {
      loading.value = false;
      answerState.value = 'error';
      answerText.value = uploadRes.message || '文件上传失败';
      cleanupFooterContext();
      return;
    }
    
    fileContext = `[文件: ${attachedFile.value.name}]\n${uploadRes.data.fileText || ''}`;
  }

  cleanupFooterContext();

  let streamUrl = '';
  if (skill.source === 'system') {
    streamUrl = `/api/v1/skills/execute/stream?skillId=${skill.id}&inputText=${encodeURIComponent(inputText)}&fileContext=${encodeURIComponent(fileContext)}`;
  } else {
    const userSkillsRaw = localStorage.getItem('userSkills');
    let promptTemplate = '{inputText}';
    if (userSkillsRaw) {
      try {
        const skills = JSON.parse(userSkillsRaw);
        const found = skills.find((s: any) => s.id === skill.id);
        if (found) promptTemplate = found.promptTemplate || '{inputText}';
      } catch {}
    }
    const finalPrompt = promptTemplate.replace('{inputText}', inputText) + (fileContext ? '\n\n' + fileContext : '');
    streamUrl = `/api/v1/skills/execute/stream?source=user&prompt=${encodeURIComponent(finalPrompt)}`;
  }

  const es = createStream(streamUrl);
  let fullText = '';

  es.addEventListener('chunk', (e: MessageEvent) => {
    fullText += JSON.parse(e.data).text;
    answerText.value = fullText;
  });

  es.addEventListener('done', () => {
    answerState.value = 'done';
    loading.value = false;
    cleanupFooterContext();
    es.close();
  });

  es.addEventListener('error', (e: any) => {
    if (!fullText) { answerState.value = 'error'; answerText.value = e.message || '技能执行失败，请重试'; }
    else { answerState.value = 'done'; }
    loading.value = false;
    cleanupFooterContext();
    es.close();
  });
}

async function performSearch(q: string) {
  answerState.value = 'loading';
  results.value = [];
  citations.value = [];
  answerText.value = '';
  feedback.value = '';

  const modeType = mode.value;
  const url = targetUrl.value;

  try {
    const res = await api.search({ query: q, mode: modeType, url });
    loading.value = false;

    if (res.code === 0) {
      searchResults.value = res.data;
      results.value = res.data.results;
      searchId.value = res.data.searchId;

      if (!rawHistory.value.some(h => h.text === q && h.type === 'search')) {
        rawHistory.value.unshift({ text: q, type: 'search', timestamp: Date.now() });
        localStorage.setItem('userHistory', JSON.stringify(rawHistory.value));
      }

      // 创建新搜索轮次，追加到消息流数组
      searchTurns.value.push({
        query: q,
        results: res.data.results,
        answer: '',
        citations: [],
        state: 'loading',
        showResults: false
      });

      connectStream(res.data.aiAnswer.streamUrl, q);
    } else {
      answerState.value = 'error';
      answerText.value = res.message;
      if (res.code === 403) {
        showLoginModal.value = true;
      }
    }
  } catch (err: any) {
    loading.value = false;
    answerState.value = 'error';
    answerText.value = err.message || '搜索失败，请重试';
  }
}

function connectStream(streamUrl: string, userQuery: string) {
  answerState.value = 'streaming';
  eventSource = createStream(streamUrl);
  const lastIdx = searchTurns.value.length - 1;

  eventSource.addEventListener('start', () => {
    if (lastIdx >= 0) searchTurns.value[lastIdx].state = 'streaming';
  });

  eventSource.addEventListener('chunk', (e: MessageEvent) => {
    const { text } = JSON.parse(e.data);
    answerText.value += text;
    if (lastIdx >= 0) searchTurns.value[lastIdx].answer = answerText.value;
  });

  eventSource.addEventListener('citation', (e: MessageEvent) => {
    const { sources } = JSON.parse(e.data);
    citations.value = sources;
    if (lastIdx >= 0) searchTurns.value[lastIdx].citations = sources;
  });

  eventSource.addEventListener('done', () => {
    answerState.value = 'done';
    if (lastIdx >= 0) searchTurns.value[lastIdx].state = 'done';
    eventSource?.close();
  });

  eventSource.addEventListener('error', () => {
    if (answerText.value) {
      answerState.value = 'done';
      if (lastIdx >= 0) searchTurns.value[lastIdx].state = 'done';
    } else {
      answerState.value = 'error';
      if (lastIdx >= 0) searchTurns.value[lastIdx].state = 'error';
    }
    eventSource?.close();
  });
}

function cleanupFooterContext() {
  attachedFile.value = null;
  selectedSkill.value = null;
  searchFooterRef.value?.removeAttachment();
  searchFooterRef.value?.clearSkill();
}

function stopGenerating() {
  if (eventSource) { eventSource.close(); eventSource = null; }
  if (chatEventSource) { chatEventSource.close(); chatEventSource = null; }
  answerState.value = 'done';
  chatLoading.value = false;
  cleanupFooterContext();
}

async function sendChat(message: string) {
  // 构建附件信息
  const attachments: any[] = [];
  if (attachedFile.value) {
    attachments.push({
      name: attachedFile.value.name,
      type: attachedFile.value.type,
      status: 'parsed' as const
    });
  }

  // 构建技能标签
  const skillTag = selectedSkill.value ? `🔧 ${selectedSkill.value.name}` : '';

  chatMessages.value.push({
    role: 'user',
    content: message,
    attachments: attachments.length > 0 ? attachments : undefined,
    skillTag: skillTag || undefined
  });
  chatLoading.value = true;
  chatFeedback.value = '';

  try {
    // 如果有文件或技能，使用增强聊天端点
    const hasContext = attachedFile.value || selectedSkill.value;
    const chatApi = hasContext ? api.chatEnhanced : api.chat;
    const chatBody: any = { message, chatId: currentChatId.value || undefined };

    // 传递技能上下文
    if (selectedSkill.value) {
      chatBody.skillId = parseInt(selectedSkill.value.id) || undefined;
      chatBody.skillPrompt = '';
    }

    // 传递文件上下文 - 先上传文件获取内容
    if (attachedFile.value) {
      const formData = new FormData();
      formData.append('file', attachedFile.value);
      formData.append('userInput', '');
      
      const uploadRes = await api.uploadDocument(formData);
      if (uploadRes.code !== 0) {
        chatMessages.value.push({ role: 'assistant', content: uploadRes.message || '文件上传失败' });
        chatLoading.value = false;
        cleanupFooterContext();
        return;
      }
      
      chatBody.fileContext = `[文件: ${attachedFile.value.name}]\n${uploadRes.data.fileText || '[文件内容提取中...]'}`;
    }

    cleanupFooterContext();

    const res = await chatApi(chatBody);

    if (res.code === 0) {
      const isNewChat = !currentChatId.value;
      currentChatId.value = res.data.chatId;

      chatMessages.value.push({ role: 'assistant', content: '' });
      const assistantIdx = chatMessages.value.length - 1;
      chatEventSource = createStream(res.data.streamUrl);

      if (isNewChat && !rawHistory.value.some(h => h.text === message && h.type === 'chat')) {
        rawHistory.value.unshift({ text: message, type: 'chat', timestamp: Date.now(), messages: [] });
        localStorage.setItem('userHistory', JSON.stringify(rawHistory.value));
      }

      chatEventSource.addEventListener('start', () => {});
      chatEventSource.addEventListener('chunk', (e: MessageEvent) => {
        const { text } = JSON.parse(e.data);
        chatMessages.value[assistantIdx].content += text;
      });
      chatEventSource.addEventListener('done', () => {
        chatLoading.value = false;
        chatEventSource?.close();
        chatEventSource = null;
        cleanupFooterContext();
        savePersistedState();
        const historyIdx = rawHistory.value.findIndex(h => h.text === message && h.type === 'chat');
        if (historyIdx !== -1) {
          rawHistory.value[historyIdx].messages = [...chatMessages.value];
          localStorage.setItem('userHistory', JSON.stringify(rawHistory.value));
        }
      });
      chatEventSource.addEventListener('error', (e: any) => {
        if (!chatMessages.value[assistantIdx].content) {
          chatMessages.value[assistantIdx].content = e.message || '回答失败，请重试';
        }
        chatLoading.value = false;
        chatEventSource?.close();
        chatEventSource = null;
        cleanupFooterContext();
      });
    } else {
      chatMessages.value.push({ role: 'assistant', content: res.message });
      chatLoading.value = false;
      cleanupFooterContext();
      if (res.code === 403) showLoginModal.value = true;
    }
  } catch (err: any) {
    chatMessages.value.push({ role: 'assistant', content: err.message || '网络错误，请重试' });
    chatLoading.value = false;
    cleanupFooterContext();
  }
}

function copyMessage(text: string) {
  copyToClipboard(text);
}

function editMessage(text: string) {
  query.value = text;
}

function scrollToMessage(idx: number) {
  const el = document.getElementById(`msg-${idx}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clickHistory(index: number, item: HistoryItem) {
  query.value = item.text;
  if (item.type === 'chat') {
    mode.value = 'chat';
    answerState.value = 'idle';
    answerText.value = '';
    searchResults.value = null;
    results.value = [];
    citations.value = [];
    currentQuery.value = '';
    showResults.value = false;
    if (eventSource) { eventSource.close(); eventSource = null; }
    if (chatEventSource) { chatEventSource.close(); chatEventSource = null; }

    if (item.chatId && isLoggedIn.value) {
      loadChatFromDb(item.chatId);
    } else if (item.messages && item.messages.length > 0) {
      chatMessages.value = [...item.messages];
      currentChatId.value = '';
    } else {
      chatMessages.value = [];
      currentChatId.value = '';
    }
  } else {
    mode.value = 'search';
    answerState.value = 'idle';
    answerText.value = '';
    searchResults.value = null;
    results.value = [];
    citations.value = [];
    currentQuery.value = '';
    showResults.value = false;
    searchTurns.value = [];
    chatMessages.value = [];
    currentChatId.value = '';
    if (eventSource) { eventSource.close(); eventSource = null; }
    if (chatEventSource) { chatEventSource.close(); chatEventSource = null; }
  }
}

async function loadChatFromDb(chatId: string) {
  try {
    const res = await api.getChatMessages(chatId);
    if (res.code === 0 && res.data) {
      chatMessages.value = res.data.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));
      currentChatId.value = chatId;
    } else {
      chatMessages.value = [];
      currentChatId.value = '';
    }
  } catch (err) {
    console.error('加载对话失败:', err);
    chatMessages.value = [];
    currentChatId.value = '';
  }
}

async function removeHistory(index: number) {
  const item = rawHistory.value[index];
  if (item.chatId) {
    try {
      await api.deleteChatHistory(item.chatId);
    } catch (err) {
      console.error('删除数据库记录失败:', err);
    }
  }
  rawHistory.value.splice(index, 1);
  localStorage.setItem('userHistory', JSON.stringify(rawHistory.value));
}

function resetHome() {
  searchResults.value = null;
  results.value = [];
  answerState.value = 'idle';
  answerText.value = '';
  citations.value = [];
  currentQuery.value = '';
  showResults.value = false;
  searchTurns.value = [];
  if (eventSource) { eventSource.close(); eventSource = null; }
  if (chatEventSource) { chatEventSource.close(); chatEventSource = null; }
  chatLoading.value = false;
  clearPersistedState();
}

async function clearHistory() {
  try {
    await api.deleteChatHistory();
  } catch (err) {
    console.error('删除数据库历史记录失败:', err);
  }
  chatMessages.value = [];
  currentChatId.value = '';
  rawHistory.value = [];
  localStorage.removeItem('userHistory');
  resetHome();
}

function startNewChat() {
  chatMessages.value = [];
  currentChatId.value = '';
  resetHome();
  mode.value = 'chat';
}

function doLogout() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userInfo');
  isLoggedIn.value = false;
  userInfo.value = {};
  location.reload();
}

function onProfileUpdated(data: { nickname: string; avatar: string }) {
  const stored = JSON.parse(localStorage.getItem('userInfo') || '{}');
  stored.nickname = data.nickname;
  stored.avatar = data.avatar;
  localStorage.setItem('userInfo', JSON.stringify(stored));
  userInfo.value = stored;
}

async function submitFeedback(rating: string) {
  if (isChatMode.value) {
    chatFeedback.value = rating;
  } else {
    feedback.value = rating;
  }
  await api.submitFeedback({ searchId: searchId.value, rating });
}
</script>

<style scoped>
.home-layout { display: flex; height: 100vh; background: var(--bg); overflow: hidden; }
.sidebar-collapsed :deep(.sidebar) { width: 80px; }
.sidebar-collapsed :deep(.sidebar-header) { justify-content: center; padding: 20px 12px; }
.sidebar-collapsed :deep(.logo-text) { font-size: 16px; white-space: nowrap; }
.sidebar-collapsed :deep(.logo svg),
.sidebar-collapsed :deep(.nav-item span),
.sidebar-collapsed :deep(.sidebar-section-title span),
.sidebar-collapsed :deep(.recent-search-item span),
.sidebar-collapsed :deep(.mode-indicator) { display: none; }
.sidebar-collapsed :deep(.sidebar-nav) { align-items: center; }
.sidebar-collapsed :deep(.nav-item) { justify-content: center; padding: 12px; }
.sidebar-collapsed :deep(.sidebar-section-title),
.sidebar-collapsed :deep(.recent-search-item),
.sidebar-collapsed :deep(.sidebar-empty) { display: none; }
.sidebar-collapsed :deep(.sidebar-footer) { align-items: center; padding: 16px 8px; }
.sidebar-collapsed :deep(.logo) { gap: 0; }

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.main-center { justify-content: center; }

.content-scroll {
  overflow-y: auto; display: flex; flex-direction: column; min-height: 0;
}
.content-scroll.has-content { flex: 1; }
.content-scroll.center-content { flex: none; justify-content: center; }
.content-scroll.search-flow-layout { flex-direction: row; overflow-y: hidden; position: relative; }

.results-float-toggle {
  position: fixed; top: 50%; right: 0; transform: translateY(-50%); z-index: 50;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 14px 8px; background: var(--bg-card); border: 1px solid var(--border); border-right: none;
  border-radius: var(--radius) 0 0 var(--radius); color: var(--text-secondary); font-size: 13px;
  cursor: pointer; box-shadow: -2px 0 12px rgba(0,0,0,0.08); transition: all 0.2s;
}
.results-float-toggle.open { right: 320px; border-radius: 0 var(--radius) var(--radius) 0; border-right: 1px solid var(--border); border-left: none; box-shadow: 2px 0 12px rgba(0,0,0,0.12); }
.results-float-toggle:hover { background: var(--bg-input); color: var(--primary); box-shadow: -4px 0 20px rgba(0,0,0,0.12); }
.toggle-icon-svg { flex-shrink: 0; color: var(--primary); }

/* 搜索模式：消息流布局 */
.search-turns-flow {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--msg-container-gap);
  padding: var(--msg-container-padding);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  max-width: calc(100% - 320px);
  margin: 0 auto;
}

.search-turns-flow .message-wrapper {
  width: 100%;
  max-width: var(--msg-wrapper-max-width);
}

/* 回到底部按钮 */
.search-scroll-bottom-btn {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}
.search-scroll-bottom-btn:hover {
  background: var(--bg-input);
  color: var(--primary);
  border-color: var(--primary);
}

/* 搜索结果侧栏（内联） */
.results-sidebar {
  width: 0; overflow: hidden; background: var(--bg-card);
  transition: width 0.3s ease; display: flex; flex-direction: column; flex-shrink: 0;
}
.results-sidebar.open { width: 320px; }
.results-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; height: 52px; }
.results-sidebar-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text); }
.close-results-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--text-light); cursor: pointer; border-radius: var(--radius-sm); transition: all 0.2s; }
.close-results-btn:hover { background: var(--bg-input); color: var(--danger); }
.results-sidebar-content { flex: 1; overflow-y: auto; padding: 12px 16px; }
.result-item { padding: 12px; margin-bottom: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); transition: all 0.2s; }
.result-item:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
.result-title { font-size: 13px; font-weight: 600; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 6px; line-height: 1.4; }
.result-domain { font-size: 11px; color: var(--text-light); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.result-domain-text { color: var(--text-light); }
.result-engine-tag { font-size: 10px; color: #fff; padding: 1px 6px; border-radius: 8px; font-weight: 600; background: var(--gradient-primary); }
.result-snippet { font-size: 12px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.result-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 16px; color: var(--text-light); font-size: 13px; text-align: center; }
.result-empty svg { color: var(--text-light); margin-bottom: 8px; }

@media (max-width: 768px) {
  :deep(.sidebar) { display: none; }
  .results-float-toggle { padding: 12px; border-radius: var(--radius) 0 0 var(--radius); }
  .results-float-toggle.open { right: 280px; border-radius: 0 var(--radius) var(--radius) 0; }
}
</style>
