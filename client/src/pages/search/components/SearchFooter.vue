<template>
  <div class="search-footer">
    <div class="search-container">
      <input ref="fileInputRef" type="file" accept=".pdf,.docx,.txt,.md,.json,.csv,.html,.xml"
        @change="onFileSelected" hidden />

      <div class="search-input-box" :class="{ 'has-attachment': hasAttachment, 'has-skill': selectedSkill }">

        <!-- 附件预览行 -->
        <div class="attachment-row" v-if="hasAttachment">
          <div class="attachment-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="attachment-name">{{ attachmentName }}</span>
            <button class="attachment-remove" @click="removeAttachment">✕</button>
          </div>
        </div>

        <!-- 技能选中提示 -->
        <div class="skill-chip-row" v-if="selectedSkill">
          <div class="skill-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            </svg>
            <span class="skill-name">{{ selectedSkillName }}</span>
            <span class="skill-source">{{ selectedSkillSource === 'user' ? '我的' : '系统' }}</span>
            <button class="skill-remove" @click="clearSkill">✕</button>
          </div>
        </div>

        <div class="input-row">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle v-if="mode !== 'chat'" cx="11" cy="11" r="8"/>
            <path v-if="mode !== 'chat'" d="m21 21-4.3-4.3"/>
            <path v-else d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <input
            ref="inputRef"
            :value="modelValue"
            :placeholder="placeholder"
            @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
            @keydown.enter="$emit('search')"
            :disabled="loading || chatLoading"
            class="search-input"
          />
          <button v-if="isStreaming" class="stop-btn" @click="$emit('stop')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
          <button v-else class="send-btn" @click="$emit('search')"
            :disabled="(!modelValue.trim() && !hasAttachment && !selectedSkill) || loading || chatLoading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div class="bottom-row">
          <button class="mode-toggle-btn" :class="{ active: mode === 'search' }" @click="$emit('switchMode', 'search')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            智能搜索
          </button>

          <button class="mode-toggle-btn" :class="{ active: mode === 'summarize' }" @click="$emit('switchMode', 'summarize')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            URL 摘要
          </button>

          <button class="mode-toggle-btn" :class="{ active: mode === 'chat' }" @click="$emit('switchMode', 'chat')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            聊天
          </button>

          <span class="mode-divider"></span>

          <button class="mode-toggle-btn doc-btn" @click="triggerFileSelect">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ mode === 'chat' ? (hasAttachment ? '更换文件' : '上传文件') : (hasAttachment ? '重新上传' : '文档分析') }}
          </button>

          <!-- 技能下拉选择器 -->
          <div class="skill-select-wrapper">
            <select v-model="skillSelectValue" @change="onSkillChange" class="skill-select">
              <option value="">{{ mode === 'chat' ? '选择技能' : '技能执行' }}</option>
              <optgroup label="系统技能" v-if="systemSkills.length > 0">
                <option v-for="s in systemSkills" :key="'sys-' + s.id" :value="'system|' + s.id + '|' + s.skillName">{{ s.skillName }}</option>
              </optgroup>
              <optgroup label="我的技能" v-if="userSkills.length > 0">
                <option v-for="s in userSkills" :key="'usr-' + s.id" :value="'user|' + s.id + '|' + s.skillName">{{ s.skillName }}</option>
              </optgroup>
            </select>
          </div>

          <div v-if="mode === 'summarize'" class="url-input-inline">
            <svg class="url-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <input :value="targetUrl" placeholder="粘贴网页链接..."
              @input="$emit('update:targetUrl', ($event.target as HTMLInputElement).value)" class="url-input-inline-field" />
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../../../utils/api';

const props = defineProps<{
  modelValue: string;
  targetUrl: string;
  mode: string;
  loading: boolean;
  chatLoading: boolean;
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:targetUrl': [value: string];
  search: [];
  switchMode: [mode: string];
  stop: [];
  'file-change': [file: File | null];
  'skill-change': [skill: { source: string; id: string; name: string } | null];
}>();

const inputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();
const attachedFile = ref<File | null>(null);
const systemSkills = ref<any[]>([]);
const userSkills = ref<any[]>([]);
const skillSelectValue = ref('');
const selectedSkill = ref<{ source: string; id: string; name: string } | null>(null);

const hasAttachment = computed(() => !!attachedFile.value);
const attachmentName = computed(() => attachedFile.value?.name || '');
const selectedSkillName = computed(() => selectedSkill.value?.name || '');
const selectedSkillSource = computed(() => selectedSkill.value?.source || '');

const placeholder = computed(() => {
  if (props.mode === 'chat') return '输入消息与 AI 聊天...';
  if (selectedSkill.value) return `输入内容，使用「${selectedSkill.value.name}」技能处理...`;
  if (hasAttachment.value) return '输入你的问题，点击发送分析文档...';
  return '输入你想了解的任何内容...';
});

function triggerFileSelect() { fileInputRef.value?.click(); }

function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] || null;
  if (file && file.size > 10 * 1024 * 1024) { alert('文件大小不能超过10MB'); if (fileInputRef.value) fileInputRef.value.value = ''; return; }
  attachedFile.value = file;
  emit('file-change', file);
}

function removeAttachment() {
  attachedFile.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
  emit('file-change', null);
}

function onSkillChange() {
  const val = skillSelectValue.value;
  if (!val) { selectedSkill.value = null; emit('skill-change', null); return; }
  const parts = val.split('|');
  selectedSkill.value = { source: parts[0], id: parts[1], name: parts[2] };
  emit('skill-change', selectedSkill.value);
}

function clearSkill() {
  selectedSkill.value = null;
  skillSelectValue.value = '';
  emit('skill-change', null);
}

function loadUserSkills() {
  const token = localStorage.getItem('userToken');
  if (token) {
    api.getUserSkills().then(res => {
      if (res.code === 0) {
        userSkills.value = res.data.map((s: any) => ({ id: String(s.id), skillName: s.skillName, promptTemplate: s.promptTemplate }));
      }
    }).catch(() => {});
  } else {
    try { const raw = localStorage.getItem('userSkills'); if (raw) userSkills.value = JSON.parse(raw); }
    catch { userSkills.value = []; }
  }
}

defineExpose({ triggerFileSelect, clearSkill, removeAttachment });

const handleStorageChange = () => { loadUserSkills(); };
const handleUserLoginFooter = () => { loadUserSkills(); };

onMounted(() => {
  api.getSkills().then(res => { if (res.code === 0) systemSkills.value = res.data; }).catch(() => {});
  loadUserSkills();
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('user-login', handleUserLoginFooter);
});

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('user-login', handleUserLoginFooter);
});
</script>

<style scoped>
.search-footer { background: var(--bg); padding: 16px 32px; flex-shrink: 0; width: 100%; }
.search-container { max-width: 900px; margin: 0 auto; }

.search-input-box {
  background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 12px 16px; transition: border-color 0.2s, box-shadow 0.2s;
  display: flex; flex-direction: column; gap: 10px;
}
.search-input-box.has-attachment { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.search-input-box.has-skill { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }

.attachment-row, .skill-chip-row { display: flex; align-items: center; }

.attachment-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--primary-bg); border-radius: 20px;
  font-size: 13px; color: var(--primary);
}
.attachment-chip svg { color: var(--primary); flex-shrink: 0; }
.attachment-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
.attachment-remove, .skill-remove {
  width: 18px; height: 18px; border: none; border-radius: 50%; background: transparent;
  color: var(--text-light); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.attachment-remove:hover { background: rgba(239,68,68,0.15); color: var(--danger); }
.skill-remove:hover { background: var(--accent-bg); color: var(--accent); }

.skill-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--accent-bg); border-radius: 20px;
  font-size: 13px; color: var(--accent);
}
.skill-chip svg { color: var(--accent); flex-shrink: 0; }
.skill-name { font-weight: 500; }
.skill-source {
  font-size: 11px; padding: 1px 6px; border-radius: 4px;
  background: var(--accent-bg); color: var(--accent); font-weight: 500;
}

.input-row { display: flex; align-items: center; gap: 12px; }
.search-icon { color: var(--text-light); flex-shrink: 0; }
.search-input {
  flex: 1; background: transparent; border: none; padding: 24px 0;
  font-size: 16px; color: var(--text); outline: none; box-shadow: none;
}
.search-input::placeholder { color: var(--text-light); }

.send-btn {
  width: 40px; height: 40px; border-radius: 10px; border: none;
  background: var(--gradient-btn); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { background: var(--gradient-primary); box-shadow: 0 4px 16px rgba(79,110,247,0.4); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; background: var(--border); }

.stop-btn {
  width: 40px; height: 40px; border-radius: 10px; border: none;
  background: var(--danger); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.stop-btn:hover { background: #DC2626; box-shadow: 0 4px 16px var(--danger-bg); }

.bottom-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.mode-toggle-btn {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px;
  border: none; border-radius: 5px; background: transparent;
  color: var(--text-secondary); font-size: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.mode-toggle-btn:hover { background: var(--primary-bg); color: var(--text); }
.mode-toggle-btn.active { background: linear-gradient(135deg, var(--primary-bg), var(--accent-bg)); color: var(--primary-light); font-weight: 600; }
.doc-btn:hover { background: var(--primary-bg); color: var(--primary); }

.mode-divider { width: 1px; height: 18px; background: var(--border); margin: 0 2px; }

/* 技能下拉选择器 */
.skill-select-wrapper {
  position: relative;
}
.skill-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 5px 28px 5px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: all 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='%239E9E9E' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 10px 6px;
  min-width: 100px;
}
.skill-select:focus { border-color: var(--accent); color: var(--accent); }
.skill-select option { color: var(--text); }
.skill-select optgroup { font-weight: 600; color: var(--text-secondary); font-style: normal; }

.url-input-inline {
  flex: 1; display: flex; align-items: center; gap: 6px;
  margin-left: 6px; padding-left: 10px; border-left: 1px solid var(--border);
}
.url-icon { color: var(--text-light); flex-shrink: 0; }
.url-input-inline-field { background: transparent; border: none; padding: 4px 0; font-size: 13px; color: var(--text); outline: none; width: 100%; }
.url-input-inline-field::placeholder { color: var(--text-light); }

@media (max-width: 768px) {
  .attachment-name { max-width: 140px; }
  .bottom-row { gap: 4px; }
  .mode-toggle-btn { padding: 4px 8px; font-size: 11px; }
  .skill-select { min-width: 80px; font-size: 11px; }
}
</style>