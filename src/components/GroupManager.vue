<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-header">
            <h2>📁 管理群組</h2>
            <button class="close-btn" @click="close" title="關閉">✕</button>
          </div>
          
          <div class="modal-body">
            <!-- 群組列表 -->
            <div class="group-list">
              <TransitionGroup name="list" tag="div">
                <div 
                  v-for="(group, index) in editableGroups" 
                  :key="group.id"
                  class="group-row"
                  :class="{ system: group.isSystem }"
                >
                  <span class="drag-handle" v-if="!group.isSystem">☰</span>
                  <span class="system-badge" v-else>🔒</span>
                  
                  <input 
                    v-model="group.icon" 
                    class="icon-input" 
                    placeholder="📁"
                    maxlength="2"
                    :disabled="group.isSystem"
                  >
                  
                  <input 
                    v-model="group.name" 
                    class="name-input" 
                    placeholder="群組名稱"
                    :disabled="group.isSystem"
                  >
                  
                  <input 
                    v-model="group.color" 
                    type="color" 
                    class="color-input"
                    :disabled="group.isSystem"
                  >
                  
                  <!-- TAG 標籤編輯 -->
                  <div class="tags-input-wrapper">
                    <input 
                      v-model="group.tagsInput" 
                      class="tags-input" 
                      placeholder="標籤 (逗號分隔)"
                      :disabled="group.isSystem"
                      @blur="updateGroupTags(group)"
                    >
                  </div>
                  
                  <button 
                    v-if="!group.isSystem"
                    class="delete-btn" 
                    @click="confirmDelete(group)"
                    title="刪除群組"
                  >
                    🗑️
                  </button>
                </div>
              </TransitionGroup>
            </div>
            
            <!-- 新增群組按鈕 -->
            <button class="add-group-btn" @click="addNewGroup">
              ➕ 新增群組
            </button>
            
            <!-- 說明區塊 -->
            <div class="info-box">
              <p>💡 <strong>使用說明：</strong></p>
              <ul>
                <li>🔒 系統群組「全部紀錄」不可修改與刪除</li>
                <li>🏷️ 標籤用於匹配交易紀錄的 TAG 欄位，支援中英文</li>
                <li>☰ 可拖拽排序自訂群組</li>
                <li>🎨 點擊顏色按鈕可自訂群組識別色</li>
              </ul>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-cancel" @click="close">取消</button>
            <button class="btn btn-primary" @click="save">儲存變更</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close']);

const portfolioStore = usePortfolioStore();
const { addToast } = useToast();
const editableGroups = ref([]);

// 監聽 modal 開啟，複製群組資料
watch(() => props.show, (newVal) => {
  if (newVal) {
    // 深度複製群組資料
    editableGroups.value = portfolioStore.groups.map(g => ({
      ...g,
      tags: [...g.tags],
      tagsInput: g.tags.join(', ')  // 轉換為字串以便編輯
    }));
  }
});

// 過濾掉系統群組，只顯示可編輯的
const editableGroupsWithoutAll = computed(() => 
  editableGroups.value.filter(g => g.id !== 'all')
);

const addNewGroup = () => {
  const newGroup = {
    id: `temp-${Date.now()}`,
    name: '新群組',
    icon: '📁',
    color: '#3b82f6',
    tags: [],
    tagsInput: '',
    sortOrder: editableGroups.value.length,
    isSystem: false,
    isNew: true
  };
  editableGroups.value.push(newGroup);
  addToast('➕ 已新增群組，請記得儲存', 'info');
};

const confirmDelete = (group) => {
  if (confirm(`確定要刪除群組「${group.name}」嗎？`)) {
    editableGroups.value = editableGroups.value.filter(g => g.id !== group.id);
    addToast(`🗑️ 已刪除群組「${group.name}」`, 'success');
  }
};

const updateGroupTags = (group) => {
  // 將輸入的字串轉換為陣列
  if (group.tagsInput) {
    group.tags = group.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  } else {
    group.tags = [];
  }
};

const save = () => {
  try {
    // 更新所有 tags
    editableGroups.value.forEach(g => updateGroupTags(g));
    
    // 清空現有群組（保留系統群組）
    const systemGroup = portfolioStore.groupManager.groups.find(g => g.isSystem);
    portfolioStore.groupManager.groups = [systemGroup];
    
    // 新增/更新群組
    editableGroups.value.forEach(group => {
      if (group.isSystem) return;  // 跳過系統群組
      
      if (group.isNew) {
        // 新增
        portfolioStore.addGroup(
          group.name,
          group.icon,
          group.color,
          group.tags,
          group.description || ''
        );
      } else {
        // 更新現有
        portfolioStore.groupManager.groups.push({
          ...group,
          tags: [...group.tags]  // 確保 tags 是陣列
        });
      }
    });
    
    // 儲存到 localStorage
    portfolioStore.groupManager.saveGroups();
    
    addToast('✅ 群組設定已儲存', 'success');
    close();
  } catch (error) {
    console.error('儲存群組失敗:', error);
    addToast('❌ 儲存失敗，請再試一次', 'error');
  }
};

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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  cursor: pointer;
  color: var(--text-sub);
  padding: 4px 8px;
  border-radius: 4px;
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
  padding: 14px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.group-row:hover {
  border-color: var(--primary);
  transform: translateX(4px);
}

.group-row.system {
  background: linear-gradient(135deg, var(--bg-secondary), var(--border-color));
  opacity: 0.8;
}

.drag-handle {
  cursor: grab;
  font-size: 1.3rem;
  color: var(--text-sub);
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.system-badge {
  font-size: 1.2rem;
}

.icon-input {
  width: 50px;
  text-align: center;
  font-size: 1.3rem;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  transition: all 0.2s;
}

.icon-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.name-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  background: var(--bg-card);
  color: var(--text-main);
  transition: all 0.2s;
}

.name-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.color-input {
  width: 50px;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.color-input:hover {
  transform: scale(1.1);
}

.tags-input-wrapper {
  flex: 1.5;
}

.tags-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--bg-card);
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s;
}

.tags-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 6px;
  opacity: 0.6;
  transition: all 0.2s;
}

.delete-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.1);
  transform: scale(1.1);
}

.add-group-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.add-group-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.info-box {
  margin-top: 24px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
  border-radius: 12px;
  border-left: 4px solid var(--primary);
}

.info-box p {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--text-main);
}

.info-box ul {
  margin: 0;
  padding-left: 24px;
  color: var(--text-sub);
  font-size: 0.9rem;
  line-height: 1.8;
}

.info-box li {
  margin-bottom: 6px;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
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
  background: linear-gradient(135deg, var(--success), #059669);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* 動畫 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from .modal-content {
  transform: scale(0.9) translateY(-20px);
}

.modal-fade-leave-to .modal-content {
  transform: scale(0.9) translateY(20px);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 響應式 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }
  
  .group-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .tags-input-wrapper {
    flex-basis: 100%;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}

/* 深色模式優化 */
:global(.dark) .modal-content {
  background-color: #1e293b !important;
  border-color: #334155 !important;
}

:global(.dark) .icon-input,
:global(.dark) .name-input,
:global(.dark) .tags-input {
  background-color: #0f172a !important;
  color: #f1f5f9 !important;
  border-color: #334155 !important;
}

:global(.dark) input:disabled {
  opacity: 0.5;
}
</style>
