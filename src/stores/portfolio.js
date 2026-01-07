import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CONFIG } from '../config' // 修正：改回引用 CONFIG 常數
import { useAuthStore } from './auth' // 修正：引用 Auth Store 以獲取 Token

export const usePortfolioStore = defineStore('portfolio', () => {
  const loading = ref(false)
  
  // 為了相容性，保留原本的 stats 命名 (對應 summary)
  const stats = ref({
    total_value: 0,
    invested_capital: 0,
    total_pnl: 0,
    twr: 0,
    realized_pnl: 0,
    benchmark_twr: 0
  })
  
  const holdings = ref([])
  const history = ref([])
  const records = ref([]) // 保留：交易紀錄
  const lastUpdate = ref('')
  
  // [新增] 儲存平倉數據
  const closedPositions = ref([]) 

  // 內部 helper: 獲取 Token
  const getToken = () => {
    const auth = useAuthStore()
    return auth.token
  }

  // [新增] 用於計算全域平倉統計
  const closedStats = computed(() => {
    if (!closedPositions.value.length) return null
    
    let totalWin = 0
    let totalLoss = 0
    let winCount = 0
    let totalCount = 0
    let totalDivs = 0

    closedPositions.value.forEach(pos => {
      if(pos.total_realized_pnl > 0) winCount++
      totalCount++
      if(pos.total_realized_pnl > 0) totalWin += pos.total_realized_pnl
      else totalLoss += pos.total_realized_pnl
      
      totalDivs += pos.total_dividends || 0
    })

    return {
      winRate: totalCount > 0 ? (winCount / totalCount * 100) : 0,
      totalWin,
      totalLoss,
      totalDivs,
      count: totalCount
    }
  })

  // [新增] 將所有標的的 lots (批次) 展平，供表格顯示
  const flattenedClosedLots = computed(() => {
    let allLots = []
    closedPositions.value.forEach(pos => {
      if (pos.lots && pos.lots.length) {
        pos.lots.forEach(lot => {
          allLots.push({
            symbol: pos.symbol,
            ...lot
          })
        })
      }
    })
    return allLots.sort((a, b) => new Date(b.close_date) - new Date(a.close_date))
  })

  // 保留：未實現損益 Getter
  const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0))

  // 核心功能：獲取投資組合快照 (修正版)
  async function fetchSnapshot() {
    const token = getToken()
    if (!token) return

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/portfolio`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const json = await res.json()
      if (json.success && json.data) {
        stats.value = json.data.summary || {}
        holdings.value = json.data.holdings || []
        history.value = json.data.history || []
        lastUpdate.value = json.data.updated_at
        // [新增] 接收後端傳來的 closed_positions
        closedPositions.value = json.data.closed_positions || []
      } else {
        console.warn("Fetch Snapshot Failed:", json.error)
      }
    } catch (e) {
      console.error("Failed to load portfolio data", e)
    }
  }

  // 保留：獲取交易紀錄 (用於 Journal 頁面)
  async function fetchRecords() {
    const token = getToken()
    if(!token) return
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const json = await res.json()
      if(json.success) records.value = json.data
    } catch (e) { console.error("Records Error", e) }
  }

  // 保留：一次獲取所有資料
  async function fetchAll() {
    loading.value = true
    await Promise.all([fetchSnapshot(), fetchRecords()])
    loading.value = false
  }

  // 保留：觸發後端計算
  async function triggerUpdate() {
    const token = getToken()
    if(!confirm("確定要觸發後端計算嗎？")) return
    try {
      await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` }
      })
      alert("已觸發更新，請稍待片刻後重新整理。")
    } catch(e) { alert("Trigger failed") }
  }

  return {
    loading,
    stats, // 維持名稱相容性
    holdings,
    history,
    records,
    lastUpdate,
    unrealizedPnL,
    
    // 新增導出
    closedPositions,
    closedStats,
    flattenedClosedLots,
    
    // Actions
    fetchSnapshot,
    fetchRecords,
    fetchAll,
    triggerUpdate
  }
})
