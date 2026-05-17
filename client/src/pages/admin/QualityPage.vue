<template>
  <div class="quality-page fade-up" v-if="!loading">
    <PageHeader title="质量面板" description="页面完整性、API契约匹配率等核心质量指标" />

    <div class="stats-row">
      <StatCard label="页面健康度" :value="healthPercent" unit="%" :color="healthColor">
        <template #icon>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </template>
      </StatCard>
      <StatCard label="API匹配率" :value="apiMatchRate" unit="%" :color="apiColor">
        <template #icon>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </template>
      </StatCard>
      <StatCard label="总路由数" :value="data.totalRoutes" color="blue">
        <template #icon>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </template>
      </StatCard>
      <StatCard label="API端点总数" :value="data.totalApiEndpoints" color="purple">
        <template #icon>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </template>
      </StatCard>
    </div>

    <div class="mid-row">
      <div class="panel card">
        <div class="panel-header"><h3>质量趋势</h3></div>
        <div class="bar-chart" v-if="data.auditHistory && data.auditHistory.length">
          <div class="bar-col" v-for="d in data.auditHistory" :key="d.date">
            <div class="bar-val-top">{{ d.score }}%</div>
            <div class="bar" :style="{ height: (d.score / 100 * 100) + '%' }"></div>
            <span class="bar-label">{{ d.date.substring(5) }}</span>
          </div>
        </div>
        <div v-else class="chart-empty">暂无趋势数据</div>
      </div>

      <div class="panel card">
        <div class="panel-header">
          <h3>审计操作</h3>
        </div>
        <div class="audit-actions">
          <p class="audit-last">上次审计：{{ data.lastAuditDate }}</p>
          <button class="btn btn-primary" @click="runAudit" :disabled="auditing">
            {{ auditing ? '审计中...' : '重新审计' }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel card">
      <div class="panel-header">
        <h3>问题清单</h3>
        <span class="issue-count" :class="issueCountClass">{{ issues.length }} 条</span>
      </div>
      <vxe-table
        v-if="issues.length"
        :data="issues"
        stripe
        show-overflow="title"
        :row-config="{ keyField: 'id' }"
        round
      >
        <vxe-column field="id" title="编号" width="80" align="center" />
        <vxe-column field="level" title="级别" width="80" align="center">
          <template #default="{ row }">
            <span :class="['level-tag', 'level-' + row.level.toLowerCase()]">{{ row.level }}</span>
          </template>
        </vxe-column>
        <vxe-column field="type" title="类型" width="100" align="center" />
        <vxe-column field="path" title="路径" min-width="200">
          <template #default="{ row }">
            <span class="mono">{{ row.path }}</span>
          </template>
        </vxe-column>
        <vxe-column field="description" title="说明" min-width="200" />
        <vxe-column field="status" title="状态" width="100" align="center">
          <template #default="{ row }">
            <span :class="['status-tag', 'status-' + row.status]">{{ statusMap[row.status] || row.status }}</span>
          </template>
        </vxe-column>
      </vxe-table>
      <div v-else class="chart-empty">✅ 无质量问题</div>
    </div>
  </div>
  <div class="quality-page" v-else>
    <div class="skeleton-row">
      <div class="skeleton-card" v-for="i in 4" :key="i"></div>
    </div>
    <div class="skeleton-card skeleton-tall"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../../utils/api';
import StatCard from '../../components/admin/StatCard.vue';
import PageHeader from '../../components/admin/PageHeader.vue';

const loading = ref(true);
const auditing = ref(false);

const data = ref<any>({
  pageHealth: 0,
  apiMatchRate: 0,
  totalRoutes: 0,
  totalPages: 0,
  totalApiEndpoints: 0,
  lastAuditDate: '',
  auditHistory: [],
});

const issues = ref<any[]>([]);

const statusMap: Record<string, string> = {
  monitoring: '观察中',
  fixed: '已修复',
  pending: '待处理',
};

const healthPercent = computed(() => data.value.pageHealth || 0);
const apiMatchRate = computed(() => data.value.apiMatchRate || 0);

const healthColor = computed(() => healthPercent.value >= 98 ? 'green' : healthPercent.value >= 90 ? 'orange' : 'rose');
const apiColor = computed(() => apiMatchRate.value >= 100 ? 'green' : apiMatchRate.value >= 95 ? 'orange' : 'rose');
const issueCountClass = computed(() => issues.value.length === 0 ? 'count-ok' : 'count-warn');

async function loadData() {
  loading.value = true;
  try {
    const [overviewRes, issuesRes] = await Promise.all([
      api.getQualityOverview(),
      api.getQualityIssues(),
    ]);
    if (overviewRes.code === 0) data.value = overviewRes.data;
    if (issuesRes.code === 0) issues.value = issuesRes.data;
  } catch (e) {
    console.error('加载质量数据失败:', e);
  } finally {
    loading.value = false;
  }
}

async function runAudit() {
  auditing.value = true;
  try {
    const res = await api.runQualityAudit();
    if (res.code === 0) {
      data.value = res.data;
      await loadData();
    }
  } catch (e) {
    console.error('审计执行失败:', e);
  } finally {
    auditing.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.quality-page { padding: 0; display: flex; flex-direction: column; gap: 20px; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.mid-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.panel { padding: 24px; }
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.panel-header h3 { font-size: 16px; font-weight: 600; margin: 0; color: var(--text); }

.issue-count { font-size: 13px; padding: 2px 10px; border-radius: 12px; font-weight: 500; }
.count-ok { background: var(--success-bg); color: var(--success); }
.count-warn { background: var(--warning-bg); color: var(--warning); }

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  height: 160px;
  padding: 0 12px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}
.bar-val-top { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-family: var(--font-mono); }
.bar {
  width: 32px;
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-light) 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.4s;
}
.bar-label { font-size: 11px; color: var(--text-tertiary); margin-top: 6px; }

.audit-actions { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px 0; }
.audit-last { font-size: 13px; color: var(--text-secondary); }

.level-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.level-p0 { background: var(--danger-bg); color: var(--danger); }
.level-p1 { background: var(--warning-bg); color: var(--warning); }
.level-p2 { background: var(--info-bg); color: var(--info); }

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}
.status-monitoring { background: var(--warning-bg); color: var(--warning); }
.status-fixed { background: var(--success-bg); color: var(--success); }
.status-pending { background: var(--info-bg); color: var(--info); }

.chart-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.skeleton-card {
  height: 120px;
  background: linear-gradient(90deg, var(--bg-input) 25%, var(--bg-dark) 50%, var(--bg-input) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius-lg);
  animation: shimmer 1.5s infinite;
}
.skeleton-tall { height: 240px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 1024px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .mid-row { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; }
}
</style>