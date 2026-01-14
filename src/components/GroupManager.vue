<template>
  <div class="card group-manager">
    <div class="panel-header">
      <h3 class="panel-title">📋 群組管理</h3>
      <button class="btn-add" @click="showAddForm = true">
        <span class="icon">+</span> 新增群組
      </button>
    </div>

    <!-- 新增/編輯群組表單 -->
    <div v-if="showAddForm" class="form-overlay">
      <div class="form-card">
        <h4>{{ editingGroup ? '編輯群組' : '新增群組' }}</h4>
        <div class="form-group">
          <label>群組名稱</label>
          <input v-model="groupForm.name" placeholder="例：長線投資" class="input-md">
        </div>
        <div class="form-group">
          <label>描述（選填）</label>
          <textarea v-model="groupForm.description" placeholder="該群組的介紹..." class="textarea-md"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>顏色</label>
            <input v-model="groupForm.color" type="color" class="input-color">
          </div>
          <div class="form-group">
            <label>圖示</label>
            <select v-model="groupForm.icon" class="input-md">
              <option value="📁">📁 資料夾</option>
              <option value="🌱">🌱 成長</option>
              <option value="⚡">⚡ 快速</option>
              <option value="🎯">🎯 核心</option>
              <option value="🚀">🚀 火箭</option>
              <option value="💰">💰 現金</option>
              <option value="📈">📈 上漲</option>
              <option value="🔥">🔥 熱門</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-cancel" @click="cancelForm">取消</button>
          <button class="btn btn-submit" @click="saveGroup">
            {{ editingGroup ? '更新' : '建立' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 群組列表 -->
    <div class="groups-list">
      <div v-if="groups.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>尚無群組，點擊上方按鈕建立第一個群組！</p>
      </div>
      
      <div v-for="group in groups" :key="group.id" class="group-item" :style="{ borderLeftColor: group.color }">
        <div class="group-info">
          <div class="group-icon">{{ group.icon }}</div>
          <div class="group-details">
            <div class="group-name">{{ group.name }}</div>
            <div class="group-desc">{{ group.description || '無描述' }}</div>
            <div class="group-stats">
              <span class="stat-badge">📄 {{ getRecordCount(group.id) }} 筆交易</span>
            </div>
          </div>
        </div>
        <div class="group-actions">
          <button class="btn-icon" @click="editGroup(group)" title="編輯">✏️</button>
          <button class="btn-icon btn-danger" @click="deleteGroup(group.id)" title="刪除">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const { addToast } = useToast();

const showAddForm = ref(false);
const editingGroup = ref(null);
const groupForm = ref({
  name: '',
  description: '',
  color: '#3B82F6',
  icon: '📁'
});

const groups = computed(() => store.groups || []);

// 取得群組包含的交易數量
const getRecordCount = (groupId) => {
  return store.recordGroups.filter(rg => rg.group_id === groupId).length;
};

const saveGroup = async () => {
  if (!groupForm.value.name.trim()) {
    addToast('請填寫群組名稱', 'error');
    return;
  }

  try {
    if (editingGroup.value) {
      await store.updateGroup(editingGroup.value.id, groupForm.value);
      addToast('群組已更新', 'success');
    } else {
      await store.createGroup(groupForm.value);
      addToast('群組已建立', 'success');
    }
    cancelForm();
  } catch (e) {
    addToast('操作失敗: ' + e.message, 'error');
  }
};

const editGroup = (group) => {
  editingGroup.value = group;
  groupForm.value = { ...group };
  showAddForm.value = true;
};

const deleteGroup = async (groupId) => {
  if (!confirm('確定要刪除此群組？這不會刪除交易記錄。')) return;
  
  try {
    await store.deleteGroup(groupId);
    addToast('群組已刪除', 'success');
  } catch (e) {
    addToast('刪除失敗: ' + e.message, 'error');
  }
};

const cancelForm = () => {
  showAddForm.value = false;
  editingGroup.value = null;
  groupForm.value = {
    name: '',
    description: '',
    color: '#3B82F6',
    icon: '📁'
  };
};
</script>

<style scoped>
.group-manager {
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  background: var(--bg-card);
  padding: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-title {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-main);
  font-weight: 700;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.icon {
  font-size: 1.2rem;
}

/* 表單遮罩 */
.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.form-card {
  background: var(--bg-card);
  padding: 32px;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-card);
}

.form-card h4 {
  margin: 0 0 24px 0;
  font-size: 1.3rem;
  color: var(--text-main);
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--text-sub);
  font-weight: 600;
}

.input-md, .textarea-md, .input-color {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg-card);
  color: var(--text-main);
  box-sizing: border-box;
  transition: all 0.2s;
}

.input-md:focus, .textarea-md:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.textarea-md {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.input-color {
  height: 48px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-sub);
}

.btn-cancel:hover {
  background: var(--border-color);
}

.btn-submit {
  background: var(--primary);
  color: white;
}

.btn-submit:hover {
  opacity: 0.9;
}

/* 群組列表 */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-secondary);
  border-left: 4px solid;
  border-radius: 8px;
  transition: all 0.2s;
}

.group-item:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-sm);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.group-icon {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 8px;
}

.group-details {
  flex: 1;
}

.group-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 4px;
}

.group-desc {
  font-size: 0.9rem;
  color: var(--text-sub);
  margin-bottom: 8px;
}

.group-stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  display: inline-block;
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: 12px;
  font-size: 0.85rem;
  color: var(--text-sub);
}

.group-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.1rem;
}

.btn-icon:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-icon.btn-danger:hover {
  background: #ef4444;
  border-color: #ef4444;
}

/* 深色模式 */
:global(.dark) .group-manager {
  background-color: #1e293b;
  border-color: #334155;
}

:global(.dark) .form-card {
  background-color: #1e293b;
}

:global(.dark) .group-item {
  background-color: #334155;
}
</style>
