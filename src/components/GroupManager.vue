<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <div class="modal-header">
            <h2>📁 群組管理</h2>
            <button class="btn-close" @click="close">×</button>
          </div>
          
          <div class="modal-body">
            <!-- 群組列表 -->
            <div class="groups-section">
              <div class="section-header">
                <h3>群組列表</h3>
                <button class="btn-primary btn-sm" @click="startNewGroup">
                  + 新增群組
                </button>
              </div>
              
              <div class="groups-list" v-if="groups.length > 0">
                <div 
                  v-for="group in groups" 
                  :key="group.id"
                  class="group-item"
                  :class="{ editing: editingGroupId === group.id }"
                >
                  <div class="group-info">
                    <span class="group-icon">{{ group.icon }}</span>
                    <div class="group-details">
                      <div class="group-name">{{ group.name }}</div>
                      <div class="group-tags">
                        {{ group.tags.length }} 個標籤
                      </div>
                    </div>
                    <div 
                      class="group-color-badge" 
                      :style="{ backgroundColor: group.color }"
                    ></div>
                  </div>
                  
                  <div class="group-actions">
                    <button 
                      class="btn-icon" 
                      @click="startEditGroup(group)"
                      title="編輯"
                    >
                      ✏️
                    </button>
                    <button 
                      class="btn-icon btn-danger" 
                      @click="confirmDeleteGroup(group.id)"
                      title="刪除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-else class="empty-state">
                <div class="empty-icon">📂</div>
                <p>尚無自訂群組，點擊「新增群組」開始建立</p>
              </div>
            </div>
            
            <!-- 編輯表單 -->
            <Transition name="slide-left">
              <div v-if="editingGroupId || isCreating" class="edit-section">
                <div class="section-header">
                  <h3>{{ isCreating ? '新增群組' : '編輯群組' }}</h3>
                  <button class="btn-text" @click="cancelEdit">取消</button>
                </div>
                
                <form @submit.prevent="saveGroup" class="group-form">
                  <!-- 基本資訊 -->
                  <div class="form-row">
                    <div class="form-group">
                      <label>群組名稱 *</label>
                      <input 
                        v-model="formData.name" 
                        type="text" 
                        placeholder="例：美股核心持股"
                        required
                        maxlength="20"
                      >
                    </div>
                  </div>
                  
                  <div class="form-row form-row-2">
                    <div class="form-group">
                      <label>圖標 Emoji</label>
                      <div class="emoji-selector">
                        <input 
                          v-model="formData.icon" 
                          type="text" 
                          placeholder="📊"
                          maxlength="2"
                        >
                        <div class="emoji-suggestions">
                          <button 
                            v-for="emoji in emojiOptions" 
                            :key="emoji"
                            type="button"
                            class="emoji-btn"
                            @click="formData.icon = emoji"
                          >
                            {{ emoji }}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div class="form-group">
                      <label>主顏色</label>
                      <div class="color-picker">
                        <input 
                          v-model="formData.color" 
                          type="color"
                        >
                        <span class="color-preview" :style="{ backgroundColor: formData.color }"></span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="form-group">
                    <label>描述 (選填)</label>
                    <textarea 
                      v-model="formData.description" 
                      placeholder="簡短描述這個群組的用途..."
                      rows="2"
                      maxlength="100"
                    ></textarea>
                  </div>
                  
                  <!-- 標籤選擇 -->
                  <div class="form-group">
                    <label>選擇標籤 *</label>
                    <p class="help-text">勾選要納入此群組的標籤，至少選擇 1 個</p>
                    
                    <div class="tags-grid">
                      <label 
                        v-for="tag in availableTags" 
                        :key="tag"
                        class="tag-checkbox"
                      >
                        <input 
                          type="checkbox" 
                          :value="tag"
                          v-model="formData.tags"
                        >
                        <span class="tag-label">{{ tag }}</span>
                      </label>
                    </div>
                    
                    <div class="selected-tags" v-if="formData.tags.length > 0">
                      <span class="tag-badge" v-for="tag in formData.tags" :key="tag">
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                  
                  <div class="form-actions">
                    <button type="button" class="btn-secondary" @click="cancelEdit">
                      取消
                    </button>
                    <button 
                      type="submit" 
                      class="btn-primary"
                      :disabled="!isFormValid"
                    >
                      {{ isCreating ? '創建群組' : '儲存更改' }}
                    </button>
                  </div>
                </form>
              </div>
            </Transition>
          </div>
          
          <div class="modal-footer">
            <p class="footer-note">
              💡 群組配置僅儲存於本機，不會修改 D1 資料庫
            </p>
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
  show: Boolean
});

const emit = defineEmits(['close']);

const store = usePortfolioStore();

const groups = computed(() => store.groups);
const availableTags = computed(() => {
  // 從 records 中提取所有 tag
  const tags = new Set();
  store.records.forEach(record => {
    if (record.tag) tags.add(record.tag);
  });
  return Array.from(tags).sort();
});

const editingGroupId = ref(null);
const isCreating = ref(false);

const formData = ref({
  name: '',
  icon: '📊',
  color: '#3b82f6',
  description: '',
  tags: []
});

const emojiOptions = ['📊', '📈', '💰', '🌟', '🔥', '🚀', '🎯', '💎', '🌈', '🌺'];

const isFormValid = computed(() => {
  return formData.value.name.trim() !== '' && formData.value.tags.length > 0;
});

const startNewGroup = () => {
  isCreating.value = true;
  editingGroupId.value = null;
  formData.value = {
    name: '',
    icon: '📊',
    color: '#3b82f6',
    description: '',
    tags: []
  };
};

const startEditGroup = (group) => {
  isCreating.value = false;
  editingGroupId.value = group.id;
  formData.value = {
    name: group.name,
    icon: group.icon,
    color: group.color,
    description: group.description || '',
    tags: [...group.tags]
  };
};

const cancelEdit = () => {
  isCreating.value = false;
  editingGroupId.value = null;
  formData.value = {
    name: '',
    icon: '📊',
    color: '#3b82f6',
    description: '',
    tags: []
  };
};

const saveGroup = () => {
  if (!isFormValid.value) return;
  
  if (isCreating.value) {
    // 新增群組
    const result = store.addGroup(
      formData.value.name,
      formData.value.icon,
      formData.value.color,
      formData.value.tags,
      formData.value.description
    );
    
    if (result.success) {
      console.log('✅ 群組已創建:', result.group);
    }
  } else {
    // 編輯群組
    const result = store.updateGroup(editingGroupId.value, {
      name: formData.value.name,
      icon: formData.value.icon,
      color: formData.value.color,
      description: formData.value.description,
      tags: formData.value.tags
    });
    
    if (result.success) {
      console.log('✅ 群組已更新');
    }
  }
  
  cancelEdit();
};

const confirmDeleteGroup = (groupId) => {
  const group = store.groupManager.getGroup(groupId);
  if (!group) return;
  
  if (confirm(`確定要刪除群組「${group.name}」嗎？`)) {
    const result = store.deleteGroup(groupId);
    if (result.success) {
      console.log('✅ 群組已刪除');
      if (editingGroupId.value === groupId) {
        cancelEdit();
      }
    }
  }
};

const close = () => {
  cancelEdit();
  emit('close');
};

// 監聽 show prop，當關閉時重置狀態
watch(() => props.show, (newVal) => {
  if (!newVal) {
    cancelEdit();
  }
});
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
  z-index: 9999;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--bg-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  max-width: 900px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 24px 28px;
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

.btn-close {
  background: transparent;
  border: none;
  font-size: 2rem;
  color: var(--text-sub);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.modal-body {
  padding: 28px;
  overflow-y: auto;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}

.groups-section,
.edit-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 10px;
  transition: all 0.2s;
}

.group-item:hover {
  border-color: var(--primary);
  transform: translateX(2px);
}

.group-item.editing {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.group-icon {
  font-size: 1.5rem;
}

.group-details {
  flex: 1;
}

.group-name {
  font-weight: 600;
  color: var(--text-main);
  font-size: 1rem;
}

.group-tags {
  font-size: 0.85rem;
  color: var(--text-sub);
  margin-top: 2px;
}

.group-color-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
}

.group-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-card);
  transform: scale(1.05);
}

.btn-icon.btn-danger:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.group-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  gap: 16px;
}

.form-row-2 {
  grid-template-columns: 1fr 1fr;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
}

.form-group input[type="text"],
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg-secondary);
  color: var(--text-main);
  transition: all 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-card);
}

.emoji-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emoji-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.emoji-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.emoji-btn:hover {
  transform: scale(1.1);
  border-color: var(--primary);
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker input[type="color"] {
  width: 60px;
  height: 40px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
}

.help-text {
  font-size: 0.85rem;
  color: var(--text-sub);
  margin: 0;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.tag-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.2s;
}

.tag-checkbox:hover {
  background: var(--bg-card);
}

.tag-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.tag-label {
  font-size: 0.9rem;
  color: var(--text-main);
  font-weight: 500;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.tag-badge {
  padding: 4px 10px;
  background: var(--primary);
  color: white;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

.btn-primary.btn-sm {
  padding: 6px 12px;
  font-size: 0.9rem;
}

.btn-text {
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.btn-text:hover {
  color: var(--text-main);
}

.modal-footer {
  padding: 16px 28px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.footer-note {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-sub);
  text-align: center;
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-body {
    grid-template-columns: 1fr;
    padding: 20px;
  }
  
  .form-row-2 {
    grid-template-columns: 1fr;
  }
  
  .tags-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>