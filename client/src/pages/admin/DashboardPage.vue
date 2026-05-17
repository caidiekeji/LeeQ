<template>
  <div class="dashboard fade-up" v-if="!loading">
    <!-- 统计卡片行 -->
    <div class="stats-row">
      <StatCard label="总搜索次数" :value="formatNum(data.totalSearches)" color="blue">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </template>
      </StatCard>
      <StatCard label="今日搜索" :value="formatNum(data.todaySearches)" color="green">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </template>
      </StatCard>
      <StatCard label="平均耗时" :value="data.avgElapsedMs" unit="ms" color="purple">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </template>
      </StatCard>
      <StatCard label="索引总量" :value="formatNum(data.totalIndexDocs)" color="orange">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </template>
      </StatCard>
    </div>

    <!-- 第二行统计 -->
    <div class="stats-row">
      <StatCard label="注册用户" :value="formatNum(data.totalUsers)" color="cyan">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </template>
      </StatCard>
      <StatCard label="聊天记录" :value="formatNum(data.totalChats)" color="rose">
        <template #icon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </template>
      </StatCard>
    </div>

    <!-- 图表行 -->
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <h3>近7天搜索趋势</h3>
        </div>
        <div class="bar-chart" v-if="data.searchTrend && data.searchTrend.length">
          <div class="bar-col" v-for="d in data.searchTrend" :key="d.date">
            <div class="bar-val-top">{{ d.count }}</div>
            <div class="bar" :style="{ height: (d.count / maxCount * 100) + '%' }"></div>
            <span class="bar-label">{{ d.date.substring(5) }}</span>
          </div>
        </div>
        <div v-else class="chart-empty">暂无趋势数据</div>
      </div>

      <div class="chart-card service-card">
        <div class="chart-header">
          <h3>服务状态</h3>
        </div>
        <div class="service-list">
          <div class="service-item" v-for="(s, k) in data.serviceStatus" :key="k">
            <div :class="['service-indicator', s === 'online' ? 'online' : 'offline']">
              <div class="indicator-dot"></div>
            </div>
            <div class="service-info">
              <span class="service-name">{{ serviceNames[k as keyof typeof serviceNames] }}</span>
              <span :class="['service-status', s === 'online' ? 'text-success' : 'text-danger']">
                {{ s === 'online' ? '运行正常' : '服务异常' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门搜索 -->
    <div class="chart-card">
      <div class="chart-header">
        <h3>热门搜索词</h3>
      </div>
      <div class="query-list" v-if="data.topQueries && data.topQueries.length">
        <div class="query-item" v-for="(q, i) in data.topQueries" :key="i">
          <span class="query-rank" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
          <span class="query-text">{{ q.query }}</span>
          <span class="query-count">{{ formatNum(q.count) }} 次</span>
        </div>
      </div>
      <div v-else class="chart-empty">暂无数据</div>
    </div>
  </div>

  <!-- 加载中骨架屏 -->
  <div class="dashboard" v-else>
    <div class="stats-row">
      <div class="skeleton" style="height:112px;border-radius:var(--radius-lg)" v-for="i in 6" :key="i"></div>
    </div>
    <div class="charts-row">
      <div class="skeleton" style="height:280px;border-radius:var(--radius-lg);flex:1"></div>
      <div class="skeleton" style="height:280px;border-radius:var(--radius-lg);width:360px;flex-shrink:0"></div>
    </div>
    <div class="skeleton" style="height:240px;border-radius:var(--radius-lg)"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../../utils/api';
import { formatNum } from '../../utils/format';
import StatCard from '../../components/admin/StatCard.vue';

const loading = ref(true);
const data = ref<any>({
  totalSearches: 0, todaySearches: 0, avgElapsedMs: 0, totalIndexDocs: 0,
  searchTrend: [], topQueries: [], serviceStatus: {}
});

const serviceNames = { anycrawl: 'AnyCrawl 抓取服务', elasticsearch: 'Elasticsearch 索引', llm: 'LLM 模型服务' };
const maxCount = computed(() => Math.max(...(data.value.searchTrend || []).map((d: any) => d.count), 1));

onMounted(async () => {
  const res = await api.getDashboard();
  if (res.code === 0) data.value = res.data;
  loading.value = false;
});
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.charts-row {
  display: flex;
  gap: 24px;
}

.chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  flex: 1;
  min-width: 0;
}

.chart-header {
  margin-bottom: 24px;
}

.chart-header h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
  margin: 0;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  height: 220px;
  padding: 0 8px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.bar-val-top {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-weight: 500;
}

.bar {
  width: 100%;
  max-width: 40px;
  background: var(--gradient-primary);
  border-radius: 2px 2px 0 0;
  transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 4px;
}

.bar-label {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 12px;
}

.service-card {
  width: 360px;
  flex-shrink: 0;
}

.service-list {
  display: flex;
  flex-direction: column;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.service-item:last-child {
  border: none;
  padding-bottom: 0;
}

.service-indicator {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.service-indicator.online {
  background: var(--success-bg);
}

.service-indicator.offline {
  background: var(--danger-bg);
}

.indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.online .indicator-dot {
  background: var(--success);
  box-shadow: 0 0 8px rgba(82, 196, 26, 0.4);
  animation: pulse-dot 2s infinite;
}

.offline .indicator-dot {
  background: var(--danger);
  box-shadow: 0 0 8px rgba(255, 77, 79, 0.4);
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.service-status {
  font-size: 12px;
  font-weight: 400;
}

.query-list {
  display: flex;
  flex-direction: column;
}

.query-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  transition: all 0.2s;
}

.query-item:hover {
  background: var(--bg-subtle);
  margin: 0 -12px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: 2px;
}

.query-item:last-child {
  border: none;
}

.query-rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-input);
  flex-shrink: 0;
}

.query-rank.rank-top {
  background: #314659;
  color: #FFFFFF;
}

.query-text {
  flex: 1;
  font-size: 14px;
  color: var(--text);
}

.query-count {
  font-size: 14px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.chart-empty {
  text-align: center;
  padding: 48px;
  color: var(--text-secondary);
  font-size: 14px;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-row {
    flex-direction: column;
  }

  .service-card {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .bar-chart {
    gap: 8px;
  }

  .bar {
    max-width: 32px;
  }
}
</style>