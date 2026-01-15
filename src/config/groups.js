/**
 * 群組配置管理系統 (商業版 - 方案 B: 純前端配置)
 * 
 * 核心特性：
 * - 不修改 D1 資料庫結構
 * - 不修改 Cloudflare Worker API
 * - 使用 LocalStorage 儲存使用者群組設定
 * - 透過 TAG 欄位實現群組歸屬
 * 
 * @version 2.1.0
 * @date 2026-01-15
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
    description: '長期投資組合，持有超過一年',
    tags: ['long', 'hold', 'etf', 'core'],
    sortOrder: 1,
    isSystem: false,
  },
  {
    id: 'short-term',
    name: '短線交易',
    icon: '⚡',
    color: '#f59e0b',
    description: '短期波段操作，持有時間較短',
    tags: ['swing', 'day', 'short', 'trade'],
    sortOrder: 2,
    isSystem: false,
  },
  {
    id: 'dividend',
    name: '配息股',
    icon: '💰',
    color: '#8b5cf6',
    description: '高股息標的，注重現金流',
    tags: ['dividend', 'income', 'yield'],
    sortOrder: 3,
    isSystem: false,
  },
  {
    id: 'tech',
    name: '科技股',
    icon: '🚀',
    color: '#3b82f6',
    description: '科技類股，包含 AI、半導體等',
    tags: ['tech', 'ai', 'chip', 'software'],
    sortOrder: 4,
    isSystem: false,
  },
];

/**
 * 群組管理工具類
 */
export class GroupManager {
  constructor() {
    this.STORAGE_KEY = 'trading_journal_groups';
    this.groups = [];
    this.loadGroups();
  }
  
  /**
   * 從 LocalStorage 載入群組設定
   */
  loadGroups() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 驗證資料結構
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.groups = parsed;
          console.log('✅ 成功載入使用者群組設定:', this.groups.length);
          return;
        }
      }
    } catch (e) {
      console.warn('⚠️ 載入群組設定失敗，使用預設值:', e);
    }
    
    // 使用預設群組
    this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    this.saveGroups();
  }
  
  /**
   * 儲存群組設定到 LocalStorage
   */
  saveGroups() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.groups));
      console.log('💾 群組設定已儲存');
    } catch (e) {
      console.error('❌ 儲存群組設定失敗:', e);
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
    // 驗證名稱唯一性
    if (this.groups.some(g => g.name === name)) {
      throw new Error(`群組名稱「${name}」已存在`);
    }
    
    const newGroup = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      color,
      description,
      tags: Array.isArray(tags) ? tags : [],
      sortOrder: this.groups.length,
      isSystem: false,
      createdAt: new Date().toISOString(),
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
    if (index === -1) {
      throw new Error(`找不到群組 ID: ${id}`);
    }
    
    const group = this.groups[index];
    
    // 系統群組限制修改
    if (group.isSystem && (updates.id || updates.isSystem !== undefined)) {
      throw new Error('無法修改系統群組的核心屬性');
    }
    
    // 更新群組
    this.groups[index] = {
      ...group,
      ...updates,
      id: group.id,  // 不允許修改 ID
      isSystem: group.isSystem,  // 不允許修改系統標記
      updatedAt: new Date().toISOString(),
    };
    
    this.saveGroups();
    console.log('✅ 更新群組:', this.groups[index].name);
    return this.groups[index];
  }
  
  /**
   * 刪除群組 (系統群組不可刪除)
   */
  deleteGroup(id) {
    const group = this.groups.find(g => g.id === id);
    
    if (!group) {
      throw new Error(`找不到群組 ID: ${id}`);
    }
    
    if (group.isSystem) {
      throw new Error('系統群組無法刪除');
    }
    
    this.groups = this.groups.filter(g => g.id !== id);
    this.saveGroups();
    
    console.log('🗑️ 刪除群組:', group.name);
    return true;
  }
  
  /**
   * 重新排序群組
   */
  reorderGroups(orderedIds) {
    if (!Array.isArray(orderedIds)) {
      throw new Error('orderedIds 必須是陣列');
    }
    
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
   * 
   * @param {string} recordTag - 交易紀錄的 TAG 欄位值
   * @returns {string[]} 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    const matchedGroups = ['all'];  // 預設包含「全部」
    
    if (!recordTag || typeof recordTag !== 'string') {
      return matchedGroups;
    }
    
    // 將 recordTag 分割並標準化
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
      
      // 檢查是否有任何 tag 匹配
      const hasMatch = group.tags.some(groupTag => {
        const normalizedGroupTag = groupTag.toLowerCase();
        return recordTags.some(recordTagItem => 
          recordTagItem.includes(normalizedGroupTag) || 
          normalizedGroupTag.includes(recordTagItem)
        );
      });
      
      if (hasMatch) {
        matchedGroups.push(group.id);
      }
    });
    
    return matchedGroups;
  }
  
  /**
   * 根據選中的群組生成 TAG 字串
   * 
   * @param {string[]} groupIds - 群組 ID 陣列
   * @returns {string} TAG 字串 (逗號分隔)
   */
  generateTagFromGroups(groupIds) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return '';
    }
    
    const allTags = new Set();
    
    groupIds.forEach(groupId => {
      const group = this.getGroupById(groupId);
      if (group && group.id !== 'all') {
        // 使用第一個代表性標籤
        if (group.tags.length > 0) {
          allTags.add(group.tags[0]);
        }
      }
    });
    
    return Array.from(allTags).join(',');
  }
  
  /**
   * 匯出群組配置供 Python 使用
   * 
   * @returns {Object} 群組配置物件
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
    if (confirm('確定要重置為預設群組設定嗎？此操作無法復原。')) {
      this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
      this.saveGroups();
      console.log('🔄 已重置為預設群組');
      return true;
    }
    return false;
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
      if (!Array.isArray(imported)) {
        throw new Error('格式錯誤：必須是陣列');
      }
      
      // 驗證必要欄位
      const isValid = imported.every(g => 
        g.id && g.name && g.icon && g.color && Array.isArray(g.tags)
      );
      
      if (!isValid) {
        throw new Error('群組資料缺少必要欄位');
      }
      
      this.groups = imported;
      this.saveGroups();
      console.log('✅ 成功匯入群組設定');
      return true;
    } catch (e) {
      console.error('❌ 匯入失敗:', e);
      throw e;
    }
  }
}

// 建立單例實例
let groupManagerInstance = null;

/**
 * 取得 GroupManager 單例
 */
export function getGroupManager() {
  if (!groupManagerInstance) {
    groupManagerInstance = new GroupManager();
  }
  return groupManagerInstance;
}
