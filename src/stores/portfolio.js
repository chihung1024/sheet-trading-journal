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

    // ✅ 自訂基準標的 (從 localStorage 讀取，預設 SPY)
    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');

    // ✅ 當前選擇的群組
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

    // ✅ 清空本地數據狀態
    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        console.log('🧹 [resetData] 本地投資組合數據已清空');
    };

    const fetchAll = async () => {
        if (loading.value) {
            console.warn('⚠️ [fetchAll] 請求已在進行中，忽略此次調用');
            return;
        }

        console.log('📡 [fetchAll] 開始載入數據...');
        loading.value = true;
        
        try {
            // 1. 先抓取交易紀錄
            await fetchRecords().catch(err => {
                console.error('❌ [fetchRecords] 錯誤:', err);
                throw err;
            });
            
            // 2. 根據紀錄結果決定是否抓取快照
            if (records.value && records.value.length > 0) {
                await fetchSnapshot().catch(err => {
                    console.error('❌ [fetchSnapshot] 錯誤:', err);
                });
                console.log('✅ [fetchAll] 數據載入完成');
            } else {
                resetData(); 
                console.log('ℹ️ [fetchAll] 無交易紀錄，已強制重置本地數據');
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
                // MODIFIED: 強化重置判斷，如果後端回傳空數據且前端無紀錄，立即重置 UI
                if (!json.data.updated_at) {
                    if (records.value.length === 0) {
                        resetData();
                        console.log('✅ [fetchSnapshot] 後端已同步重置為空數據');
                    } else {
                        console.log('⏳ [fetchSnapshot] 快照計算中，暫不更新介面');
                    }
                    return;
                }

                // MODIFIED: 防止在刪除後抓到「舊的」非空快照
                if (records.value.length === 0 && json.data.holdings && json.data.holdings.length > 0) {
                    console.warn('⏳ [fetchSnapshot] 偵測到殘留的舊快照資料，略過更新');
                    return;
                }

                rawData.value = json.data; 
                lastUpdate.value = json.data.updated_at;
                console.log('✅ [fetchSnapshot] 數據已更新時間:', lastUpdate.value);
            } else {
                if (records.value.length === 0) resetData();
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
                if (records.value.length === 0) {
                    resetData();
                }
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 統一的自動更新觸發器
    const handleAutoUpdateSignal = (message = "✨ 系統正自動同步股價與數據，請稍候...") => {
        const { addToast } = useToast();
        addToast(message, "info");
        startPolling(); 
    };

    // ✅ 封裝新增交易紀錄
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

    // ✅ 封裝更新交易紀錄
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

    // ✅ 執行刪除紀錄
    const deleteRecord = async (id) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            
            if (json && json.success) {
                addToast("刪除成功", "success");
                
                // [關鍵修復] 如果收到重置信號，立即進入輪詢以監控後端清理進度
                if (json.message === "RELOAD_UI") {
                    records.value = []; // 先清空列表
                    handleAutoUpdateSignal("🧹 紀錄已清空，系統正重置資產數據..."); // MODIFIED: 同步觸發輪詢
                } else {
                    await fetchRecords();
                    startPolling();
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
        // MODIFIED: 獲取初始狀態的時間戳
        const initialTime = lastUpdate.value; 
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            if (Date.now() - startTime > 180000) { 
                console.warn('⚠️ [SmartPolling] 更新超時，停止輪詢');
                stopPolling();
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');
                
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    
                    // MODIFIED: 核心判斷邏輯
                    // 1. 標準更新：時間戳變更且有新內容。
                    const isNewData = newTime && (newTime !== initialTime) && (json.data.holdings?.length > 0 || records.value.length === 0);
                    // 2. 重置更新：當交易紀錄為 0 且後端回傳的快照時間消失（即回傳空對象），判定重置完成。
                    const isResetConfirmed = (records.value.length === 0) && !newTime;

                    if (isNewData || isResetConfirmed) {
                        console.log('✨ [SmartPolling] 狀態已同步！更新/重置成功');
                        stopPolling();
                        await fetchAll(); // 執行最終同步以歸零 UI
                        if (isResetConfirmed) addToast("✅ 所有資產數據已歸零", "success");
                        else addToast("✅ 數據已更新完畢！", "success");
                    } else {
                        console.log('💤 [SmartPolling] 正在等待後端計算/重置任務完成...'); 
                    }
                }
            } catch (e) {
                console.warn('⚠️ [SmartPolling] 檢查中:', e);
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
        addRecord,      
        updateRecord,   
        deleteRecord, 
        triggerUpdate,
        resetData,
        startPolling    
    };
});
