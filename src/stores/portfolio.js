import { defineStore } from 'pinia'
import axios from 'axios'
import { getTransactions, triggerCalculation } from '../js/api'

// ==========================================
// 群組元數據設定 (Group Metadata Config)
// 定義各群組的顯示名稱、顏色與圖示
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

// 輔助函式：為未設定的群組自動產生固定顏色 (String Hash -> Color)
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
    // 1. 投資組合快照 (Snapshot) - 來自 Python 計算結果 (包含多群組數據)
    rawSnapshot: null,
    
    // 2. 原始交易列表 (Records) - 用於列表顯示與編輯
    records: [], 
    
    // 當前選擇的群組 ID (預設 ALL)
    currentGroupId: 'ALL',
    
    // 群組設定 (用於 UI 顯示)
    groupConfig: DEFAULT_GROUP_CONFIG,
    
    // 系統狀態
    loading: false,
    isPolling: false, // 是否正在輪詢後端更新
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
     * 載入所有數據 (Snapshot + Records)
     * 初始化 App 時呼叫
     */
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        await Promise.all([
          this.fetchPortfolio(),
          this.fetchRecords()
        ])
      } catch (err) {
        console.error('Fetch All Error:', err)
        this.error = '部分數據載入失敗'
      } finally {
        this.loading = false
      }
    },

    /**
     * 載入投資組合計算快照 (JSON)
     */
    async fetchPortfolio() {
      try {
        // 加入 timestamp 防止快取
        const response = await axios.get('/data/portfolio_snapshot.json?t=' + new Date().getTime())
        
        this.rawSnapshot = response.data
        this.lastUpdated = response.data.updated_at
        
        // 如果當前選的群組在新數據中不存在，重置為 ALL
        if (this.rawSnapshot.groups && !this.rawSnapshot.groups[this.currentGroupId]) {
          this.currentGroupId = 'ALL'
        }
        
      } catch (err) {
        console.error('Failed to load portfolio snapshot:', err)
        throw err // 讓 fetchAll 捕獲
      }
    },

    /**
     * 載入原始交易記錄列表 (用於 RecordList)
     */
    async fetchRecords() {
      try {
        const data = await getTransactions()
        this.records = data || []
      } catch (err) {
        console.error('Failed to load records:', err)
        this.error = '無法載入交易記錄'
        // 不 throw，避免影響 Dashboard 顯示
      }
    },

    /**
     * 切換當前顯示的群組
     */
    setGroupId(id) {
      if (this.rawSnapshot?.groups?.[id]) {
        this.currentGroupId = id
      }
    },

    /**
     * 觸發後端計算並開始輪詢 (Polling)
     */
    async triggerUpdate() {
      this.isPolling = true;
      try {
        // 1. 呼叫後端 API 觸發 GitHub Actions 或計算腳本
        await triggerCalculation();
        
        // 2. 開始輪詢檢查數據是否更新
        this.pollForUpdates(this.lastUpdated);
      } catch (error) {
        console.error("Trigger update failed:", error);
        this.isPolling = false;
        throw error;
      }
    },

    /**
     * 輪詢機制：定期檢查 JSON 檔案的 updated_at 是否改變
     */
    async pollForUpdates(previousTime) {
      let attempts = 0;
      const maxAttempts = 24; // 最長輪詢 2 分鐘 (5秒 * 24次)
      
      const interval = setInterval(async () => {
        attempts++;
        try {
          const response = await axios.get('/data/portfolio_snapshot.json?t=' + new Date().getTime());
          const newTime = response.data.updated_at;
          
          if (newTime !== previousTime) {
            // 數據已更新！
            console.log("Data updated detected!", newTime);
            this.rawSnapshot = response.data;
            this.lastUpdated = newTime;
            this.isPolling = false;
            clearInterval(interval);
            
            // 順便更新交易列表，確保一致性
            this.fetchRecords(); 
          }
        } catch (e) { 
          console.log("Polling check failed, retrying..."); 
        }

        if (attempts >= maxAttempts) {
          console.warn("Polling timeout.");
          this.isPolling = false;
          clearInterval(interval);
        }
      }, 5000); // 每 5 秒檢查一次
    },

    /**
     * 強制重新整理
     */
    async refresh() {
      await this.fetchAll()
    }
  }
})
