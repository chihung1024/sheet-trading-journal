/**
 * 群組配置管理系統 (商業版 - 輕量化方案)
 * 
 * 特色：
 * - 純前端配置，不修改 D1 資料庫
 * - 使用 LocalStorage 持久化
 * - 支援自訂群組與標籤映射
 * - 自動識別交易紀錄所屬群組
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
    description: '長期投資組合 (ETF、價值股)',
    tags: ['long', 'hold', 'etf', 'value'],
    sortOrder: 1,
    isSystem: false,
  },
  {
    id: 'short-term',
    name: '短線交易',
    icon: '⚡',
    color: '#f59e0b',
    description: '短期波段操作',
    tags: ['swing', 'day', 'short', 'trade'],
    sortOrder: 2,
    isSystem: false,
  },
  {
    id: 'dividend',
    name: '配息股',
    icon: '💰',
    color: '#8b5cf6',
    description: '高股息標的',
    tags: ['dividend', 'income', 'yield'],
    sortOrder: 3,
    isSystem: false,
  },
  {
    id: 'tech',
    name: '科技股',
    icon: '🚀',
    color: '#3b82f6',
    description: '科技類股 (AI、半導體)',
    tags: ['tech', 'ai', 'chip', 'semiconductor'],
    sortOrder: 4,
    isSystem: false,
  },
  {
    id: 'growth',
    name: '成長股',
    icon: '🌱',
    color: '#14b8a6',
    description: '高成長潛力標的',
    tags: ['growth', 'momentum'],
    sortOrder: 5,
    isSystem: false,
  },
];

/**
 * 群組管理類別
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
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 確保至少有系統群組
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.groups = parsed;
        } else {
          this.groups = [...DEFAULT_GROUPS];
          this.saveGroups();
        }
      } catch (e) {
        console.error('❌ 群組配置載入失敗:', e);
        this.groups = [...DEFAULT_GROUPS];
        this.saveGroups();
      }
    } else {
      this.groups = [...DEFAULT_GROUPS];
      this.saveGroups();
    }
  }
  
  /**
   * 儲存群組配置到 LocalStorage
   */
  saveGroups() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.groups));
    } catch (e) {
      console.error('❌ 群組配置儲存失敗:', e);
    }
  }
  
  /**
   * 取得所有群組 (依排序順序)
   */
  getAllGroups() {
    return this.groups.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  
  /**
   * 取得指定 ID 的群組
   */
  getGroup(id) {
    return this.groups.find(g => g.id === id);
  }
  
  /**
   * 新增自訂群組
   */
  addGroup({ name, icon = '📁', color = '#3b82f6', description = '', tags = [] }) {
    const newGroup = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      color,
      description,
      tags: Array.isArray(tags) ? tags : [],
      sortOrder: this.groups.length,
      isSystem: false,
    };
    this.groups.push(newGroup);
    this.saveGroups();
    return newGroup;
  }
  
  /**
   * 更新群組資訊
   */
  updateGroup(id, updates) {
    const index = this.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      const group = this.groups[index];
      // 系統群組不允許修改某些屬性
      if (group.isSystem) {
        const { id: _id, isSystem: _isSystem, ...safeUpdates } = updates;
        this.groups[index] = { ...group, ...safeUpdates };
      } else {
        this.groups[index] = { ...group, ...updates };
      }
      this.saveGroups();
      return true;
    }
    return false;
  }
  
  /**
   * 刪除群組 (系統群組不可刪除)
   */
  deleteGroup(id) {
    const group = this.groups.find(g => g.id === id);
    if (group && !group.isSystem) {
      this.groups = this.groups.filter(g => g.id !== id);
      this.saveGroups();
      return true;
    }
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
  }
  
  /**
   * 判斷交易紀錄屬於哪些群組
   * 
   * @param {string} recordTag - 交易紀錄的 TAG 欄位值
   * @returns {string[]} - 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    const matchedGroups = ['all'];  // 預設包含「全部」
    
    if (!recordTag || typeof recordTag !== 'string') {
      return matchedGroups;
    }
    
    // 將 TAG 欄位分割並轉小寫
    const recordTags = recordTag
      .toLowerCase()
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    if (recordTags.length === 0) {
      return matchedGroups;
    }
    
    // 檢查每個群組
    this.groups.forEach(group => {
      if (group.id === 'all') return;
      
      // 檢查是否有任何標籤匹配
      const hasMatch = group.tags.some(groupTag => {
        const groupTagLower = groupTag.toLowerCase();
        return recordTags.some(recordTag => 
          recordTag.includes(groupTagLower) || groupTagLower.includes(recordTag)
        );
      });
      
      if (hasMatch) {
        matchedGroups.push(group.id);
      }
    });
    
    return matchedGroups;
  }
  
  /**
   * 將群組標籤轉換為 TAG 欄位字串
   * 
   * @param {string[]} groupIds - 群組 ID 陣列
   * @returns {string} - TAG 欄位字串 (逗號分隔)
   */
  groupsToTagString(groupIds) {
    const allTags = new Set();
    
    groupIds.forEach(groupId => {
      const group = this.getGroup(groupId);
      if (group && group.tags && group.tags.length > 0) {
        // 取每個群組的第一個標籤作為代表
        allTags.add(group.tags[0]);
      }
    });
    
    return Array.from(allTags).join(',');
  }
  
  /**
   * 匯出群組配置供 Python 使用
   * 
   * @returns {Object} - Python 可用的群組配置格式
   */
  exportForPython() {
    return this.groups.reduce((acc, group) => {
      acc[group.id] = {
        name: group.name,
        tags: group.tags,
        description: group.description,
      };
      return acc;
    }, {});
  }
  
  /**
   * 重置為預設群組
   */
  resetToDefaults() {
    this.groups = [...DEFAULT_GROUPS];
    this.saveGroups();
  }
  
  /**
   * 匯出群組配置為 JSON
   */
  exportToJSON() {
    return JSON.stringify(this.groups, null, 2);
  }
  
  /**
   * 從 JSON 匯入群組配置
   */
  importFromJSON(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.groups = imported;
        this.saveGroups();
        return true;
      }
    } catch (e) {
      console.error('❌ 群組配置匯入失敗:', e);
    }
    return false;
  }
}

// 匯出單例實例
export const groupManager = new GroupManager();
