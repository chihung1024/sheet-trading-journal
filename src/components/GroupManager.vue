<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <div class="modal-header">
            <h2>📁 管理群組</h2>
            <button class="close-btn" @click="close">×</button>
          </div>
          
          <div class="modal-body">
            <div class="help-text">
              <p>💡 提示：群組配置儲存於瀏覽器本地，不會上傳至伺服器。</p>
            </div>
            
            <!-- 群組列表 -->
            <div class="group-list">
              <div v-for="group in editableGroups" :key="group.id" class="group-item">
                <div class="group-handle">☰</div>
                
                <div class="group-icon-input">
                  <input 
                    v-model="group.icon" 
                    class="icon-field" 
                    placeholder="📁"
                    maxlength="2"
                  >
                </div>
                
                <input 
                  v-model="group.name" 
                  class="name-field" 
                  placeholder="群組名稱"
                  :disabled="group.isSystem"
                >
                
                <input 
                  v-model="group.color" 
                  type="color" 
                  class="color-field"
                  :disabled="group.isSystem"
                >
                
                <div class="tags-field">
                  <input 
                    :value="group.tags.join(', ')" 
                    @input="updateTags(group, $event.target.value)"
                    placeholder="tags (逗號分隔)"
                    :disabled="group.isSystem"
                  >
                </div>
                
                <button 
                  v-if="!group.isSystem" 
                  class="delete-btn" 
                  @click="deleteGroup(group.id)"
                  title="刪除群組"
                >
                  🗑️
                </button>
                <div v-else class="system-badge">系統</div>
              </div>
            </div>
            
            <!-- 新增群組按鈕 -->
            <button class="add-group-btn" @click="addNewGroup">
              ➕ 新增自訂群組
            </button>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="resetToDefault">
              🔄 重置預設
            </button>
            <div class="spacer"></div>
            <button class="btn btn-cancel" @click="close">取消</button>
            <button class="btn btn-primary" @click="save">💾 儲存變更</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'saved']);

const portfolioStore = usePortfolioStore();
const localGroups = ref([]);

// 當 Modal 打開時，複製群組配置
watch(() => props.show, (newVal) => {
  if (newVal) {
    localGroups.value = JSON.parse(
      JSON.stringify(portfolioStore.groupManager.getAllGroups())
    );
  }
});

// 只顯示可編輯的群組（排除「全部」）
const editableGroups = computed(() => 
  localGroups.value.filter(g => g.id === 'all' || !g.isSystem || g.id !== 'all')
);

/**
 * 新增群組
 */
const addNewGroup = () => {
  const newGroup = {
    id: `custom-${Date.now()}`,
    name: '新群組',
    icon: '📁',
    color: '#3b82f6',
    description: '',
    tags: [],
    sortOrder: localGroups.value.length,
    isSystem: false,
  };
  localGroups.value.push(newGroup);
};

/**
 * 刪除群組
 */
const deleteGroup = (groupId) => {
  if (confirm('確定要刪除這個群組嗎？')) {
    localGroups.value = localGroups.value.filter(g => g.id !== groupId);
  }
};

/**
 * 更新 tags
 */
const updateTags = (group, value) => {
  group.tags = value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
};

/**
 * 重置為預設
 */
const resetToDefault = () => {
  if (confirm('確定要重置為預設群組配置嗎？所有自訂群組將被刪除。')) {
    portfolioStore.groupManager.resetToDefault();
    emit('saved');
    emit('close');
  }
};

/**
 * 儲存變更
 */
const save = () => {
  // 更新排序
  localGroups.value.forEach((group, index) => {
    group.sortOrder = index;
  });
  
  // 儲存至 GroupManager
  portfolioStore.groupManager.groups = localGroups.value;
  portfolioStore.groupManager.saveGroups();
  
  emit('saved');
  emit('close');
};

/**
 * 關閉 Modal
 */
const close = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
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
  font-size: 2rem;
  color: var(--text-sub);
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.modal-body {
  padding: 24px 32px;
  overflow-y: auto;
  flex: 1;
}

.help-text {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border-left: 3px solid var(--primary);
}

.help-text p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-sub);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.group-item {
  display: grid;
  grid-template-columns: 30px 60px 1fr 60px 2fr 60px;
  gap: 12px;
  align-items: center;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 2px solid var(--border-color);
  transition: all 0.2s;
}

.group-item:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.group-handle {
  font-size: 1.2rem;
  color: var(--text-sub);
  cursor: grab;
  text-align: center;
}

.group-handle:active {
  cursor: grabbing;
}

.group-icon-input {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-field {
  width: 50px;
  text-align: center;
  font-size: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-card);
}

.name-field {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  background: var(--bg-card);
  color: var(--text-main);
}

.color-field {
  width: 50px;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-card);
}

.tags-field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-card);
  color: var(--text-main);
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
  font-size: 1.3rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  color: var(--text-sub);
}

.delete-btn:hover {
  background: var(--danger);
  color: white;
  transform: scale(1.1);
}

.system-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  background: var(--bg-card);
  color: var(--text-sub);
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  border: 1px solid var(--border-color);
}

.add-group-btn {
  width: 100%;
  padding: 14px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-group-btn:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 32px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.spacer {
  flex: 1;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.btn-cancel {
  background: transparent;
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--bg-card);
  color: var(--text-main);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

/* Modal 動畫 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.9);
}

/* 響應式 */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px 20px;
  }
  
  .group-item {
    grid-template-columns: 30px 50px 1fr 50px;
    gap: 8px;
  }
  
  .tags-field,
  .delete-btn,
  .system-badge {
    grid-column: 2 / -1;
  }
}
</style>
