import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const rawData = ref(null); // 儲存原始完整資料 (包含 groups)
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 
    const isPolling = ref(false);
    let pollTimer = null;

    // 自訂基準標的 (從 localStorage 讀取，預設 SPY)
    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');

    // 當前選擇的群組
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

    /**
     * ✅ 新增：清空本地數據狀態
     * 用於交易紀錄歸零時，確保 UI 不會顯示任何殘留的計算結果
     */
    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        console.log('🧹 [resetData] 本地投資組合數據已清空 (歸零狀態)');
    };

    const fetchAll = async () => {
        if (loading.value) {
            console.warn('⚠️ [fetchAll] 請求已在進行中，忽略此次調用');
            return;
        }

        console.log('📡 [fetchAll] 開始載入數據...');
        loading.value = true;
        
        try {
            // 1. 先抓取交易紀錄 (這是數據的唯一真實來源)
            await fetchRecords().catch(err => {
                console.error('❌ [fetchRecords] 錯誤:', err);
                throw err;
            });
            
            // 2. 根據紀錄結果決定是否抓取快照
            // 如果紀錄已經歸零，則強制重置本地狀態，不再請求可能過時的快照
            if (records.value && records.value.length > 0) {
                await fetchSnapshot().catch(err => {
                    console.error('❌ [fetchSnapshot] 錯誤:', err);
                });
                console.log('✅ [fetchAll] 數據載入完成 (包含快照)');
            } else {
                resetData(); 
                console.log('ℹ️ [fetchAll] 無交易紀錄，已強制重置本地數據為零');
            }
        } catch (error) {
            console.error('❌ [fetchAll] 發生嚴重錯誤:', error);
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
        }
    };

    const fetchSnapshot = async () => {
        console.log('📊 [fetchSnapshot] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/portfolio');
            
            if (json && json.success && json.data) {
                // 如果後端回傳的是空結構，或沒有更新時間，視為需要重置
                if (!json.data.updated_at || (json.data.holdings && json.data.holdings.length === 0 && records.value.length === 0)) {
                    resetData();
                    return;
                }
                rawData.value = json.data; 
                lastUpdate.value = json.data.updated_at;
                console.log('✅ [fetchSnapshot] 數據已更新');
            } else {
                console.warn('⚠️ [fetchSnapshot] 數據格式異常或無資料，執行重置');
                resetData();
            }
        } catch (error) {
            console.error('❌ [fetchSnapshot] 請求失敗:', error);
            throw error;
        }
    };

    const fetchRecords = async () => {
        console.log('📝 [fetchRecords] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/records');
            
            if (json && json.success) {
                records.value = json.data || [];
                console.log('✅ [fetchRecords] 數據已載入，共', records.value.length, '筆');
                
                // 如果紀錄清空了，主動清理 Snapshot
                if (records.value.length === 0) {
                    resetData();
                }
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error;
        }
    };

    /**
     * ✅ 改寫：執行刪除紀錄
     * 對接 Worker 的 RELOAD_UI 信號，處理紀錄歸零情境
     */
    const deleteRecord = async (id) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            
            if (json && json.success) {
                // [關鍵修復] 如果收到重置信號 (代表這是最後一筆紀錄)，立即秒殺本地狀態
                if (json.message === "RELOAD_UI") {
                    resetData();
                    addToast("所有數據已清空", "success");
                } else {
                    addToast("刪除成功", "success");
                    await fetchRecords();
                    startPolling(); // 啟動輪詢等待更新
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
        
        console.log('⌛ [SmartPolling] 開始監控數據更新...');
        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value;
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            // 超過 3 分鐘停止輪詢
            if (Date.now() - startTime > 180000) {
                stopPolling();
                addToast("⚠️ 更新等待超時，請稍後手動重新整理", "error");
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    if (newTime !== initialTime) {
                        stopPolling();
                        await fetchAll();
                        addToast("✅ 數據已更新完畢！", "success");
                    }
                }
            } catch (e) {
                console.warn('⚠️ [SmartPolling] 檢查失敗:', e);
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

    const triggerUpdate = async (benchmark = null) => {
        const token = getToken();
        if (!token) throw new Error("請先登入"); 
        
        const targetBenchmark = benchmark || selectedBenchmark.value;
        if (benchmark) {
            selectedBenchmark.value = benchmark;
            localStorage.setItem('user_benchmark', benchmark);
        }
        
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
                startPolling(); 
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
        stats, 
        holdings, 
        history, 
        records, 
        pending_dividends,
        lastUpdate, 
        unrealizedPnL, 
        connectionStatus,
        isPolling,
        currentGroup,
        availableGroups,
        selectedBenchmark,
        setGroup,
        getGroupsWithHolding,
        fetchAll, 
        fetchRecords, 
        deleteRecord, 
        triggerUpdate,
        resetData
    };
});
