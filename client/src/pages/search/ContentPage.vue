/**
 * ContentPage - 内容详情页
 * 根据文档ID显示抓取页面的Markdown内容
 */
<template>
  <!-- 页面容器 -->
  <div class="content-page">
    <!-- 顶部导航栏（返回按钮） -->
    <header class="content-header">
      <div class="container">
        <router-link to="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          返回搜索
        </router-link>
      </div>
    </header>
    
    <!-- 内容主体区域 -->
    <div class="container content-body">
      <!-- 加载骨架屏 -->
      <div v-if="loading" class="skeleton-content">
        <div class="skeleton" style="height:28px;width:55%;margin-bottom:20px"></div>
        <div class="skeleton" style="height:14px;width:92%;margin-bottom:10px" v-for="i in 8" :key="i"></div>
      </div>
      
      <!-- 内容卡片（抓取成功后显示） -->
      <div v-else-if="content" ref="contentCard" class="content-card">
        <!-- 来源信息区 -->
        <div class="content-meta">
          <div class="source-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <a :href="content.url" target="_blank" class="source-url">{{ content.url }}</a>
          </div>
          <span class="crawl-time">抓取时间：{{ content.crawledAt }}</span>
        </div>
        <div class="content-divider"></div>
        <!-- Markdown渲染区域 -->
        <div class="markdown-body" v-html="renderedContent"></div>
      </div>
      
      <!-- 空状态（内容不存在时显示） -->
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-light);margin-bottom:16px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>内容不存在</h3>
        <p>该页面内容可能已被删除或无法访问</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../utils/api';
import { renderMarkdown, runMermaid } from '../../utils/markdown';

const route = useRoute();
const loading = ref(true);
const content = ref<any>(null);
const contentCard = ref<HTMLElement>();

const renderedContent = computed(() => content.value ? renderMarkdown(content.value.markdownContent) : '');

onMounted(async () => {
  const docId = route.params.docId as string;
  const res = await api.getContent(docId);
  if (res.code === 0) content.value = res.data;
  loading.value = false;
});

watch(content, () => {
  nextTick(() => {
    if (contentCard.value) runMermaid(contentCard.value);
  });
});
</script>

<style scoped>
.content-page { min-height: 100vh; background: var(--bg); }
.content-header { background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 14px 0; box-shadow: var(--shadow); }
.back-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--text-secondary); font-size: 14px; transition: color .2s;
}
.back-link:hover { color: var(--text); }
.content-body { padding: 32px 0 80px; max-width: 860px; }
.content-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 28px;
}
.content-meta { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.source-row { display: flex; align-items: center; gap: 8px; }
.source-row svg { color: var(--text-light); flex-shrink: 0; }
.source-url { font-size: 14px; color: var(--primary-light); word-break: break-all; }
.crawl-time { font-size: 12px; color: var(--text-light); }
.content-divider { height: 1px; background: var(--border); margin-bottom: 24px; }

.markdown-body { font-size: 15px; line-height: 1.85; }
.skeleton-content { padding: 24px 0; }
</style>
