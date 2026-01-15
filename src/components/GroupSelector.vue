<![CDATA[<template>
  <div class="group-selector">
    <div class="selector-header">
      <h4 class="selector-title">投資群組</h4>
      <button 
        class="btn-manage" 
        @click="openGroupManager"
        title="管理群組"
      >
        ⚙️ 管理
      </button>
    </div>
    
    <div class="groups-container">
      <!-- 內建「全部紀錄」群組 -->
      <button
        class="group-btn"
        :class="{ active: currentGroupId === 'all' }"
        @click="selectGroup('all')"
      >
        <span class="group-icon">📊</span>
        <span class="group-name">全部紀錄</span>
      </button>
      
      <!-- 自訂群組 -->
      <button
        v-for="group in groups"
        :key="group.id"
        class="group-btn"
        :class="{ active: currentGroupId === group.id }"
        :style="{ 
          '--group-color': group.color,
          '--group-color-rgb': hexToRgb(group.color)
        }"
        @click="selectGroup(group.id)"
      >
        <span class="group-icon">{{ group.icon }}</span>
        <span class="group-name">{{ group.name }}</span>
        <span class="group-count" v-if="getGroupStats(group.id)">
          {{ getGroupStats(group.id).count }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

const groups = computed(() => store.groups);
const currentGroupId = computed(() => store.currentGroupId);

const selectGroup = (groupId) => {
  console.log(`🔄 切換到群組: ${groupId}`);
  store.switchGroup(groupId);
};

const openGroupManager = () => {
  store.showGroupManagerModal = true;
};

// 輔助函數：取得群組統計
const getGroupStats = (groupId) => {
  const group = store.groupManager.getGroup(groupId);
  if (!group) return null;
  
  // 計算該群組的交易筆數
  const count = store.records.filter(record => {
    const recordGroups = store.groupManager.getRecordGroups(record.tag);
    return recordGroups.includes(groupId);
  }).length;
  
  return { count };
};

// 輔助函數：Hex 轉 RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '59, 130, 246';
};
</script>

<style scoped>
.group-selector {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 20px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.selector-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.02em;
}

.btn-manage {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-manage:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  transform: translateY(-1px);
}

.groups-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.group-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.group-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(var(--group-color-rgb, 59, 130, 246), 0.05) 0%, 
    rgba(var(--group-color-rgb, 59, 130, 246), 0.02) 100%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.group-btn:hover {
  transform: translateY(-2px);
  border-color: var(--group-color, var(--primary));
  box-shadow: 0 4px 12px rgba(var(--group-color-rgb, 59, 130, 246), 0.2);
}

.group-btn:hover::before {
  opacity: 1;
}

.group-btn.active {
  background: linear-gradient(135deg, 
    rgba(var(--group-color-rgb, 59, 130, 246), 0.15) 0%, 
    rgba(var(--group-color-rgb, 59, 130, 246), 0.08) 100%
  );
  border-color: var(--group-color, var(--primary));
  color: var(--group-color, var(--primary));
  box-shadow: 0 2px 8px rgba(var(--group-color-rgb, 59, 130, 246), 0.25);
}

.group-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
}

.group-name {
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: rgba(var(--group-color-rgb, 59, 130, 246), 0.15);
  border: 1px solid rgba(var(--group-color-rgb, 59, 130, 246), 0.3);
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--group-color, var(--primary));
  font-family: 'JetBrains Mono', monospace;
}

.group-btn.active .group-count {
  background: rgba(var(--group-color-rgb, 59, 130, 246), 0.25);
  border-color: rgba(var(--group-color-rgb, 59, 130, 246), 0.5);
}

/* 響應式設計 */
@media (max-width: 768px) {
  .group-selector {
    padding: 16px;
  }
  
  .selector-header {
    margin-bottom: 12px;
  }
  
  .selector-title {
    font-size: 1rem;
  }
  
  .btn-manage {
    padding: 5px 10px;
    font-size: 0.85rem;
  }
  
  .groups-container {
    gap: 8px;
  }
  
  .group-btn {
    padding: 8px 12px;
    font-size: 0.9rem;
  }
  
  .group-icon {
    font-size: 1.1rem;
  }
}

@media (max-width: 480px) {
  .groups-container {
    flex-direction: column;
  }
  
  .group-btn {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>]]>