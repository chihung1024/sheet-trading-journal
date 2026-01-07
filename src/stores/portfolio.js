import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchPortfolioSnapshot } from '../config'

export const usePortfolioStore = defineStore('portfolio', () => {
  const lastUpdated = ref('')
  const summary = ref({
    total_value: 0,
    invested_capital: 0,
    total_pnl: 0,
    twr: 0,
    realized_pnl: 0,
    benchmark_twr: 0
  })
  const holdings = ref([])
  const history = ref([])
  // [新增] 儲存平倉數據
  const closedPositions = ref([]) 

  // 用於計算全域平倉統計
  const closedStats = computed(() => {
    if (!closedPositions.value.length) return null
    
    let totalWin = 0
    let totalLoss = 0
    let winCount = 0
    let totalCount = 0
    let totalDivs = 0

    closedPositions.value.forEach(pos => {
      // pos 是每個標的的匯總 (Symbol Level)
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

  // 將所有標的的 lots (批次) 展平，變成一個大列表供表格顯示，按平倉日期排序
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
    // 按平倉日期降序 (最新的在上面)
    return allLots.sort((a, b) => new Date(b.close_date) - new Date(a.close_date))
  })

  async function fetchSnapshot() {
    try {
      const data = await fetchPortfolioSnapshot()
      if (data) {
        lastUpdated.value = data.updated_at
        summary.value = data.summary
        holdings.value = data.holdings
        history.value = data.history
        // [新增] 接收後端傳來的 closed_positions
        closedPositions.value = data.closed_positions || []
      }
    } catch (e) {
      console.error("Failed to load portfolio data", e)
    }
  }

  return {
    lastUpdated,
    summary,
    holdings,
    history,
    closedPositions, // 匯出 state
    closedStats,     // 匯出統計
    flattenedClosedLots, // 匯出列表
    fetchSnapshot
  }
})
