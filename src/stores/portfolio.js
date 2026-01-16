import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const { addToast } = useToast();
    
    // --- State ---
    const loading = ref(false);
    const rawData = ref(null); // 儲存後端回傳的完整 Snapshot (包含 groups)
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 
    const isPolling = ref(false);
    let pollTimer = null;

    // 當前選擇的策略群組 (預設為 'all')
    const currentGroup = ref('all');

    // --- Actions: 基礎 API 呼叫 ---
    const getToken = () => {
        const auth = useAuthStore();
        return auth.token;
    };

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
                auth.logout(); 
                return null; 
            }
            
            if (!res.ok) {
                throw new Error(`API Error: ${res.status}`);
            }

            connectionStatus.value = 'connected';
            return await res.json();
        } catch (e) { 
            connectionStatus.value = 'error'; 
            console.error("Fetch error:", e);
            throw e; 
        }
    };

    // --- Actions: 數據獲取 ---
    const fetchAll = async () => {
        if (loading.value) return;
        loading.value = true;
        try {
            await Promise.all([fetchSnapshot(), fetchRecords()]);
        } catch (error) { 
            console.error("Failed to fetch all data:", error);
            // 這裡不 throw，避免阻斷 UI 渲染，讓個別組件處理錯誤狀態
        } finally { 
            loading.value = false; 
        }
    };

    const fetchSnapshot = async () => {
        try {
            const json = await fetchWithAuth('/api/portfolio');
            if (json && json.success && json.data) {
                rawData.value = json.data;
                lastUpdate.value = json.data.updated_at;
            }
        } catch (error) { 
            throw error; 
        }
    };

    const fetchRecords = async () => {
        try {
            const json = await fetchWithAuth('/api/records');
            if (json && json.success) {
                records.value = json.data || [];
            }
        } catch (error) { 
            throw error; 
        }
    };

    const addRecord = async (record) => {
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'POST',
                body: JSON.stringify(record)
            });
            if (json && json.success) {
                await fetchRecords(); // 重新獲取列表
                return true;
            }
            throw new Error(json?.error || 'Add failed');
        } catch (e) { throw e; }
    };

    const updateRecord = async (record) => {
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'PUT',
                body: JSON.stringify(record)
            });
            if (json && json.success) {
                await fetchRecords();
                return true;
            }
            throw new Error(json?.error || 'Update failed');
        } catch (e) { throw e; }
    };

    const deleteRecord = async (id) => {
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            if (json && json.success) {
                await fetchRecords();
                return true;
            }
            throw new Error(json?.error || 'Delete failed');
        } catch (e) { throw e; }
    };

    const triggerUpdate = async () => {
        try {
            await fetchWithAuth('/api/update', { method: 'POST' });
            // 觸發後端更新後，稍微延遲再拉取最新數據
            setTimeout(() => fetchAll(), 2000); 
        } catch (e) { console.error(e); }
    };

    // --- Actions: 群組操作邏輯 ---
    
    // 切換當前視圖群組
    const setGroup = (group) => {
        currentGroup.value = group;
    };

    /**
     * 取得某支股票在各個群組的持倉分佈
     * 用於 TradeForm 的賣出智慧檢核
     * @param {string} symbol 股票代碼
     * @returns {Array} [{ group: string, qty: number, pnl: number }]
     */
    const getHoldingDistribution = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        
        const result = [];
        const targetSym = symbol.toUpperCase();

        // 遍歷所有群組 (排除 all)
        for (const [groupName, data] of Object.entries(rawData.value.groups)) {
            if (groupName === 'all') continue;
            
            const position = data.holdings.find(h => h.symbol === targetSym && h.qty > 0);
            if (position) {
                result.push({
                    group: groupName,
                    qty: position.qty,
                    pnl: position.pnl_percent
                });
            }
        }
        return result.sort((a, b) => b.qty - a.qty);
    };

    /**
     * 取得某支股票在當前群組是否持有
     * @param {string} symbol 
     */
    const hasHoldingInCurrentGroup = (symbol) => {
        const h = holdings.value.find(item => item.symbol === symbol.toUpperCase());
        return h && h.qty > 0;
    };

    // --- Computed: 動態數據解析 ---

    // 取得所有可用群組列表 (從 rawData 解析)
    const availableGroups = computed(() => {
        if (!rawData.value || !rawData.value.groups) return ['all'];
        // 取得 keys 並排除 all (之後手動加回第一位)
        const groups = Object.keys(rawData.value.groups).filter(k => k !== 'all').sort();
        return ['all', ...groups];
    });

    // 核心 Computed: 根據 currentGroup 動態決定要顯示哪一份數據
    const currentGroupData = computed(() => {
        if (!rawData.value) return {};
        
        // 優先嘗試從 groups 字典取值
        if (rawData.value.groups && rawData.value.groups[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value];
        }
        
        // 若找不到 (或資料結構舊版)，回傳頂層結構 (相容性處理)
        return rawData.value;
    });

    // 以下所有 UI 綁定的數據，都依賴 currentGroupData
    const stats = computed(() => currentGroupData.value.summary || {});
    const holdings = computed(() => currentGroupData.value.holdings || []);
    const history = computed(() => currentGroupData.value.history || []);
    const pending_dividends = computed(() => currentGroupData.value.pending_dividends || []);
    
    const unrealizedPnL = computed(() => {
        const val = stats.value.total_value || 0;
        const cap = stats.value.invested_capital || 0;
        return val - cap;
    });

    // --- Polling Logic ---
    const startPolling = () => {
        if (isPolling.value) return;
        isPolling.value = true;
        fetchAll(); // 立即執行一次
        pollTimer = setInterval(fetchAll, 60000); // 每分鐘更新
    };

    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    };

    return { 
        // State
        loading, 
        records, 
        lastUpdate, 
        connectionStatus, 
        isPolling,
        currentGroup, // 匯出當前群組狀態

        // Getters
        stats, 
        holdings, 
        history, 
        pending_dividends, 
        unrealizedPnL,
        availableGroups, // 匯出可用群組列表
        
        // Actions
        fetchAll, 
        fetchRecords, 
        addRecord, 
        updateRecord, 
        deleteRecord, 
        triggerUpdate,
        startPolling, 
        stopPolling,
        setGroup,             // 匯出切換群組方法
        getHoldingDistribution, // 匯出持倉分佈查詢方法
        hasHoldingInCurrentGroup
    };
});
