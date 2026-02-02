import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const rawData = ref(null);
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 
    const isPolling = ref(false);
    let pollTimer = null;

    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
    const currentGroup = ref('all');

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
                console.warn("Token expired, logging out...");
                connectionStatus.value = 'error';
                auth.logout();
                return null;
            }

            if (!res.ok) {
                connectionStatus.value = 'error';
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `API Error: ${res.status}`);
            }

            connectionStatus.value = 'connected';
            return await res.json();
        } catch (e) {
            console.error(`Fetch error [${endpoint}]:`, e);
            connectionStatus.value = 'error';
            throw e;
        }
    };

    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        localStorage.removeItem('cached_records');
    };

    const fetchAll = async () => {
        if (loading.value) return;
        loading.value = true;
        
        try {
            await fetchRecords();
            
            // [v2.54] 從 API 獲取用戶的 benchmark 設定
            try {
                const settingsJson = await fetchWithAuth('/api/user-settings');
                if (settingsJson && settingsJson.success && settingsJson.benchmark) {
                    selectedBenchmark.value = settingsJson.benchmark;
                    localStorage.setItem('user_benchmark', settingsJson.benchmark);
                }
            } catch (e) {
                console.warn('無法載入 benchmark 設定，使用預設值', e);
            }
            
            if (records.value && records.value.length > 0) {
                await fetchSnapshot();
            } else {
                resetData();
            }
        } catch (error) {
            console.error('fetchAll error:', error);
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
        }
    };

    const fetchSnapshot = async () => {
        try {
            const json = await fetchWithAuth('/api/portfolio');
            
            if (json && json.success && json.data) {
                if (!json.data.updated_at) {
                    if (records.value.length === 0) resetData();
                    return;
                }

                if (records.value.length === 0 && json.data.holdings && json.data.holdings.length > 0) {
                    return;
                }

                rawData.value = json.data; 
                lastUpdate.value = json.data.updated_at;
            } else {
                if (records.value.length === 0) resetData();
            }
        } catch (error) {
            console.error('fetchSnapshot error:', error);
            throw error;
        }
    };

    const fetchRecords = async () => {
        try {
            const json = await fetchWithAuth('/api/records');
            
            if (json && json.success) {
                records.value = json.data || [];
                localStorage.setItem('cached_records', JSON.stringify(records.value));
                
                if (records.value.length === 0) resetData();
            }
        } catch (error) {
            console.error('fetchRecords error:', error);
            throw error;
        }
    };

    const handleAutoUpdateSignal = (message = "✨ 系統正自動同步股價與數據，請稍候...") => {
        const { addToast } = useToast();
        addToast(message, "info");
        startPolling(); 
    };

    const addRecord = async (formData) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            if (json && json.success) {
                addToast("新增成功", "success");
                await fetchRecords();
                
                if (json.auto_update) {
                    handleAutoUpdateSignal("🚀 這是您的第一筆交易，系統正自動啟動背景計算...");
                }
                return true;
            }
            return false;
        } catch (e) {
            addToast(e.message || "新增失敗", "error");
            return false;
        }
    };

    const updateRecord = async (formData) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            if (json && json.success) {
                addToast("更新成功", "success");
                await fetchRecords();
                return true;
            }
            return false;
        } catch (e) {
            addToast(e.message || "更新失敗", "error");
            return false;
        }
    };

    const deleteRecord = async (id) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            
            if (json && json.success) {
                addToast("刪除成功", "success");
                
                if (json.message === "RELOAD_UI") {
                    records.value = [];
                    handleAutoUpdateSignal("🧹 紀錄已清空，系統正重置資產數據...");
                } else {
                    await fetchRecords();
                }
                return true;
            }
            return false;
        } catch (e) {
            addToast("刪除失敗", "error");
            return false;
        }
    };

    const availableGroups = computed(() => {
        if (!rawData.value || !rawData.value.groups) return ['all'];
        return Object.keys(rawData.value.groups).sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            return a.localeCompare(b);
        });
    });

    const currentGroupData = computed(() => {
        if (!rawData.value) return {};
        if (rawData.value.groups && rawData.value.groups[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value];
        }
        return rawData.value;
    });

    const stats = computed(() => currentGroupData.value.summary || {});
    const holdings = computed(() => currentGroupData.value.holdings || []);
    const history = computed(() => currentGroupData.value.history || []);
    const pending_dividends = computed(() => currentGroupData.value.pending_dividends || []);
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
    const dailyPnL = computed(() => stats.value.daily_pnl_twd || 0);

    // [v3.18] 新增：即時市值變動追蹤
    const liveMtmDelta = computed(() => stats.value.live_mtm_delta_twd || 0);
    const liveMtmDeltaBreakdown = computed(() => stats.value.live_mtm_delta_breakdown || null);
    const liveMtmRefTimestamp = computed(() => stats.value.live_mtm_ref_timestamp || '');

    const setGroup = (group) => {
        if (availableGroups.value.includes(group)) {
            currentGroup.value = group;
        }
    };

    const getGroupsWithHolding = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        const groups = [];
        for (const [groupName, data] of Object.entries(rawData.value.groups)) {
            if (groupName === 'all') continue;
            const hasStock = data.holdings.some(h => h.symbol === symbol && h.qty > 0);
            if (hasStock) groups.push(groupName);
        }
        return groups;
    };

    const startPolling = () => {
        if (isPolling.value) return;
        
        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value; 
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            if (Date.now() - startTime > 180000) {
                stopPolling();
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');
                
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    const isNewData = newTime && (newTime !== initialTime) && (json.data.holdings?.length > 0 || records.value.length === 0);
                    const isResetConfirmed = (records.value.length === 0) && !newTime;

                    if (isNewData || isResetConfirmed) {
                        stopPolling();
                        await fetchAll();
                        if (isResetConfirmed) addToast("✅ 所有資產數據已歸零", "success");
                        else addToast("✅ 數據已更新完畢！", "success");
                    }
                }
            } catch (e) {
                console.warn('SmartPolling check error:', e);
            }
        }, 5000); 
    };

    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    // [v2.54] 修改 triggerUpdate 函數，先保存 benchmark 到資料庫
    const triggerUpdate = async (benchmark = null) => {
        const token = getToken();
        if (!token) throw new Error("請先登入"); 
        
        // 如果提供了新的 benchmark，先保存到資料庫
        if (benchmark && benchmark !== selectedBenchmark.value) {
            try {
                const saveResponse = await fetch(`${CONFIG.API_BASE_URL}/api/user-settings`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ benchmark: benchmark.toUpperCase().trim() })
                });
                
                if (!saveResponse.ok) {
                    throw new Error('無法保存 benchmark 設定');
                }
                
                const saveJson = await saveResponse.json();
                if (saveJson.success) {
                    selectedBenchmark.value = saveJson.benchmark;
                    localStorage.setItem('user_benchmark', saveJson.benchmark);
                }
            } catch (e) {
                console.error('保存 benchmark 失敗:', e);
                throw new Error('無法保存 benchmark 設定: ' + e.message);
            }
        }
        
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
        liveMtmDelta,           // [v3.18] 新增
        liveMtmDeltaBreakdown,  // [v3.18] 新增
        liveMtmRefTimestamp,    // [v3.18] 新增
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