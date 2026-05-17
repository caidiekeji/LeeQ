<template>
  <div class="backup-page fade-up">
    <div class="page-header">
      <div class="page-info">
        <h1 class="page-title">数据库备份</h1>
        <p class="page-desc">管理数据库备份、恢复和清理操作</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" @click="handleCreateBackup" :disabled="isCreating">
          <svg v-if="isCreating" width="14" height="14" class="spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 5"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ isCreating ? '备份中...' : '创建备份' }}
        </button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-label">备份总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ formatSize(stats.totalSize) }}</div>
          <div class="stat-label">总大小</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.lastBackupTime ? formatTime(stats.lastBackupTime) : '-' }}</div>
          <div class="stat-label">最近备份</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>备份列表</h3>
        <span class="list-count">共 {{ backupList.length }} 条记录</span>
      </div>

      <div v-if="backupList.length === 0" class="empty-state" style="border:none">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        <h3>暂无备份记录</h3>
        <p>点击上方按钮创建第一个数据库备份</p>
      </div>

      <div v-else class="backup-list">
        <div v-for="backup in backupList" :key="backup.backupId" class="backup-item">
          <div class="backup-info">
            <div class="backup-header">
              <span class="backup-name">{{ backup.fileName }}</span>
              <span v-if="backup.status === 'restored'" class="badge badge-success">已恢复</span>
              <span v-else-if="backup.status === 'completed'" class="badge badge-info">已完成</span>
            </div>
            <div class="backup-meta">
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ formatTime(backup.createdAt) }}
              </span>
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                {{ formatSize(backup.fileSize) }}
              </span>
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {{ backup.backupId.substring(0, 20) }}...
              </span>
            </div>
          </div>
          <div class="backup-actions">
            <button class="btn btn-sm" @click="handleDownload(backup)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              下载
            </button>
            <button class="btn btn-sm btn-outline" @click="handleRestore(backup)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              恢复
            </button>
            <button class="btn btn-sm btn-danger" @click="handleDelete(backup)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showRestoreConfirm" class="modal-overlay" @click.self="showRestoreConfirm = false">
      <div class="modal">
        <div class="modal-warning">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h3>确认恢复备份</h3>
        <p>此操作将覆盖当前数据库中的所有数据，且不可撤销！</p>
        <div class="restore-info">
          <div class="info-row">
            <span class="info-label">备份文件</span>
            <span class="info-value">{{ restoringBackup?.fileName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">备份时间</span>
            <span class="info-value">{{ restoringBackup?.createdAt ? formatTime(restoringBackup.createdAt) : '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">文件大小</span>
            <span class="info-value">{{ restoringBackup?.fileSize ? formatSize(restoringBackup.fileSize) : '-' }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showRestoreConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmRestore" :disabled="isRestoring">
            {{ isRestoring ? '恢复中...' : '确认恢复' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../utils/api';

const backupList = ref<any[]>([]);
const stats = ref({ totalCount: 0, totalSize: 0, lastBackupTime: null });
const isCreating = ref(false);
const isRestoring = ref(false);
const showRestoreConfirm = ref(false);
const restoringBackup = ref<any>(null);

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(timeStr: string) {
  if (!timeStr) return '';
  return new Date(timeStr).toLocaleString('zh-CN');
}

async function loadBackups() {
  const res = await api.getBackups();
  if (res.code === 0) backupList.value = res.data;
}

async function loadStats() {
  const res = await api.getBackupStats();
  if (res.code === 0) stats.value = res.data;
}

async function handleCreateBackup() {
  if (isCreating.value) return;
  isCreating.value = true;
  const res = await api.createBackup();
  isCreating.value = false;
  if (res.code === 0) {
    alert('备份创建成功');
    await loadBackups();
    await loadStats();
  } else {
    alert('备份创建失败: ' + res.message);
  }
}

async function handleDownload(backup: any) {
  try {
    const res = await api.downloadBackup(backup.backupId);
    if (!res.ok) {
      const err = await res.json();
      alert('下载失败: ' + err.message);
      return;
    }
    const content = await res.text();
    const url = window.URL.createObjectURL(new Blob([content], { type: 'text/sql' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    alert('下载失败: ' + err.message);
  }
}

function handleRestore(backup: any) {
  restoringBackup.value = backup;
  showRestoreConfirm.value = true;
}

async function confirmRestore() {
  if (!restoringBackup.value || isRestoring.value) return;
  isRestoring.value = true;
  const res = await api.restoreBackup(restoringBackup.value.backupId);
  isRestoring.value = false;
  showRestoreConfirm.value = false;
  if (res.code === 0) {
    alert('恢复成功');
    await loadBackups();
  } else {
    alert('恢复失败: ' + res.message);
  }
}

async function handleDelete(backup: any) {
  if (!confirm(`确定要删除备份「${backup.fileName}」吗？`)) return;
  const res = await api.deleteBackup(backup.backupId);
  if (res.code === 0) {
    await loadBackups();
    await loadStats();
  } else {
    alert('删除失败: ' + res.message);
  }
}

onMounted(async () => {
  await loadBackups();
  await loadStats();
});
</script>

<style scoped>
.backup-page { display: flex; flex-direction: column; gap: 20px; }

.stats-row { display: flex; gap: 16px; }

.stat-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  min-width: 180px;
}

.stat-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: var(--primary-bg); color: var(--primary);
  border-radius: var(--radius-sm);
}

.stat-info { display: flex; flex-direction: column; }
.stat-value { font-size: 20px; font-weight: 600; color: var(--text); }
.stat-label { font-size: 12px; color: var(--text-secondary); }

.card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; background: var(--bg-input);
  border-bottom: 1px solid var(--border);
}

.card-header h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
.list-count { font-size: 13px; color: var(--text-secondary); }

.backup-list { padding: 8px; }

.backup-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px; margin-bottom: 8px;
  background: var(--bg-input); border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: background 0.15s, border-color 0.15s;
}

.backup-item:hover {
  background: var(--primary-bg);
  border-color: var(--primary);
}

.backup-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.backup-name { font-size: 14px; font-weight: 500; color: var(--text); font-family: var(--font-mono); }
.backup-meta { display: flex; gap: 16px; }
.meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }

.backup-actions { display: flex; gap: 8px; }

.modal-warning {
  text-align: center; color: var(--warning); margin-bottom: 16px;
}

.restore-info {
  background: var(--bg-input); border-radius: var(--radius-sm);
  padding: 12px; margin-bottom: 20px;
}

.info-row { display: flex; justify-content: space-between; padding: 6px 0; }
.info-label { font-size: 13px; color: var(--text-secondary); }
.info-value { font-size: 13px; color: var(--text); font-family: var(--font-mono); }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .stats-row { flex-wrap: wrap; }
  .stat-card { flex: 1; min-width: calc(50% - 8px); }
  .backup-item { flex-direction: column; align-items: stretch; gap: 12px; }
  .backup-actions { justify-content: flex-end; }
}
</style>