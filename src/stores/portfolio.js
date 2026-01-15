import { defineStore } from 'pinia'
import axios from 'axios' // 假設您使用 axios，若專案使用 fetch 可自行替換
import { computed, ref } from 'vue'

// ==========================================
// 方案 B：群組元數據設定 (Group Metadata Config)
// 建議：未來可將此物件移至 src/config/groups.js
// ==========================================
const DEFAULT_GROUP_CONFIG = {
  'ALL': { 
    label: '總覽 (Overview)', 
    color: '#3B82F6', // Blue-500
    icon: 'dashboard',
    order: 0 
  },
  'LongTerm': { 
    label: '長線投資', 
    color: '#10B981', // Emerald-500
    icon: 'spa', 
    order: 1 
  },
  'ShortTerm': { 
    label: '短線波段', 
    color: '#F59E0B', // Amber-500
    icon: 'bolt', 
    order: 2 
  },
  'HighRisk': { 
    label: '高風險策略', 
    color: '#EF4444', // Red-500
    icon: 'local_fire_department', 
    order: 3 
  }
}

// 輔助函式：為未設定的群組產生固定顏色 (String Hash -> Color)
function generateColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

export const usePortfolioStore = defineStore('portfolio', {
  state: () => ({
    // 原始完整數據 (巢狀結構)
    rawSnapshot: null,
    
    // 當前選擇的群組 ID
    currentGroupId: 'ALL',
    
    // 群組設定 (方案 B)
    groupConfig: DEFAULT_GROUP_CONFIG,
    
    loading: false,
    error: null,
    lastUpdated: null
  }),

  getters: {
    // --------------------------------------------------------
    // 1. 群組導航相關 (Navigation Getters)
    // --------------------------------------------------------
    
    /**
     * 取得所有可用群組的列表 (供 HeaderBar 切換器使用)
     * 邏輯：掃描 rawSnapshot 中的 keys，並與 groupConfig 合併
     */
    availableGroups: (state) => {
      if (!state.rawSnapshot?.groups) return []

      const apiGroups = Object.keys(state.rawSnapshot.groups)
      
      return apiGroups.map(key => {
        const config = state.groupConfig[key] || {}
        return {
          id: key,
          name: config.label || key, // 若無設定則顯示 Key
          color: config.color || generateColor(key), // 若無設定則自動產生顏色
          icon: config.icon || 'folder',
          order: config.order ?? 999
        }
      }).sort((a, b) => a.order - b.order)
    },

    // --------------------------------------------------------
    // 2. 數據視圖相關 (View Getters)
    // --------------------------------------------------------

    /**
     * 取得當前選定群組的完整數據物件
     */
    currentGroupData: (state) => {
      if (!state.rawSnapshot?.groups) return null
      return state.rawSnapshot.groups[state.currentGroupId] || null
    },

    // 以下 Getters 用於無縫替換 UI 綁定的數據源
    // 前端元件只需呼叫 store.summary，不需知道現在是哪個群組
    summary: (state) => state.currentGroupData?.summary || {},
    holdings: (state) => state.currentGroupData?.holdings || [],
    history: (state) => state.currentGroupData?.history || [],
    pendingDividends: (state) => state.currentGroupData?.pending_dividends || [],
    
    // 全域資訊 (不隨群組改變)
    exchangeRate: (state) => state.rawSnapshot?.exchange_rate || 30.0,
    baseCurrency: (state) => state.rawSnapshot?.base_currency || 'TWD',

    // --------------------------------------------------------
    // 3. 交易輔助相關 (Transaction Helper Getters)
    // --------------------------------------------------------

    /**
     * 【關鍵】賣出防呆機制專用
     * 查詢特定股票在所有群組中的庫存分佈
     * @param {string} symbol 股票代號 (e.g., 'NVDA')
     * @returns {Array} [{ groupId: 'LongTerm', qty: 50 }, ...]
     */
    getHoldingsDistribution: (state) => (symbol) => {
      if (!state.rawSnapshot?.groups) return []
      
      const distribution = []
      
      // 遍歷所有群組
      Object.entries(state.rawSnapshot.groups).forEach(([groupId, groupData]) => {
        if (groupId === 'ALL') return // 跳過總覽，只看子群組庫存
        
        const position = groupData.holdings.find(h => h.symbol === symbol)
        if (position && position.qty > 0) {
          const config = state.groupConfig[groupId] || {}
          distribution.push({
            groupId,
            groupName: config.label || groupId,
            qty: position.qty,
            color: config.color || generateColor(groupId)
          })
        }
      })
      
      return distribution
    }
  },

  actions: {
    /**
     * 載入投資組合數據
     */
    async fetchPortfolio() {
      this.loading = true
      this.error = null
      try {
        // 呼叫 Phase 1 的後端 API
        // 注意：這裡假設後端輸出的 JSON 路徑，請依實際部署調整
        // 開發環境通常是讀取 public/data/portfolio_snapshot.json 或 API 端點
        const response = await axios.get('/data/portfolio_snapshot.json?t=' + new Date().getTime())
        
        this.rawSnapshot = response.data
        this.lastUpdated = response.data.updated_at
        
        // 如果當前選的群組在新數據中不存在，重置為 ALL
        if (this.rawSnapshot.groups && !this.rawSnapshot.groups[this.currentGroupId]) {
          this.currentGroupId = 'ALL'
        }
        
      } catch (err) {
        console.error('Failed to load portfolio:', err)
        this.error = '無法載入投資組合數據，請稍後再試。'
      } finally {
        this.loading = false
      }
    },

    /**
     * 切換當前顯示的群組
     * UI 切換器呼叫此 Action 即可瞬間改變所有圖表數據
     */
    setGroupId(id) {
      if (this.rawSnapshot?.groups?.[id]) {
        this.currentGroupId = id
      }
    },

    /**
     * 強制重新整理
     */
    async refresh() {
      await this.fetchPortfolio()
    }
  }
})
