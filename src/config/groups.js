/**
 * 群組配置檔 (商業版 - 方案 B: 前端配置)
 * 定義所有群組的元數據與映射規則
 * 不需修改 D1 資料庫，完全由前端管理
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
    tags: ['long', 'hold', 'etf', '長線', '長期'],
    sortOrder: 1,
    isSystem: false,
  },
  {
    id: 'short-term',
    name: '短線交易',
    icon: '⚡',
    color: '#f59e0b',
    description: '短期波段操作',
    tags: ['swing', 'day', 'short', '短線', '波段'],
    sortOrder: 2,
    isSystem: false,
  },
  {
    id: 'dividend',
    name: '配息股',
    icon: '💰',
    color: '#8b5cf6',
    description: '高股息標的',
    tags: ['dividend', 'income', '配息', '股息'],
    sortOrder: 3,
    isSystem: false,
  },
  {
    id: 'tech',
    name: '科技股',
    icon: '🚀',
    color: '#3b82f6',
    description: '科技類股',
    tags: ['tech', 'ai', 'chip', '科技', '晶片'],
    sortOrder: 4,
    isSystem: false,
  },
];

/**
 * 群組管理工具類別
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
        console.log('✅ 已載入使用者自訂群組配置');
      } catch (e) {
        console.warn('⚠️ 群組配置解析失敗，使用預設配置', e);
        this.groups = [...DEFAULT_GROUPS];
        this.saveGroups();
      }
    } else {
      console.log('📋 首次使用，初始化預設群組');
      this.groups = [...DEFAULT_GROUPS];
      this.saveGroups();
    }
  }
  
  /**
   * 儲存群組配置到 LocalStorage
   */
  saveGroups() {
    localStorage.setItem('user_groups', JSON.stringify(this.groups));
    console.log('💾 群組配置已儲存');
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
    console.log('✅ 新增群組:', newGroup.name);
    return newGroup;
  }
  
  /**
   * 更新群組資料
   */
  updateGroup(id, updates) {
    const index = this.groups.findIndex(g => g.id === id);
    if (index !== -1) {
      // 系統群組不允許修改某些欄位
      if (this.groups[index].isSystem) {
        delete updates.id;
        delete updates.isSystem;
      }
      this.groups[index] = { ...this.groups[index], ...updates };
      this.saveGroups();
      console.log('✅ 更新群組:', this.groups[index].name);
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
      console.log('🗑️ 刪除群組:', group.name);
      return true;
    }
    console.warn('⚠️ 無法刪除系統群組');
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
    console.log('🔄 群組順序已更新');
  }
  
  /**
   * 判斷交易紀錄屬於哪些群組
   * @param {string} recordTag - 交易紀錄的 TAG 欄位值
   * @returns {string[]} - 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    const matchedGroups = ['all'];  // 預設包含「全部」
    
    if (!recordTag) {
      return matchedGroups;
    }
    
    // 將 recordTag 拆分為小寫的標籤陣列
    const tags = recordTag.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
    
    if (tags.length === 0) {
      return matchedGroups;
    }
    
    // 檢查每個群組
    this.groups.forEach(group => {
      if (group.id === 'all') return;
      
      // 檢查是否有任何 tag 匹配群組的 tags
      const hasMatch = group.tags.some(groupTag => {
        const groupTagLower = groupTag.toLowerCase();
        return tags.some(recordTagItem => 
          recordTagItem.includes(groupTagLower) || groupTagLower.includes(recordTagItem)
        );
      });
      
      if (hasMatch) {
        matchedGroups.push(group.id);
      }
    });
    
    return matchedGroups;
  }
  
  /**
   * 將群組配置匯出為 Python 可用的格式
   * @returns {Object} - { groupId: { name, tags } }
   */
  exportForPython() {
    return this.groups.reduce((acc, group) => {
      acc[group.id] = {
        name: group.name,
        tags: group.tags,
        icon: group.icon,
        color: group.color,
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
    console.log('🔄 已重置為預設群組配置');
  }
}
