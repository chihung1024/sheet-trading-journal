/**
 * 群組配置檔 (商業版 - 輕量化方案)
 * 
 * 功能：
 * - 定義所有群組的元數據與映射規則
 * - 使用 localStorage 儲存使用者自訂群組
 * - 不修改 D1 資料庫架構
 * - 完全前端管理，支援版本控制
 * 
 * @version 2.1.0
 * @date 2026-01-15
 */

/**
 * 預設群組配置
 * 系統初始化時使用，使用者可自訂擴充
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
    tags: ['long', 'hold', 'etf', 'index'],
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
    description: '科技類股',
    tags: ['tech', 'ai', 'chip', 'software'],
    sortOrder: 4,
    isSystem: false,
  },
];

/**
 * 群組管理器
 * 負責群組的 CRUD 操作、TAG 映射、資料持久化
 */
export class GroupManager {
  constructor() {
    this.groups = [];
    this.loadGroups();
  }
  
  /**
   * 從 localStorage 載入群組配置
   * 如果不存在，使用預設配置
   */
  loadGroups() {
    try {
      const saved = localStorage.getItem('user_groups');
      if (saved) {
        this.groups = JSON.parse(saved);
        console.log('✅ 已載入使用者群組配置:', this.groups.length, '個群組');
      } else {
        this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
        this.saveGroups();
        console.log('📋 初始化預設群組配置');
      }
    } catch (error) {
      console.error('❌ 載入群組配置失敗:', error);
      this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
      this.saveGroups();
    }
  }
  
  /**
   * 儲存群組配置到 localStorage
   */
  saveGroups() {
    try {
      localStorage.setItem('user_groups', JSON.stringify(this.groups));
      console.log('💾 群組配置已儲存');
    } catch (error) {
      console.error('❌ 儲存群組配置失敗:', error);
    }
  }
  
  /**
   * 取得所有群組（已排序）
   * @returns {Array} 群組陣列
   */
  getAllGroups() {
    return [...this.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  
  /**
   * 取得單一群組
   * @param {string} id - 群組 ID
   * @returns {Object|null} 群組物件
   */
  getGroup(id) {
    return this.groups.find(g => g.id === id) || null;
  }
  
  /**
   * 新增自訂群組
   * @param {string} name - 群組名稱
   * @param {string} icon - 群組圖示
   * @param {string} color - 群組顏色
   * @param {Array<string>} tags - TAG 關鍵字陣列
   * @param {string} description - 群組描述
   * @returns {Object} 新建的群組物件
   */
  addGroup(name, icon = '📁', color = '#3b82f6', tags = [], description = '') {
    // 檢查名稱是否重複
    if (this.groups.some(g => g.name === name)) {
      throw new Error(`群組名稱 "${name}" 已存在`);
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
    
    console.log('➕ 新增群組:', newGroup.name);
    return newGroup;
  }
  
  /**
   * 更新群組
   * @param {string} id - 群組 ID
   * @param {Object} updates - 要更新的欄位
   * @returns {boolean} 是否更新成功
   */
  updateGroup(id, updates) {
    const index = this.groups.findIndex(g => g.id === id);
    if (index === -1) {
      console.warn('⚠️ 找不到群組:', id);
      return false;
    }
    
    // 系統群組不允許修改某些欄位
    const group = this.groups[index];
    if (group.isSystem) {
      // 系統群組只能修改 icon 和 color
      const allowedUpdates = {};
      if (updates.icon) allowedUpdates.icon = updates.icon;
      if (updates.color) allowedUpdates.color = updates.color;
      updates = allowedUpdates;
    }
    
    this.groups[index] = {
      ...group,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveGroups();
    console.log('✏️ 更新群組:', this.groups[index].name);
    return true;
  }
  
  /**
   * 刪除群組
   * @param {string} id - 群組 ID
   * @returns {boolean} 是否刪除成功
   */
  deleteGroup(id) {
    const group = this.groups.find(g => g.id === id);
    
    // 系統群組不可刪除
    if (!group) {
      console.warn('⚠️ 找不到群組:', id);
      return false;
    }
    
    if (group.isSystem) {
      console.warn('⚠️ 系統群組不可刪除:', group.name);
      return false;
    }
    
    this.groups = this.groups.filter(g => g.id !== id);
    this.saveGroups();
    
    console.log('🗑️ 刪除群組:', group.name);
    return true;
  }
  
  /**
   * 重新排序群組
   * @param {Array<string>} orderedIds - 排序後的群組 ID 陣列
   */
  reorderGroups(orderedIds) {
    orderedIds.forEach((id, index) => {
      const group = this.groups.find(g => g.id === id);
      if (group) {
        group.sortOrder = index;
      }
    });
    
    this.saveGroups();
    console.log('🔄 群組排序已更新');
  }
  
  /**
   * 判斷交易紀錄屬於哪些群組
   * @param {string} recordTag - 交易紀錄的 TAG 欄位值
   * @returns {Array<string>} 群組 ID 陣列
   */
  getRecordGroups(recordTag) {
    // 空 TAG 或無效 TAG 只屬於「全部」
    if (!recordTag || recordTag.trim() === '') {
      return ['all'];
    }
    
    // 將 TAG 欄位分割成陣列
    const recordTags = recordTag
      .toLowerCase()
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    if (recordTags.length === 0) {
      return ['all'];
    }
    
    const matchedGroups = ['all'];  // 預設包含「全部」
    
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
   * 根據群組 ID 陣列生成 TAG 欄位值
   * @param {Array<string>} groupIds - 群組 ID 陣列
   * @returns {string} TAG 欄位值（逗號分隔）
   */
  generateTagFromGroups(groupIds) {
    if (!groupIds || groupIds.length === 0) {
      return '';
    }
    
    // 過濾掉「全部」群組
    const validGroupIds = groupIds.filter(id => id !== 'all');
    
    if (validGroupIds.length === 0) {
      return '';
    }
    
    // 收集所有群組的第一個 tag
    const tags = new Set();
    validGroupIds.forEach(id => {
      const group = this.groups.find(g => g.id === id);
      if (group && group.tags.length > 0) {
        // 使用第一個 tag 作為代表
        tags.add(group.tags[0]);
      }
    });
    
    return Array.from(tags).join(',');
  }
  
  /**
   * 匯出群組配置供 Python 使用
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
   * 匯入群組配置（覆蓋現有配置）
   * @param {Array} groupsData - 群組資料陣列
   */
  importGroups(groupsData) {
    if (!Array.isArray(groupsData)) {
      throw new Error('群組資料必須是陣列');
    }
    
    this.groups = groupsData;
    this.saveGroups();
    console.log('📥 匯入群組配置:', this.groups.length, '個群組');
  }
  
  /**
   * 重置為預設配置
   */
  resetToDefault() {
    this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    this.saveGroups();
    console.log('🔄 重置為預設群組配置');
  }
  
  /**
   * 取得統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      total: this.groups.length,
      system: this.groups.filter(g => g.isSystem).length,
      custom: this.groups.filter(g => !g.isSystem).length,
    };
  }
}

// 匯出單例實例（可選）
export const groupManager = new GroupManager();

// 調試信息
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('📋 群組管理系統已初始化');
  console.log('  ✅ 群組數量:', groupManager.groups.length);
  console.log('  ✅ 預設群組:', DEFAULT_GROUPS.length);
}
