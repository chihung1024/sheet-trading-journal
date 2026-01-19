import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { API_BASE_URL } from '../config';

// 初始空的投資組合結構，用於重置
const getInitialPortfolio = () => ({
  summary: {
    total_value: 0,
    invested_capital: 0,
    total_pnl: 0,
    twr: 0,
    xirr: 0,
    realized_pnl: 0,
    benchmark_twr: 0
  },
  holdings: [],
  history: [],
  pending_dividends: [],
  groups: {
    all: {
      summary: { total_value: 0, invested_capital: 0, total_pnl: 0, twr: 0, xirr: 0, realized_pnl: 0, benchmark_twr: 0 },
      holdings: [],
      history: [],
      pending_dividends: []
    }
  },
  updated_at: null,
  exchange_rate: 1
});

export const usePortfolioStore = defineStore('portfolio', {
  state: () => ({
    portfolio: getInitialPortfolio(),
    records: [],
    loading: false,
    error: null,
    lastUpdate: null,
    currentGroup: 'all'
  }),

  getters: {
    // 取得當前選定群組的數據，若無則回傳 all
    currentData: (state) => {
      if (state.portfolio?.groups && state.portfolio.groups[state.currentGroup]) {
        return state.portfolio.groups[state.currentGroup];
      }
      return state.portfolio?.groups?.all || getInitialPortfolio().groups.all;
    },
    availableGroups: (state) => {
      return state.portfolio?.groups ? Object.keys(state.portfolio.groups) : ['all'];
    }
  },

  actions: {
    // 獲取投資組合快照
    async fetchPortfolio() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        const response = await fetch(`${API_BASE_URL}/portfolio`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        });
        const result = await response.json();
        
        if (result.success && result.data && Object.keys(result.data.summary || {}).length > 0) {
          this.portfolio = result.data;
        } else {
          // 關鍵修正：若 API 回傳成功但無數據 (已被清空)，則重置為初始狀態
          this.portfolio = getInitialPortfolio();
        }
        this.lastUpdate = new Date();
      } catch (err) {
        console.error('Fetch portfolio failed:', err);
        this.error = '無法獲取投資組合數據';
      } finally {
        this.loading = false;
      }
    },

    // 獲取交易紀錄
    async fetchRecords() {
      const authStore = useAuthStore();
      try {
        const response = await fetch(`${API_BASE_URL}/records`, {
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        });
        const result = await response.json();
        if (result.success) {
          this.records = result.data;
        }
      } catch (err) {
        this.error = '無法獲取交易紀錄';
      }
    },

    // 刪除紀錄 (修正版：連動更新快照)
    async deleteRecord(id) {
      const authStore = useAuthStore();
      try {
        const response = await fetch(`${API_BASE_URL}/records`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          },
          body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        if (result.success) {
          // 1. 更新本地紀錄清單
          this.records = this.records.filter(r => r.id !== id);
          
          // 2. 關鍵修正：刪除後立即觸發快照抓取。
          // 若這是最後一筆紀錄，Worker 會刪除快照，此處將會抓到「歸零」的資料。
          await this.fetchPortfolio();
          return true;
        }
      } catch (err) {
        this.error = '刪除失敗';
        return false;
      }
    },

    // 切換群組
    setGroup(groupName) {
      this.currentGroup = groupName;
    }
  }
});
