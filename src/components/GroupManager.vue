<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>📁 管理群組</h2>
        <button class="close-btn" @click="close">✕</button>
      </div>
      
      <div class="modal-body">
        <p class="modal-description">
          自訂群組配置，系統會根據 TAG 欄位自動匹配交易紀錄。
        </p>
        
        <!-- 群組列表 -->
        <div class="group-list">
          <div v-for="(group, index) in localGroups" :key="group.id" class="group-row">
            <!-- 系統群組顯示鎖定狀態 -->
            <span v-if="group.isSystem" class="drag-handle disabled">🔒</span>
            <span v-else class="drag-handle">☰</span>
            
            <input 
              v-model="group.icon" 
              class="icon-input" 
              placeholder="📁"
              maxlength="2"
              :disabled="group.isSystem && group.id === 'all'"
            >
            <input 
              v-model="group.name" 
              class="name-input" 
              placeholder="群組名稱"
              :disabled="group.isSystem && group.id === 'all'"
            >
            <input 
              v-model="group.color" 
              type="color" 
              class="color-input"
            >
            
            <!-- 標籤編輯 -->
            <input 
              v-model="group.tagsInput" 
              class="tags-input" 
              placeholder="標籤 (逗號分隔)"
              :disabled="group.isSystem && group.id === 'all'"
              @blur="updateGroupTags(group)"
            >
            
            <button 
              v-if="!group.isSystem" 
              class="delete-btn" 
              @click="deleteGroup(index)"
              title="刪除群組"
            >
              🗑️
            </button>
            <span v-else class="system-badge">系統</span>
          </div>
        </div>
        
        <!-- 新增群組按鈕 -->
        <button class="add-group-btn" @click="addNewGroup">
          ➕ 新增群組
        </button>
        
        <!-- 快速操作 -->
        <div class="quick-actions">
          <button class="btn-secondary" @click="exportGroups">
            📥 匯出配置
          </button>
          <button class="btn-secondary" @click="importGroups">
            📤 匯入配置
          </button>
          <button class="btn-secondary" @click="resetToDefaults">
            🔄 重置預設
          </button>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-cancel" @click="close">取消</button>
        <button class="btn btn-primary" @click="save">儲存變更</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const emit = defineEmits(['close']);
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const localGroups = ref([]);

onMounted(() => {
  // 複製群組配置到本地編輯
  localGroups.value = JSON.parse(JSON.stringify(portfolioStore.groups)).map(g => ({
    ...g,
    tagsInput: g.tags.join(', ')  // 轉換為字串以便編輯
  }));
});

const updateGroupTags = (group) => {
  // 將輸入的標籤字串轉換為陣列
  if (group.tagsInput) {
    group.tags = group.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  } else {
    group.tags = [];
  }
};

const addNewGroup = () => {
  localGroups.value.push({
    id: `custom-${Date.now()}`,
    name: '新群組',
    icon: '📁',
    color: '#3b82f6',
    description: '',
    tags: [],
    tagsInput: '',
    sortOrder: localGroups.value.length,
    isSystem: false,
    isNew: true
  });
};

const deleteGroup = (index) => {
  if (confirm('確定要刪除此群組嗎？')) {
    localGroups.value.splice(index, 1);
  }
};

const save = () => {
  // 更新排序
  localGroups.value.forEach((g, index) => {
    g.sortOrder = index;
    updateGroupTags(g);  // 確保標籤已更新
  });
  
  // 儲存到 GroupManager
  portfolioStore.groupManager.groups = localGroups.value.map(g => {
    const { tagsInput, isNew, ...rest } = g;
    return rest;
  });
  portfolioStore.groupManager.saveGroups();
  
  // 重新計算當前群組快照
  if (portfolioStore.currentGroupId !== 'all') {
    portfolioStore.calculateGroupSnapshot(portfolioStore.currentGroupId);
  }
  
  addToast('✅ 群組配置已儲存', 'success');
  close();
};

const close = () => {
  emit('close');
};

const exportGroups = () => {
  const json = portfolioStore.groupManager.exportToJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-groups-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addToast('✅ 配置已匯出', 'success');
};

const importGroups = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const success = portfolioStore.groupManager.importFromJSON(text);
    
    if (success) {
      // 重新載入
      localGroups.value = JSON.parse(JSON.stringify(portfolioStore.groups)).map(g => ({
        ...g,
        tagsInput: g.tags.join(', ')
      }));
      addToast('✅ 配置已匯入', 'success');
    } else {
      addToast('❌ 配置匯入失敗', 'error');
    }
  };
  input.click();
};

const resetToDefaults = () => {
  if (confirm('確定要重置為預設群組嗎？這會刪除所有自訂群組！')) {
    portfolioStore.groupManager.resetToDefaults();
    localGroups.value = JSON.parse(JSON.stringify(portfolioStore.groups)).map(g => ({
      ...g,
      tagsInput: g.tags.join(', ')
    }));
    addToast('✅ 已重置為預設配置', 'success');
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-sub);
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-description {
  margin: 0 0 20px 0;
  color: var(--text-sub);
  font-size: 0.95rem;
  line-height: 1.6;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.group-row:hover {
  box-shadow: var(--shadow-sm);
}

.drag-handle {
  cursor: grab;
  font-size: 1.2rem;
  color: var(--text-sub);
  user-select: none;
}

.drag-handle.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.drag-handle:active {
  cursor: grabbing;
}

.icon-input {
  width: 50px;
  text-align: center;
  font-size: 1.3rem;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-main);
}

.name-input {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-card);
  color: var(--text-main);
}

.color-input {
  width: 50px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
  background: var(--bg-card);
}

.tags-input {
  flex: 2;
  min-width: 150px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
  background: var(--bg-card);
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-secondary);
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.6;
  transition: opacity 0.2s;
  padding: 4px 8px;
}

.delete-btn:hover {
  opacity: 1;
}

.system-badge {
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.add-group-btn {
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  color: var(--text-sub);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.add-group-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.quick-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.btn-secondary {
  flex: 1;
  min-width: 140px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn-secondary:hover {
  background: var(--border-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }
  
  .group-row {
    flex-wrap: wrap;
  }
  
  .tags-input {
    width: 100%;
    flex: none;
  }
  
  .quick-actions {
    flex-direction: column;
  }
  
  .btn-secondary {
    min-width: 100%;
  }
}
</style>
