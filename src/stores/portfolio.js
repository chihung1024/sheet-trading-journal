import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const stats = ref({});
    const holdings = ref([]);
    const history = ref([]);
    const records = ref([]);
    const pending_dividends = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected');

    // ✅ 新增：群組相關狀態
    const groups = ref([]);
    const recordGroups = ref([]);  // 交易-群組關聯
    const currentGroupId = ref(null);  // 當前選中的群組ID

    const isPolling = ref(false);
    let pollTimer = null;

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

    const fetchAll = async () => {
        if (loading.value) {
            console.warn('⚠️ [fetchAll] 請求已在進行中，忽略此次調用');
            return;
        }

        console.log('📡 [fetchAll] 開始載入數據...');
        loading.value = true;
        
        try {
            await Promise.all([
                fetchSnapshot().catch(err => console.error('❌ [fetchSnapshot] 錯誤:', err)),
                fetchRecords().catch(err => console.error('❌ [fetchRecords] 錯誤:', err)),
                fetchGroups().catch(err => console.error('❌ [fetchGroups] 錯誤:', err))  // ✅ 新增
            ]);
            console.log('✅ [fetchAll] 數據載入完成');
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
            // ✅ 支援群組過濾
            const endpoint = currentGroupId.value 
                ? `/api/portfolio/${currentGroupId.value}` 
                : '/api/portfolio';
            
            const json = await fetchWithAuth(endpoint);
            console.log('📊 [fetchSnapshot] API 回應:', json);
            
            if (json && json.success && json.data) {
                stats.value = json.data.summary || {};
                holdings.value = json.data.holdings || [];
                history.value = json.data.history || [];
                pending_dividends.value = json.data.pending_dividends || [];
                lastUpdate.value = json.data.updated_at;
                console.log('✅ [fetchSnapshot] 數據已更新');
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
            console.log('📝 [fetchRecords] API 回應:', json);
            
            if (json && json.success) {
                records.value = json.data || [];
                console.log('✅ [fetchRecords] 數據已更新，共', records.value.length, '筆');
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 新增：獲取所有群組
    const fetchGroups = async () => {
        console.log('📁 [fetchGroups] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/groups');
            if (json && json.success) {
                groups.value = json.data || [];
                recordGroups.value = json.record_groups || [];  // ✅ 同時載入關聯數據
                console.log('✅ [fetchGroups] 載入', groups.value.length, '個群組');
            }
        } catch (error) {
            console.error('❌ [fetchGroups] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 新增：創建群組
    const createGroup = async (groupData) => {
        const json = await fetchWithAuth('/api/groups', {
            method: 'POST',
            body: JSON.stringify(groupData)
        });
        if (json && json.success) {
            await fetchGroups();
        }
        return json;
    };

    // ✅ 新增：更新群組
    const updateGroup = async (groupId, groupData) => {
        const json = await fetchWithAuth(`/api/groups/${groupId}`, {
            method: 'PUT',
            body: JSON.stringify(groupData)
        });
        if (json && json.success) {
            await fetchGroups();
        }
        return json;
    };

    // ✅ 新增：刪除群組
    const deleteGroup = async (groupId) => {
        const json = await fetchWithAuth(`/api/groups/${groupId}`, {
            method: 'DELETE'
        });
        if (json && json.success) {
            await fetchGroups();
        }
        return json;
    };

    // ✅ 新增：切換群組
    const switchGroup = async (groupId) => {
        currentGroupId.value = groupId;
        await fetchSnapshot();
    };

    // ✅ 新增：獲取交易的群組列表
    const getRecordGroups = (recordId) => {
        return recordGroups.value
            .filter(rg => rg.record_id === recordId)
            .map(rg => rg.group_id);
    };

    const startPolling = () => {
        if (isPolling.value) return;
        
        console.log('⌛ [SmartPolling] 開始監控數據更新...');
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

    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

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

    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

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
        // ✅ 群組相關
        groups,
        recordGroups,
        currentGroupId,
        fetchAll, 
        fetchRecords,
        fetchGroups,
        createGroup,
        updateGroup,
        deleteGroup,
        switchGroup,
        getRecordGroups,
        triggerUpdate
    };
});
