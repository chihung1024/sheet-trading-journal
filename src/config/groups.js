/**
 * 群組配置管理系統 (輕量化方案 - 純前端)
 * 不修改 D1 與 Worker，使用 LocalStorage + TAG 欄位
 */

/**
 * 預設群組配置
 */
export const DEFAULT_GROUPS = [
  {
    id: 'all',
    name: '全部紀錄',
    icon: '📊',
    color: '#64748b',
    description: '顯示所有交易紀錄',
    tags: [],  // 空陣列表示「全部」
    sortOrder: 0,
    isSystem: true,  // 系統群組，不可刪除
  },
  {
    id: 'long-term',
    name: '長線持有',
    icon: '📈',
    color: '#10b981',
    description: '長期投資組合',
    tags: ['long', 'hold', 'invest'],
    sortOrder: 1,
  },
  {
    id: 'short-term',
    name: '短線交易',
    icon: '⚡',
    color: '#f59e0b',
    description: '短期波段操作',
    tags: ['swing', 'trade', 'short'],
    sortOrder: 2,
  },
  {
    id: 'dividend',
    name: '配息股',
    icon: '💰',
    color: '#8b5cf6',
    description: '高股息標的',
    tags: ['dividend', 'income'],
    sortOrder: 3,
  },
];

/**
 * 群組管理器
 * 負責群組的 CRUD 操作與 TAG 欄位映射
 */
export class GroupManager {
  constructor() {
    this.storageKey = 'trading_journal_groups';
    this.loadGroups();
  }
  
  /**
   * 從 LocalStorage 載入群組配置
   */
  loadGroups() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.groups = JSON.parse(saved);
        console.log('✅ 已載入', this.groups.length, '個群組');
      } else {
        this.groups = [...DEFAULT_GROUPS];
        this.saveGroups();
        console.log('✅ 初始化預設群組');
      }
    } catch (e) {
      console.error('❌ 載入群組失敗:', e);
      this.groups = [...DEFAULT_GROUPS];
    }
  }
  
  /**
   * 儲存群組配置到 LocalStorage
   */
  saveGroups() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.groups));
      console.log('💾 群組配置已儲存');
    } catch (e) {
      console.error('❌ 儲存群組失敗:', e);
    }
  }
  
  /**
   * 取得所有群組（已排序）
   */
  getAllGroups() {
    return [...this.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  
  /**
   * 根據 ID 取得群組
   */
  getGroupById(id) {
    return this.groups.find(g => g.id === id);
  }
  
  /**
   * 新增自訂群組
   */
  addGroup(name, icon = '📁', color = '#3b82f6', tags = []) {
    const newGroup = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      color,
      description: '',
      tags,
      sortOrder: this.groups.length,
      isSystem: false,
    };
    this.groups.push(newGroup);
    this.saveGroups();
    console.log('✅ 新增群組:', name);
    return newGroup;
  }
  
  /**
   * 更新群組
   */
  updateGroup(id, updates) {
    const index = this.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      // 防止修改系統屬性
      const { isSystem, ...safeUpdates } = updates;
      this.groups[index] = { ...this.groups[index], ...safeUpdates };
      this.saveGroups();
      console.log('✅ 更新群組:', id);
      return true;
    }
    return false;
  }
  
  /**
   * 刪除群組（系統群組不可刪除）
   */
  deleteGroup(id) {
    const group = this.groups.find(g => g.id === id);
    if (group && !group.isSystem) {
      this.groups = this.groups.filter(g => g.id !== id);
      this.saveGroups();
      console.log('🗑️ 刪除群組:', id);
      return true;
    }
    console.warn('⚠️ 無法刪除系統群組或不存在的群組');
    return false;
  }
  
  /**
   * 重新排序群組
   */
  reorderGroups(orderedIds) {
    orderedIds.forEach((id, index) => {
      const group = this.groups.find(g => g.id === id);
      if (group) {
        group.sortOrder = index;
      }
    });
    this.saveGroups();
    console.log('✅ 群組已重新排序');
  }
  
  /**
   * 判斷交易紀錄屬於哪些群組
   * @param {string} recordTag - 交易紀錄的 TAG 欄位
   * @returns {string[]} 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    const matchedGroups = ['all'];  // 預設包含「全部」
    
    if (!recordTag) {
      return matchedGroups;
    }
    
    // 將 TAG 欄位轉為小寫陣列
    const recordTags = recordTag
      .toLowerCase()
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    // 檢查每個群組
    this.groups.forEach(group => {
      if (group.id === 'all' || group.tags.length === 0) {
        return;
      }
      
      // 檢查是否有任何 tag 匹配
      const hasMatch = group.tags.some(groupTag => {
        const lowerGroupTag = groupTag.toLowerCase();
        return recordTags.some(recordTag => 
          recordTag.includes(lowerGroupTag) || lowerGroupTag.includes(recordTag)
        );
      });
      
      if (hasMatch) {
        matchedGroups.push(group.id);
      }
    });
    
    return matchedGroups;
  }
  
  /**
   * 將選中的群組轉換為 TAG 欄位字串
   * @param {string[]} groupIds - 群組 ID 陣列
   * @returns {string} TAG 字串（逗號分隔）
   */
  groupsToTag(groupIds) {
    const allTags = new Set();
    
    groupIds.forEach(groupId => {
      const group = this.getGroupById(groupId);
      if (group && group.id !== 'all') {
        group.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    return Array.from(allTags).join(',');
  }
  
  /**
   * 將 TAG 欄位還原為群組選擇
   * @param {string} tagString - TAG 字串
   * @returns {string[]} 群組 ID 陣列
   */
  tagToGroups(tagString) {
    return this.getRecordGroups(tagString).filter(id => id !== 'all');
  }
  
  /**
   * 匯出群組配置供 Python 使用
   * @returns {Object} 群組配置物件
   */
  exportForPython() {
    const config = {};
    this.groups.forEach(group => {
      config[group.id] = {
        name: group.name,
        tags: group.tags,
      };
    });
    return config;
  }
  
  /**
   * 重置為預設群組
   */
  resetToDefault() {
    if (confirm('確定要重置為預設群組配置嗎？所有自訂群組將被刪除。')) {
      this.groups = [...DEFAULT_GROUPS];
      this.saveGroups();
      console.log('🔄 已重置為預設群組');
      return true;
    }
    return false;
  }
}

// 建立全域實例
export const groupManager = new GroupManager();
