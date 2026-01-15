/**
 * 群組配置檔 (商業版 - 方案 B)
 * 定義所有群組的元數據與映射規則
 * 不需修改 D1 資料庫，完全在前端管理
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
    tags: ['long', 'hold', 'etf', '長線', '持有'],
    sortOrder: 1,
  },
  {
    id: 'short-term',
    name: '短線交易',
    icon: '⚡',
    color: '#f59e0b',
    description: '短期波段操作',
    tags: ['swing', 'day', 'short', '短線', '波段'],
    sortOrder: 2,
  },
  {
    id: 'dividend',
    name: '配息股',
    icon: '💰',
    color: '#8b5cf6',
    description: '高股息標的',
    tags: ['dividend', 'income', '配息', '股息'],
    sortOrder: 3,
  },
  {
    id: 'tech',
    name: '科技股',
    icon: '🚀',
    color: '#3b82f6',
    description: '科技類股',
    tags: ['tech', 'ai', 'chip', '科技', '晶片'],
    sortOrder: 4,
  },
];

/**
 * 群組管理工具類
 * 負責群組的 CRUD 操作與邏輯判斷
 */
export class GroupManager {
  constructor() {
    this.groups = [];
    this.loadGroups();
  }
  
  /**
   * 從 LocalStorage 載入群組配置
   */
  loadGroups() {
    const saved = localStorage.getItem('user_groups');
    if (saved) {
      try {
        this.groups = JSON.parse(saved);
        // 確保系統群組存在
        this.ensureSystemGroups();
      } catch (e) {
        console.error('❌ 載入群組配置失敗:', e);
        this.groups = [...DEFAULT_GROUPS];
      }
    } else {
      this.groups = [...DEFAULT_GROUPS];
      this.saveGroups();
    }
  }
  
  /**
   * 確保系統群組 (all) 存在且不可刪除
   */
  ensureSystemGroups() {
    const allGroup = this.groups.find(g => g.id === 'all');
    if (!allGroup) {
      this.groups.unshift(DEFAULT_GROUPS[0]);
    }
  }
  
  /**
   * 儲存群組配置到 LocalStorage
   */
  saveGroups() {
    try {
      localStorage.setItem('user_groups', JSON.stringify(this.groups));
      console.log('✅ 群組配置已儲存');
    } catch (e) {
      console.error('❌ 儲存群組配置失敗:', e);
    }
  }
  
  /**
   * 取得所有群組 (已排序)
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
  addGroup(name, icon = '📁', color = '#3b82f6', tags = [], description = '') {
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
    console.log('✅ 新增群組:', newGroup.name);
    return newGroup;
  }
  
  /**
   * 更新群組
   */
  updateGroup(id, updates) {
    const index = this.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      const group = this.groups[index];
      // 系統群組不允許修改某些屬性
      if (group.isSystem) {
        delete updates.id;
        delete updates.isSystem;
        delete updates.tags;
      }
      this.groups[index] = { ...group, ...updates };
      this.saveGroups();
      console.log('✅ 更新群組:', this.groups[index].name);
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
      console.log('✅ 刪除群組:', group.name);
      return true;
    }
    console.warn('⚠️  無法刪除系統群組');
    return false;
  }
  
  /**
   * 重新排序群組
   */
  reorderGroups(orderedIds) {
    orderedIds.forEach((id, index) => {
      const group = this.groups.find(g => g.id === id);
      if (group) group.sortOrder = index;
    });
    this.saveGroups();
    console.log('✅ 群組順序已更新');
  }
  
  /**
   * 判斷交易紀錄屬於哪些群組
   * @param {string} recordTag - 交易紀錄的 TAG 欄位值
   * @returns {string[]} - 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    if (!recordTag || recordTag.trim() === '') {
      return ['all'];
    }
    
    const recordTags = recordTag.toLowerCase()
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    const matchedGroups = ['all'];  // 預設包含「全部」
    
    this.groups.forEach(group => {
      if (group.id === 'all') return;
      
      // 檢查是否有任何 tag 匹配
      const hasMatch = group.tags.some(groupTag => {
        const lowerGroupTag = groupTag.toLowerCase();
        return recordTags.some(recordTagItem => {
          // 支援部分匹配
          return recordTagItem.includes(lowerGroupTag) || 
                 lowerGroupTag.includes(recordTagItem);
        });
      });
      
      if (hasMatch) {
        matchedGroups.push(group.id);
      }
    });
    
    return matchedGroups;
  }
  
  /**
   * 根據選擇的群組生成 TAG 字串
   * @param {string[]} groupIds - 選中的群組 ID 陣列
   * @returns {string} - TAG 欄位值
   */
  generateTagFromGroups(groupIds) {
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
   * 匯出群組配置給 Python 使用
   * @returns {Object} - 群組配置物件
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
    if (confirm('確定要重置為預設群組嗎？此操作無法復原。')) {
      this.groups = [...DEFAULT_GROUPS];
      this.saveGroups();
      console.log('✅ 已重置為預設群組');
      return true;
    }
    return false;
  }
  
  /**
   * 匯出群組配置 (JSON)
   */
  exportToJSON() {
    return JSON.stringify(this.groups, null, 2);
  }
  
  /**
   * 匯入群組配置 (JSON)
   */
  importFromJSON(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.groups = imported;
        this.ensureSystemGroups();
        this.saveGroups();
        console.log('✅ 群組配置已匯入');
        return true;
      }
    } catch (e) {
      console.error('❌ 匯入失敗:', e);
    }
    return false;
  }
}

// 建立單例實例
let instance = null;

/**
 * 取得 GroupManager 單例
 */
export function getGroupManager() {
  if (!instance) {
    instance = new GroupManager();
  }
  return instance;
}
