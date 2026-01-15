import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';
import { getGroupManager } from '../config/groups';  // ✅ 引入群組管理器

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const stats = ref({});
    const holdings = ref([]);
    const history = ref([]);
    const records = ref([]);
    const pending_dividends = ref([]);  // ✅ 待確認配息列表
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 

    // ✅ 新增：群組功能相關狀態
    const groupManager = getGroupManager();
    const currentGroupId = ref('all');  // 當前選中的群組
    const groupSnapshots = ref({});     // 儲存各群組的快照 (前端篩選)
    const showGroupManager = ref(false); // 群組管理器 Modal 顯示狀態

    // ✅ 輪詢控制變數
    const isPolling = ref(false);
    let pollTimer = null;

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
            console.log('✅ [fetchAll] 數據載入完成');
            
            // ✅ 載入完成後重新計算當前群組的快照
            if (currentGroupId.value !== 'all') {
                calculateGroupSnapshot(currentGroupId.value);
            }
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
            
            if (json && json.success && json.data) {
                stats.value = json.data.summary || {};
                holdings.value = json.data.holdings || [];
                history.value = json.data.history || [];
                pending_dividends.value = json.data.pending_dividends || [];
                lastUpdate.value = json.data.updated_at;
                
                // ✅ 儲存「全部紀錄」的快照
                groupSnapshots.value['all'] = json.data;
                
                console.log('✅ [fetchSnapshot] 數據已更新，待確認配息:', pending_dividends.value.length, '筆');
            } else {
                console.warn('⚠️ [fetchSnapshot] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchSnapshot] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 修復：增強的 fetchRecords
    const fetchRecords = async () => {
        console.log('📋 [fetchRecords] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/records');
            
            if (json && json.success) {
                records.value = json.data || [];
                console.log('✅ [fetchRecords] 數據已更新，共', records.value.length, '筆');
            } else {
                console.warn('⚠️ [fetchRecords] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 新增：智慧輪詢函式
    const startPolling = () => {
        if (isPolling.value) return;
        
        console.log('⏳ [SmartPolling] 開始監控數據更新...');
        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value;
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            if (Date.now() - startTime > 180000) {
                console.warn('⚠️ [SmartPolling] 更新超時，停止輪詢');
                stopPolling();
                addToast("⚠️ 更新等待超時，請稍後手動重新整理", "error");
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');
                
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    
                    if (newTime !== initialTime) {
                        console.log('✨ [SmartPolling] 偵測到新數據！時間:', newTime);
                        
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

    // ✅ 新增：停止輪詢
    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    // ✅ 修改：觸發更新時傳遞群組配置
    const triggerUpdate = async () => {
        const token = getToken();
        if (!token) throw new Error("請先登入"); 
        
        try {
            // ✅ 匯出群組配置
            const groupsConfig = groupManager.exportForPython();
            console.log('📁 [triggerUpdate] 群組配置:', groupsConfig);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    groups_config: groupsConfig  // ✅ 傳遞群組配置
                })
            });
            
            if (response.ok || response.status === 204) {
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

    // ✅ 新增：切換群組
    const switchGroup = (groupId) => {
        console.log(`🔄 [切換群組] ${currentGroupId.value} -> ${groupId}`);
        currentGroupId.value = groupId;
        
        // 如果是「全部紀錄」，直接使用完整快照
        if (groupId === 'all') {
            return;
        }
        
        // ✅ 前端即時計算該群組數據
        calculateGroupSnapshot(groupId);
    };

    // ✅ 新增：前端即時計算群組快照 (輕量版)
    const calculateGroupSnapshot = (groupId) => {
        const group = groupManager.getGroupById(groupId);
        if (!group) {
            console.warn(`⚠️ 找不到群組: ${groupId}`);
            return;
        }
        
        console.log(`⚙️ [計算群組] ${group.name}`, group.tags);
        
        // 篩選該群組的交易紀錄
        const filteredRecords = records.value.filter(record => {
            const recordGroups = groupManager.getRecordGroups(record.tag);
            return recordGroups.includes(groupId);
        });
        
        console.log(`   篩選結果: ${filteredRecords.length} 筆交易`);
        
        // 篩選該群組的持倉
        const symbolsInGroup = new Set(filteredRecords.map(r => r.symbol));
        const filteredHoldings = holdings.value.filter(h => symbolsInGroup.has(h.symbol));
        
        // 計算群組總市值
        const totalValue = filteredHoldings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
        const totalPnl = filteredHoldings.reduce((sum, h) => sum + (h.pnl_twd || 0), 0);
        
        // 僅估算，不精確計算
        const investedCapital = totalValue - totalPnl;
        
        // 儲存快照
        groupSnapshots.value[groupId] = {
            summary: {
                total_value: totalValue,
                total_pnl: totalPnl,
                invested_capital: investedCapital,
                twr: stats.value.twr || 0,  // 使用全局 TWR 估算
                xirr: stats.value.xirr || 0,
                realized_pnl: stats.value.realized_pnl || 0,
            },
            holdings: filteredHoldings,
            records: filteredRecords,
        };
        
        console.log(`   ✅ 完成 - 總市值: $${totalValue.toFixed(0)}`);
    };

    // ✅ 新增：Getter - 當前群組的快照
    const currentSnapshot = computed(() => {
        if (currentGroupId.value === 'all') {
            return {
                summary: stats.value,
                holdings: holdings.value,
                history: history.value,
            };
        }
        return groupSnapshots.value[currentGroupId.value] || {};
    });

    // ✅ 新增：Getter - 當前群組的統計資料
    const currentStats = computed(() => currentSnapshot.value.summary || {});
    const currentHoldings = computed(() => currentSnapshot.value.holdings || []);
    const currentHistory = computed(() => currentSnapshot.value.history || history.value);

    // ✅ 新增：Getter - 所有群組列表
    const groups = computed(() => groupManager.getAllGroups());
    const currentGroup = computed(() => 
        groupManager.getGroupById(currentGroupId.value) || groups.value[0]
    );

    // ✅ 保留原有 Getter
    const unrealizedPnL = computed(() => 
        (currentStats.value.total_value || 0) - (currentStats.value.invested_capital || 0)
    );

    // ✅ 新增：群組管理方法
    const addGroup = (name, icon, color, tags, description) => {
        return groupManager.addGroup(name, icon, color, tags, description);
    };

    const updateGroup = (id, updates) => {
        return groupManager.updateGroup(id, updates);
    };

    const deleteGroup = (id) => {
        // 如果刪除的是當前群組，切換到「全部」
        if (id === currentGroupId.value) {
            switchGroup('all');
        }
        return groupManager.deleteGroup(id);
    };

    const reorderGroups = (orderedIds) => {
        return groupManager.reorderGroups(orderedIds);
    };

    return { 
        // 原有狀態
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
        
        // ✅ 群組相關狀態
        currentGroupId,
        groups,
        currentGroup,
        currentSnapshot,
        currentStats,
        currentHoldings,
        currentHistory,
        showGroupManager,
        groupManager,
        
        // 原有方法
        fetchAll, 
        fetchRecords, 
        triggerUpdate,
        
        // ✅ 群組相關方法
        switchGroup,
        addGroup,
        updateGroup,
        deleteGroup,
        reorderGroups,
    };
});
