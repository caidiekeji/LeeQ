<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>🛠️ 我的技能</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- 技能列表 -->
        <div v-if="userSkills.length > 0" class="skill-list">
          <div v-for="(s, idx) in userSkills" :key="s.id" class="skill-item">
            <div class="skill-info">
              <span class="skill-name">{{ s.skillName }}</span>
              <span class="skill-preview">{{ (s.promptTemplate || '').substring(0, 50) }}...</span>
            </div>
            <div class="skill-actions">
              <button class="action-edit" @click="openEdit(idx)">编辑</button>
              <button class="action-del" @click="deleteSkill(idx)">删除</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">还没有自定义技能，创建一个吧</div>

        <!-- 创建/编辑表单 -->
        <div class="form-section">
          <h4>{{ editingIdx >= 0 ? '编辑技能' : '新建技能' }}</h4>
          <input v-model="form.skillName" placeholder="技能名称，如：会议纪要整理" class="form-input" />
          <textarea v-model="form.promptTemplate"
            placeholder="Prompt模板，用 {inputText} 表示用户输入位置&#10;示例：请将以下内容整理为结构化纪要：&#10;&#10;{inputText}"
            class="form-textarea" rows="4"></textarea>
          <div class="form-actions">
            <button v-if="editingIdx >= 0" class="btn-cancel" @click="cancelEdit">取消</button>
            <button class="btn-save" @click="saveSkill">{{ editingIdx >= 0 ? '保存修改' : '创建技能' }}</button>
          </div>
        </div>

        <!-- 帮助示例 -->
        <div class="help-section">
          <button class="help-toggle" @click="showHelp = !showHelp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            创建示例
            <span class="toggle-arrow">{{ showHelp ? '▲' : '▼' }}</span>
          </button>

          <div class="help-content" v-if="showHelp">
            <div class="example-card">
              <div class="example-label">名称</div>
              <div class="example-value">会议纪要整理</div>
              <div class="example-label">Prompt 模板</div>
              <pre class="prompt-example">请将以下会议内容整理为结构化纪要，包含：
- 讨论议题
- 达成结论
- 待办事项（含负责人和截止时间）

{inputText}</pre>
              <div class="example-note">💡 {inputText} 会自动替换为用户在文本框中输入的内容，然后一起发送给大模型处理。</div>
              <div class="example-more">
                <strong>更多示例：</strong><br/>
                • 名称：<code>代码审查</code> → Prompt：请对以下代码进行审查，指出潜在问题和优化建议：\n\n{inputText}<br/>
                • 名称：<code>周报生成</code> → Prompt：根据以下工作内容生成周报：\n\n{inputText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../../utils/api';

defineEmits<{ close: []; created: [] }>();

interface Skill {
  id: string;
  skillName: string;
  promptTemplate: string;
}

const userSkills = ref<Skill[]>([]);
const editingIdx = ref(-1);
const form = ref({ skillName: '', promptTemplate: '' });
const showHelp = ref(false);
const isLoggedIn = !!localStorage.getItem('userToken');

function load() {
  if (isLoggedIn) {
    api.getUserSkills().then(res => {
      if (res.code === 0) {
        userSkills.value = res.data.map((s: any) => ({ id: String(s.id), skillName: s.skillName, promptTemplate: s.promptTemplate }));
      }
    }).catch(() => { userSkills.value = []; });
  } else {
    try {
      const raw = localStorage.getItem('userSkills');
      if (raw) userSkills.value = JSON.parse(raw);
      else userSkills.value = [];
    } catch { userSkills.value = []; }
  }
}

async function save() {
  if (isLoggedIn) return;
  localStorage.setItem('userSkills', JSON.stringify(userSkills.value));
}

async function saveSkill() {
  if (!form.value.skillName.trim() || !form.value.promptTemplate.trim()) return;

  if (editingIdx.value >= 0) {
    const skill = userSkills.value[editingIdx.value];
    if (isLoggedIn) {
      await api.updateUserSkill(Number(skill.id), { skillName: form.value.skillName, promptTemplate: form.value.promptTemplate });
    }
    userSkills.value[editingIdx.value].skillName = form.value.skillName;
    userSkills.value[editingIdx.value].promptTemplate = form.value.promptTemplate;
  } else {
    if (isLoggedIn) {
      const res = await api.createUserSkill({ skillName: form.value.skillName, promptTemplate: form.value.promptTemplate });
      if (res.code === 0) {
        userSkills.value.push({ id: String(res.data.id), skillName: res.data.skillName, promptTemplate: res.data.promptTemplate });
      }
    } else {
      userSkills.value.push({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        skillName: form.value.skillName,
        promptTemplate: form.value.promptTemplate
      });
    }
  }

  await save();
  cancelEdit();
  load();
}

async function deleteSkill(idx: number) {
  if (!confirm('确定删除该技能？')) return;
  const skill = userSkills.value[idx];
  if (isLoggedIn && skill) {
    await api.deleteUserSkill(Number(skill.id));
  }
  userSkills.value.splice(idx, 1);
  await save();
}

function openCreate() {
  editingIdx.value = -1;
  form.value = { skillName: '', promptTemplate: '' };
}

function openEdit(idx: number) {
  editingIdx.value = idx;
  const s = userSkills.value[idx];
  form.value = { skillName: s.skillName, promptTemplate: s.promptTemplate };
}

function cancelEdit() {
  editingIdx.value = -1;
  form.value = { skillName: '', promptTemplate: '' };
}

onMounted(() => { load(); openCreate(); });
</script>

<style scoped>
.modal {
  width: 520px; max-height: 80vh; display: flex; flex-direction: column;
}
.modal-body { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

.skill-list { display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; }
.skill-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--bg-input); border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.skill-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.skill-item .skill-name { font-size: 14px; font-weight: 500; color: var(--text); }
.skill-preview { font-size: 12px; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skill-actions { display: flex; gap: 6px; flex-shrink: 0; }
.action-edit, .action-del {
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px;
  background: transparent; font-size: 12px; cursor: pointer; color: var(--text-secondary);
}
.action-edit:hover { border-color: var(--primary); color: var(--primary); }
.action-del:hover { border-color: var(--danger); color: var(--danger); }
.empty-tip { text-align: center; color: var(--text-secondary); font-size: 13px; padding: 16px 0; }

.form-section {
  background: var(--bg-input); border-radius: var(--radius); padding: 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.form-section h4 { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
.form-input, .form-textarea {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text);
  font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box;
}
.form-input:focus, .form-textarea:focus { border-color: #8B5CF6; }
.form-textarea { resize: vertical; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-cancel {
  padding: 7px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary); font-size: 13px; cursor: pointer;
}
.btn-save {
  padding: 7px 20px; border: none; border-radius: var(--radius-sm);
  background: #8B5CF6; color: #fff; font-size: 13px; font-weight: 500; cursor: pointer;
}
.btn-save:hover { background: #7C3AED; }

.help-section { border-top: 1px solid var(--border); padding-top: 16px; }
.help-toggle {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 8px 12px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary); font-size: 13px;
  cursor: pointer; transition: all 0.15s; justify-content: center;
}
.help-toggle:hover { background: rgba(139,92,246,0.08); color: #8B5CF6; }
.toggle-arrow { margin-left: auto; font-size: 10px; transition: transform 0.2s; }
.help-content { animation: slideDown 0.2s ease; }
@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 400px; } }
.example-card {
  background: var(--bg-input); border-radius: var(--radius-sm);
  padding: 14px; display: flex; flex-direction: column; gap: 8px;
}
.example-label { font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; }
.example-value { font-size: 14px; font-weight: 500; color: #8B5CF6; }
.prompt-example {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 12px; font-family: 'Courier New', monospace;
  font-size: 11.5px; line-height: 1.7; color: var(--text); white-space: pre-wrap;
  word-break: break-word; margin: 4px 0;
}
.example-note {
  padding: 10px 12px; background: rgba(139,92,246,0.08); border-radius: var(--radius-sm);
  color: #8B5CF6; font-size: 12px; line-height: 1.5;
}
.example-more {
  padding: 10px 12px; background: var(--bg-card); border-radius: var(--radius-sm);
  font-size: 12px; color: var(--text-secondary); line-height: 1.7;
}
.example-more code {
  background: rgba(139,92,246,0.1); color: #8B5CF6; padding: 1px 5px;
  border-radius: 3px; font-family: 'Courier New', monospace; font-size: 11px;
}

@media (max-width: 768px) {
  .modal { width: 90%; }
  .modal-body { padding: 16px; }
}
</style>