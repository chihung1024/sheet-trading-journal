import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    // --- 狀態定義 ---
    const loading = ref(false);
    const rawData = ref(null);      // 儲存從 API 獲取的完整快照 (PortfolioSnapshot)
    const records = ref([]);        // 儲存交易紀錄列表
    const lastUpdate = ref('');     // 最後更新時間字串
    const connectionStatus = ref('connected'); 
    const isPolling = ref(false);
    let pollTimer = null;

    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
    const currentGroup = ref('all'); // 目前選擇的顯示群組 (標籤)

    // --- 工具函式 ---
    const getToken = () => {
        const auth = useAuthStore();
        return auth.token;
    };

    const { addToast } = useToast();

    /**
     * 封裝帶有認證標頭的 Fetch 請求
     */
    const fetchWithAuth = async (endpoint, options = {}) => {
        const auth = useAuthStore();
        if (!auth.token) return null;

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.status === 401) {
                console.warn("Token expired, logging out...");
                connectionStatus.value = 'error';
                auth.logout();
                return null;
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            return await res.json();
        } catch (e) {
            console.error(`API Error [${endpoint}]:`, e);
            throw e;
        }
    };

    // --- 計算屬性 (Getters) ---

    /**
     * 🚀 [v14.0] 根據 currentGroup 動態回傳摘要數據
     */
    const stats = computed(() => {
        if (!rawData.value) return null;
        // 如果選擇特定群組，從 groups 字典中提取
        if (currentGroup.value !== 'all' && rawData.value.groups?.[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value].summary;
        }
        // 否則回傳全體摘要
        return rawData.value.summary;
    });

    /**
     * 🚀 [v14.0] 根據 currentGroup 動態回傳持倉清單
     */
    const holdings = computed(() => {
        if (!rawData.value) return [];
        if (currentGroup.value !== 'all' && rawData.value.groups?.[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value].holdings || [];
        }
        return rawData.value.holdings || [];
    });

    /**
     * 🚀 [v14.0] 根據 currentGroup 動態回傳歷史淨值數據 (用於圖表)
     */
    const history = computed(() => {
        if (!rawData.value) return [];
        if (currentGroup.value !== 'all' && rawData.value.groups?.[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value].history || [];
        }
        return rawData.value.history || [];
    });

    /**
     * 🚀 [v14.0] 根據 currentGroup 動態回傳待入帳配息
     */
    const pending_dividends = computed(() => {
        if (!rawData.value) return [];
        if (currentGroup.value !== 'all' && rawData.value.groups?.[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value].pending_dividends || [];
        }
        return rawData.value.pending_dividends || [];
    });

    /** 累計未實現損益 */
    const unrealizedPnL = computed(() => stats.value?.total_pnl || 0);
    
    /** 🚀 [v14.0] 當日損益 (對齊後端 NAV 欄位) */
    const dailyPnL = computed(() => stats.value?.daily_pnl_twd || 0);

    /** 獲取所有可用的群組標籤清單 */
    const availableGroups = computed(() => {
        if (!rawData.value || !rawData.value.groups) return ['all'];
        return Object.keys(rawData.value.groups).sort();
    });

    // --- 行動 (Actions) ---

    const setGroup = (groupName) => {
        currentGroup.value = groupName;
    };

    /** 查詢包含特定股票的標籤群組 */
    const getGroupsWithHolding = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        return Object.entries(rawData.value.groups)
            .filter(([name, data]) => name !== 'all' && data.holdings.some(h => h.symbol === symbol))
            .map(([name]) => name);
    };

    /** 獲取最新投資組合快照 */
    const fetchAll = async () => {
        loading.value = true;
        try {
            const res = await fetchWithAuth('/api/portfolio');
            if (res && res.success) {
                rawData.value = res.data;
                lastUpdate.value = res.data.updated_at || '';
                connectionStatus.value = 'connected';
            }
        } catch (e) {
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
        }
    };

    /** 獲取原始交易紀錄 */
    const fetchRecords = async () => {
        try {
            const res = await fetchWithAuth('/api/records');
            if (res && res.success) {
                records.value = res.data;
            }
        } catch (e) {
            console.error('Fetch records failed');
        }
    };

    /** 新增交易紀錄 */
    const addRecord = async (record) => {
        const res = await fetchWithAuth('/api/records', {
            method: 'POST',
            body: JSON.stringify(record)
        });
        if (res?.success) {
            await fetchRecords();
            return true;
        }
        return false;
    };

    /** 更新交易紀錄 */
    const updateRecord = async (record) => {
        const res = await fetchWithAuth('/api/records', {
            method: 'PUT',
            body: JSON.stringify(record)
        });
        if (res?.success) {
            await fetchRecords();
            return true;
        }
        return false;
    };

    /** 刪除交易紀錄 */
    const deleteRecord = async (id) => {
        const res = await fetchWithAuth('/api/records', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        if (res?.success) {
            if (res.message === "RELOAD_UI") {
                resetData();
            } else {
                await fetchRecords();
            }
            return true;
        }
        return false;
    };

    /** * 觸發 GitHub Action 進行背景數據重算 
     * @param {string} benchmark 指定使用的基準指數
     */
    const triggerUpdate = async (benchmark = null) => {
        const auth = useAuthStore();
        const token = auth.token;
        if (!token) return;

        const handleAutoUpdateSignal = (msg) => {
            if (addToast) {
                addToast(msg, 'info');
            }
        };
        
        const targetBenchmark = benchmark || selectedBenchmark.value;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ benchmark: targetBenchmark })
            });
            
            if (response.ok || response.status === 204) {
                handleAutoUpdateSignal("🔄 已手動觸發數據重算，正在同步中..."); 
                return true; 
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '後端無回應');
            }
        } catch (e) { 
            console.error('Trigger failed:', e);
            throw e; 
        }
    };

    /** 清空所有數據狀態 (登出用) */
    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        currentGroup.value = 'all';
    };

    /** 啟動定時輪詢，自動更新數據 */
    const startPolling = (interval = 300000) => { // 預設 5 分鐘
        if (isPolling.value) return;
        isPolling.value = true;
        
        const poll = async () => {
            if (!isPolling.value) return;
            try {
                await fetchAll();
            } catch (e) {
                console.warn('Polling fetch failed');
            }
            pollTimer = setTimeout(poll, interval);
        };
        
        poll();
    };

    return { 
        loading, 
        rawData,
        stats, 
        holdings, 
        history, 
        records, 
        pending_dividends,
        lastUpdate, 
        unrealizedPnL,
        dailyPnL,
        connectionStatus,
        isPolling,
        currentGroup,
        availableGroups,
        selectedBenchmark,
        setGroup,
        getGroupsWithHolding,
        fetchAll, 
        fetchRecords, 
        addRecord,      
        updateRecord,   
        deleteRecord, 
        triggerUpdate,
        resetData,
        startPolling    
    };
});
