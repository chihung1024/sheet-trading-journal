import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';
import { GroupManager } from '../config/groups';  // ✅ 新增

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const stats = ref({});
    const holdings = ref([]);
    const history = ref([]);
    const records = ref([]);
    const pending_dividends = ref([]);  // ✅ 新增：待確認配息列表
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 

    // ✅ 新增：輪詢控制變數
    const isPolling = ref(false);
    let pollTimer = null;

    // ✅ 新增：群組相關狀態
    const groupManager = new GroupManager();
    const currentGroupId = ref('all');  // 當前選中的群組 ID
    const groupSnapshots = ref({});     // 儲存各群組的快照 { 'all': {...}, 'long-term': {...} }
    const showGroupManagerModal = ref(false);  // 群組管理器 Modal 顯示狀態

    // ✅ 保留：Tag 1.10 的 getToken 方法
    const getToken = () => {
        const auth = useAuthStore();
        return auth.token;
    };

    // ✅ 保留：新版的 fetchWithAuth（統一錯誤處理）
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

    // ✅ 修改：加入請求去重邏輯
    const fetchAll = async () => {
        // 如果正在載入中，直接忽略這次請求，防止重複觸發
        if (loading.value) {
            console.warn('⚠️ [fetchAll] 請求已在進行中，忽略此次調用');
            return;
        }

        console.log('📡 [fetchAll] 開始載入數據...');
        loading.value = true;
        
        try {
            await Promise.all([
                fetchSnapshot().catch(err => {
                    console.error('❌ [fetchSnapshot] 錯誤:', err);
                }),
                fetchRecords().catch(err => {
                    console.error('❌ [fetchRecords] 錯誤:', err);
                })
            ]);
            
            // ✅ 新增：載入後自動計算當前群組快照
            if (currentGroupId.value !== 'all') {
                calculateGroupSnapshot(currentGroupId.value);
            }
            
            console.log('✅ [fetchAll] 數據載入完成');
        } catch (error) {
            console.error('❌ [fetchAll] 發生嚴重錯誤:', error);
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
            console.log('🏁 [fetchAll] loading 狀態已重置為 false');
        }
    };


    // ✅ 修復：增強的 fetchSnapshot
    const fetchSnapshot = async () => {
        console.log('📊 [fetchSnapshot] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/portfolio');
            console.log('📊 [fetchSnapshot] API 回應:', json);
            
            if (json && json.success && json.data) {
                stats.value = json.data.summary || {};
                holdings.value = json.data.holdings || [];
                history.value = json.data.history || [];
                pending_dividends.value = json.data.pending_dividends || [];  // ✅ 新增
                lastUpdate.value = json.data.updated_at; // 更新時間
                
                // ✅ 儲存「全部紀錄」的快照
                groupSnapshots.value['all'] = {
                    summary: stats.value,
                    holdings: holdings.value,
                    history: history.value,
                    updated_at: lastUpdate.value
                };
                
                console.log('✅ [fetchSnapshot] 數據已更新，待確認配息:', pending_dividends.value.length, '筆');
            } else {
                console.warn('⚠️ [fetchSnapshot] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchSnapshot] 請求失敗:', error);
            throw error; // 抛出讓 fetchAll 捕捉
        }
    };

    // ✅ 修復：增強的 fetchRecords
    const fetchRecords = async () => {
        console.log('📝 [fetchRecords] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/records');
            console.log('📝 [fetchRecords] API 回應:', json);
            
            if (json && json.success) {
                records.value = json.data || [];
                console.log('✅ [fetchRecords] 數據已更新，共', records.value.length, '筆');
            } else {
                console.warn('⚠️ [fetchRecords] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error; // 抛出讓 fetchAll 捕捉
        }
    };

    // ✅ 新增：智慧輪詢函式 (Smart Polling)
    const startPolling = () => {
        if (isPolling.value) return;
        
        console.log('⌛ [SmartPolling] 開始監控數據更新...');
        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value; // 記錄當前的更新時間
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            // 1. 超時檢查 (例如 3 分鐘後放棄)
            if (Date.now() - startTime > 180000) {
                console.warn('⚠️ [SmartPolling] 更新超時，停止輪詢');
                stopPolling();
                addToast("⚠️ 更新等待超時，請稍後手動重新整理", "error");
                return;
            }

            try {
                // 2. 輕量檢查 (只抓 Snapshot 檢查 updated_at)
                const json = await fetchWithAuth('/api/portfolio');
                
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    
                    // 3. 比對時間：如果新時間與舊時間不同，代表 GitHub Actions 跑完了
                    if (newTime !== initialTime) {
                        console.log('✨ [SmartPolling] 偵測到新數據！時間:', newTime);
                        
                        stopPolling(); // 先停止輪詢
                        await fetchAll(); // 正式抓取並更新畫面
                        
                        addToast("✅ 數據已更新完畢！", "success");
                    } else {
                        console.log('💤 [SmartPolling] 數據尚未變更...');
                    }
                }
            } catch (e) {
                console.warn('⚠️ [SmartPolling] 檢查失敗:', e);
            }
        }, 5000); // 每 5 秒檢查一次
    };

    // ✅ 新增：停止輪詢
    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    // ✅ 修改：觸發更新邏輯
    const triggerUpdate = async () => {
        const token = getToken();
        if (!token) throw new Error("請先登入"); 
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok || response.status === 204) {
                // 成功：啟動輪詢，等待 GitHub Actions 完成
                startPolling(); 
                return true; 
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Trigger Error:', errorData);
                throw new Error(errorData.error || '後端無回應');
            }
        } catch (e) { 
            console.error('Trigger failed:', e);
            throw e; 
        }
    };

    // ✅ 新增：前端即時計算群組快照
    const calculateGroupSnapshot = (groupId) => {
        const group = groupManager.getGroup(groupId);
        if (!group || groupId === 'all') return;
        
        console.log(`📊 計算群組快照: ${group.name} (${groupId})`);
        
        // 篩選該群組的交易紀錄
        const filteredRecords = records.value.filter(record => {
            const recordGroups = groupManager.getRecordGroups(record.tag);
            return recordGroups.includes(groupId);
        });
        
        // 篩選該群組的持倉
        const filteredHoldings = holdings.value.filter(holding => {
            const relatedRecords = filteredRecords.filter(r => r.symbol === holding.symbol);
            return relatedRecords.length > 0;
        });
        
        // 計算群組總市值 (簡化版)
        const totalValue = filteredHoldings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
        const totalPnl = filteredHoldings.reduce((sum, h) => sum + (h.pnl_twd || 0), 0);
        const investedCapital = totalValue - totalPnl;
        
        // 儲存快照
        groupSnapshots.value[groupId] = {
            summary: {
                total_value: totalValue,
                invested_capital: investedCapital,
                total_pnl: totalPnl,
                realized_pnl: stats.value.realized_pnl || 0,  // 比例估算
                twr: stats.value.twr || 0,
                xirr: stats.value.xirr || 0,
                benchmark_twr: stats.value.benchmark_twr || 0,
            },
            holdings: filteredHoldings,
            history: history.value,  // 歷史數據不篩選，用於圖表顯示
            updated_at: lastUpdate.value,
        };
        
        console.log(`✅ 群組 ${group.name} 快照已更新:`, {
            持倉數: filteredHoldings.length,
            總市值: totalValue.toFixed(0),
            總損益: totalPnl.toFixed(0)
        });
    };

    // ✅ 新增：切換群組
    const switchGroup = async (groupId) => {
        console.log(`🔄 切換群組: ${groupId}`);
        currentGroupId.value = groupId;
        
        // 如果是「全部紀錄」，使用完整快照
        if (groupId === 'all') {
            return;
        }
        
        // 如果該群組快照不存在，則計算
        if (!groupSnapshots.value[groupId]) {
            calculateGroupSnapshot(groupId);
        }
    };

    // ✅ 新增：群組管理方法
    const addGroup = (params) => {
        const newGroup = groupManager.addGroup(params);
        return newGroup;
    };
    
    const updateGroup = (id, updates) => {
        return groupManager.updateGroup(id, updates);
    };
    
    const deleteGroup = (id) => {
        const success = groupManager.deleteGroup(id);
        if (success && currentGroupId.value === id) {
            // 如果刪除的是當前群組，切換到「全部」
            currentGroupId.value = 'all';
        }
        return success;
    };
    
    const reorderGroups = (orderedIds) => {
        groupManager.reorderGroups(orderedIds);
    };

    // Getters
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
    
    // ✅ 新增：群組相關 getters
    const groups = computed(() => groupManager.getAllGroups());
    
    const currentGroup = computed(() => 
        groups.value.find(g => g.id === currentGroupId.value) || groups.value[0]
    );
    
    const currentSnapshot = computed(() => 
        groupSnapshots.value[currentGroupId.value] || {
            summary: stats.value,
            holdings: holdings.value,
            history: history.value,
            updated_at: lastUpdate.value
        }
    );
    
    const filteredStats = computed(() => currentSnapshot.value.summary || {});
    const filteredHoldings = computed(() => currentSnapshot.value.holdings || []);
    const filteredHistory = computed(() => currentSnapshot.value.history || []);

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
        
        // ✅ 新增：群組相關狀態與方法
        groups,
        currentGroupId,
        currentGroup,
        currentSnapshot,
        filteredStats,
        filteredHoldings,
        filteredHistory,
        showGroupManagerModal,
        groupManager,  // 暴露給組件使用
        
        // 方法
        fetchAll, 
        fetchRecords, 
        triggerUpdate,
        switchGroup,
        calculateGroupSnapshot,
        addGroup,
        updateGroup,
        deleteGroup,
        reorderGroups,
    };
});
