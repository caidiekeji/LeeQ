/**
 * TaskDetailPage - 任务详情页
 * 显示单个抓取任务的详细信息和Markdown内容
 */
<template>
    <!-- 任务详情容器（任务加载成功后显示） -->
    <div class="task-detail" v-if="task">
      <!-- 返回按钮区 -->
      <div class="detail-header">
        <button class="btn btn-sm btn-outline" @click="$router.back()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          返回列表
        </button>
      </div>

      <!-- 任务信息面板 -->
      <div class="info-panel">
        <h3>任务信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">任务 ID</span>
            <span class="info-value mono">{{ task.taskId }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">目标 URL</span>
            <a :href="task.url" target="_blank" class="info-value link text-truncate">{{ task.url }}</a>
          </div>
          <div class="info-item">
            <span class="info-label">任务类型</span>
            <span :class="['badge', task.taskType === 'scrape' ? 'badge-info' : 'badge-warning']">{{ task.taskType === 'scrape' ? '单页抓取' : '全网爬取' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">状态</span>
            <span :class="['status-badge', statusBadgeClass(task.status)]">
              <span class="status-dot"></span>
              {{ statusLabel(task.status) }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value mono">{{ formatDate(task.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">完成时间</span>
            <span class="info-value mono">{{ formatDate(task.completedAt) }}</span>
          </div>
        </div>
        <!-- 操作按钮区 -->
        <div class="info-actions">
          <button class="btn btn-sm btn-outline" @click="copyContent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            复制内容
          </button>
          <button v-if="task.status === 'failed'" class="btn btn-sm btn-danger" @click="retry" :disabled="retrying">{{ retrying ? '重试中...' : '重试任务' }}</button>
        </div>
      </div>

      <!-- 抓取内容面板（Markdown渲染） -->
      <div class="content-panel">
        <h3>抓取内容</h3>
        <div v-if="task.markdownContent" class="markdown-body" v-html="renderedContent"></div>
        <div v-else class="content-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h4>暂无内容</h4>
          <p>任务可能尚未完成或抓取内容为空</p>
        </div>
      </div>
    </div>
    <!-- 加载中状态 -->
    <div v-else class="loading-state"><p>加载中...</p></div>
</template>

<script setup lang="ts">
/**
 * TaskDetailPage脚本逻辑
 * 获取任务详情、渲染Markdown、复制内容、重试任务
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { toastSuccess, toastError } from '../../utils/toast';
import MarkdownIt from 'markdown-it';

// Markdown渲染器配置
const md = new MarkdownIt({ html: false, breaks: true, linkify: true });
const route = useRoute();
const router = useRouter();
const task = ref<any>(null);  // 任务数据
const retrying = ref(false);   // 重试加载状态

// 计算属性：将Markdown转换为HTML
const renderedContent = computed(() => task.value?.markdownContent ? md.render(task.value.markdownContent) : '');

/**
 * 获取状态显示文本
 */
function statusLabel(s: string) {
  const m: any = { pending: '等待中', running: '进行中', completed: '已完成', failed: '失败' };
  return m[s] || s;
}

/**
 * 获取状态徽章样式类名
 */
function statusBadgeClass(s: string) {
  const m: any = { pending: 'status-pending', running: 'status-running', completed: 'status-completed', failed: 'status-failed' };
  return m[s] || 'status-pending';
}

/**
 * 复制任务内容到剪贴板
 */
async function copyContent() {
  try {
    await navigator.clipboard.writeText(task.value.markdownContent || '');
    toastSuccess('内容已复制到剪贴板');
  } catch {
    toastError('复制失败');
  }
}

/**
 * 重试失败任务
 */
async function retry() {
  if (retrying.value) return;
  retrying.value = true;
  try {
    const res = await api.retryTask(task.value.taskId);
    if (res.code === 0) router.back();
    else toastError(res.message || '重试失败');
  } catch { toastError('重试失败'); }
  finally { retrying.value = false; }
}

/**
 * 组件挂载时获取任务详情
 */
onMounted(async () => {
  const res = await api.getTaskDetail(route.params.taskId as string);
  if (res.code === 0) task.value = res.data;
});
</script>

<style scoped>
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
}

.info-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.info-panel h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 18px;
  color: var(--text);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 14px;
  color: var(--text);
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 13px;
}

.info-value.link {
  color: var(--primary);
  word-break: break-all;
}

.info-value.link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

.info-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.content-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

.content-panel h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 18px;
  color: var(--text);
}

.content-empty {
  text-align: center;
  padding: 40px;
}

.empty-icon {
  color: var(--text-light);
  margin-bottom: 16px;
}

.content-empty h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.content-empty p {
  font-size: 14px;
  color: var(--text-secondary);
}

.loading-state {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}

.markdown-body {
  font-size: 15px;
  line-height: 1.85;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: var(--text);
  margin: 22px 0 12px;
}

.markdown-body :deep(p) {
  margin-bottom: 14px;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--primary);
  padding-left: 16px;
  color: var(--text-secondary);
  margin: 14px 0;
}

.markdown-body :deep(code) {
  background: var(--bg-input);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  color: var(--text);
}

.markdown-body :deep(pre) {
  background: var(--bg-input);
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-body :deep(a) {
  color: var(--primary);
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 14px;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--bg-input);
  font-weight: 600;
}

@media (max-width: 1024px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
