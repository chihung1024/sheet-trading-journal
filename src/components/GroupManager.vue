<template>
  <div class="card group-manager">
    <div class="panel-header">
      <h3 class="panel-title">🎨 群組外觀設定</h3>
      <button class="btn-add" @click="openAddForm">
        <span class="icon">+</span> 自訂新標籤
      </button>
    </div>

    <div class="info-banner">
        <span class="info-icon">💡</span>
        <div class="info-content">
            <p>此處管理「標籤 (Tag)」的顯示外觀。</p>
            <small>系統會自動從交易紀錄偵測標籤。您也可以在此預先定義標籤的顏色與圖示。</small>
        </div>
    </div>

    <div v-if="showForm" class="form-overlay" @click.self="cancelForm">
      <div class="form-card">
        <h4>{{ isEditing ? '編輯群組外觀' : '新增自訂標籤' }}</h4>
        
        <div class="form-group">
          <label>標籤代碼 (Tag ID)</label>
          <input 
            v-model="formData.id" 
            placeholder="例: LongTerm (請用英文)" 
            class="input-md"
            :disabled="isEditing" 
          >
          <small class="hint" v-if="!isEditing">* 這是寫入交易紀錄的原始標籤 (建議英文)</small>
        </div>

        <div class="form-group">
          <label>顯示名稱 (Display Name)</label>
          <input 
            v-model="formData.label" 
            placeholder="例: 🐢 長線養老" 
            class="input-md"
          >
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>代表色</label>
            <div class="color-picker-wrapper">
                <input v-model="formData.color" type="color" class="input-color">
                <span class="color-code">{{ formData.color }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>圖示 (Icon)</label>
            <select v-model="formData.icon" class="input-md">
              <option value="folder">📁 資料夾</option>
              <option value="spa">🌱 成長</option>
              <option value="bolt">⚡ 短線</option>
              <option value="savings">💰 存股</option>
              <option value="trending_up">📈 趨勢</option>
              <option value="rocket_launch">🚀 火箭</option>
              <option value="security">🛡️ 防禦</option>
              <option value="science">🧪 實驗</option>
              <option value="casino">🎰 投機</option>
              <option value="flag">🚩 目標</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
           <label>排序權重 (Order)</label>
           <input type="number" v-model.number="formData.order" class="input-md" placeholder="數字越小越前面">
        </div>

        <div class="form-actions">
          <button class="btn btn-cancel" @click="cancelForm">取消</button>
          <button class="btn btn-submit" @click="saveGroup">
            {{ isEditing ? '儲存設定' : '新增設定' }}
          </button>
        </div>
      </div>
    </div>

    <div class="groups-list">
      <div v-if="sortedGroups.length === 0" class="empty-state">
        <div class="empty-icon">🎨</div>
        <p>目前沒有任何群組設定</p>
      </div>
      
      <div 
        v-for="group in sortedGroups" 
        :key="group.id" 
        class="group-item" 
        :style="{ borderLeftColor: group.color }"
      >
        <div class="group-info">
            <div class="group-icon" :style="{ color: group.color }">
                <span class="material-symbols-outlined" v-if="isMaterialIcon(group.icon)">
                    {{ group.icon }}
                </span>
                <span v-else>{{ group.icon }}</span>
            </div>
            
            <div class="group-details">
                <div class="group-header">
                    <span class="group-name">{{ group.name }}</span>
                    <span class="group-id-badge">{{ group.id }}</span>
                </div>
                <div class="group-meta">
                    <span class="stat-badge">
                        📄 {{ getRecordCount(group.id) }} 筆相關交易
                    </span>
                    <span class="stat-badge" v-if="group.order !== 999">
                        排序: {{ group.order }}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="group-actions">
          <button class="btn-icon" @click="editGroup(group)" title="編輯外觀">✎</button>
          <button class="btn-icon btn-danger" @click="deleteGroupConfig(group.id)" title="重置設定">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const toast = useToast();

const showForm = ref(false);
const isEditing = ref(false);

// 表單資料
const formData = reactive({
  id: '',
  label: '',
  color: '#3B82F6',
  icon: 'folder',
  order: 10
});

// 本地存儲 Key
const STORAGE_KEY = 'stj_group_config';

// 取得排序後的群組列表 (包含 ALL)
const sortedGroups = computed(() => {
    return store.availableGroups;
});

// 判斷字串是否為 Material Icon 代碼 (簡單判斷：英文字母)
const isMaterialIcon = (str) => {
    return /^[a-z_]+$/.test(str);
};

// 計算關聯交易數量
const getRecordCount = (groupId) => {
    if (groupId === 'ALL') return store.records.length;
    // 模糊比對 Tag
    return store.records.filter(r => {
        const tags = (r.tag || r.Tag || '').toString();
        return tags.includes(groupId);
    }).length;
};

// 開啟新增表單
const openAddForm = () => {
    isEditing.value = false;
    Object.assign(formData, {
        id: '',
        label: '',
        color: '#6366f1',
        icon: 'folder',
        order: 10
    });
    showForm.value = true;
};

// 開啟編輯表單
const editGroup = (group) => {
    isEditing.value = true;
    Object.assign(formData, {
        id: group.id,
        label: group.name, // name 在 getter 中已經是 display label
        color: group.color,
        icon: group.icon,
        order: group.order
    });
    
    // 如果 getter 回傳的 name 等於 id，代表尚未設定 label，表單中顯示空白較好
    if (group.name === group.id) {
        formData.label = '';
    }
    
    showForm.value = true;
};

// 儲存設定
const saveGroup = () => {
    if (!formData.id.trim()) {
        toast.error('請輸入標籤代碼 (Tag ID)');
        return;
    }

    // 1. 更新 Store 中的 Config
    // 注意：因為 Pinia state 是響應式的，我們可以直接修改
    // 但為了正規，通常建議用 action。這裡為了 Phase 2 簡便，直接操作 state。
    
    const configEntry = {
        label: formData.label || formData.id,
        color: formData.color,
        icon: formData.icon,
        order: formData.order
    };

    store.groupConfig[formData.id] = configEntry;

    // 2. 持久化到 LocalStorage
    saveConfigToStorage();

    toast.success(`群組 [${formData.id}] 設定已儲存`);
    cancelForm();
    
    // 強制觸發畫面更新 (如果 computed 沒反應)
    store.setGroupId(store.currentGroupId); 
};

// 刪除/重置設定
const deleteGroupConfig = (id) => {
    if (id === 'ALL') {
        toast.warning('無法刪除總覽設定');
        return;
    }
    
    if (!confirm(`確定要重置 [${id}] 的外觀設定嗎？\n(這不會刪除交易紀錄，只會恢復預設顏色)`)) return;

    if (store.groupConfig[id]) {
        delete store.groupConfig[id];
        saveConfigToStorage();
        toast.success('設定已重置');
    }
};

const cancelForm = () => {
    showForm.value = false;
};

// --- LocalStorage Persistence Helpers ---

const saveConfigToStorage = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.groupConfig));
    } catch (e) {
        console.error('Failed to save config', e);
    }
};

const loadConfigFromStorage = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // 合併既有預設值與儲存值
            Object.assign(store.groupConfig, parsed);
        }
    } catch (e) {
        console.error('Failed to load config', e);
    }
};

onMounted(() => {
    loadConfigFromStorage();
});
</script>

<style scoped>
.group-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-main);
  border-left: 4px solid var(--primary);
  padding-left: 12px;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  color: var(--primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn-add:hover {
  background: var(--bg-card);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.info-banner {
    display: flex;
    gap: 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 24px;
}

.info-icon { font-size: 1.2rem; }
.info-content p { margin: 0; font-weight: 500; color: var(--text-main); font-size: 0.95rem; }
.info-content small { color: var(--text-sub); display: block; margin-top: 4px; }

/* 表單遮罩 */
.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.form-card {
  background: var(--bg-card);
  padding: 24px;
  border-radius: 12px;
  max-width: 450px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  border: 1px solid var(--border-color);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.form-card h4 {
  margin: 0 0 20px 0;
  font-size: 1.2rem;
  color: var(--text-main);
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 500;
}

.input-md {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-secondary);
  color: var(--text-main);
  box-sizing: border-box;
}

.input-md:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-card);
}

.input-md:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hint {
    font-size: 0.75rem;
    color: var(--warning);
    margin-top: 4px;
    display: block;
}

.color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-secondary);
    padding: 6px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
}

.input-color {
  width: 40px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.color-code {
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text-sub);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.btn-submit {
  background: var(--primary);
  color: white;
}

.btn-submit:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* 群組列表 */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  max-height: 600px;
  padding-right: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-sub);
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.empty-icon { font-size: 2.5rem; margin-bottom: 12px; }

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left: 4px solid;
  border-radius: 8px;
  transition: all 0.2s;
}

.group-item:hover {
  transform: translateX(2px);
  box-shadow: var(--shadow-sm);
  background: var(--bg-secondary);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.group-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.group-details {
  flex: 1;
}

.group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.group-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.group-id-badge {
    font-size: 0.75rem;
    font-family: monospace;
    background: rgba(0,0,0,0.2);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-sub);
}

.group-meta {
  display: flex;
  gap: 8px;
}

.stat-badge {
  font-size: 0.8rem;
  color: var(--text-sub);
}

.group-actions {
  display: flex;
  gap: 6px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
  color: var(--text-sub);
}

.btn-icon:hover {
  background: var(--bg-secondary);
  color: var(--primary);
  border-color: var(--border-color);
}

.btn-icon.btn-danger:hover {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

/* Material Symbols Font Support */
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
</style>
