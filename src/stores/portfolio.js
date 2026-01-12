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
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 

    // ✅ 輪詢控制變數
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
                fetchSnapshot().catch(err => {
                    console.error('❌ [fetchSnapshot] 錯誤:', err);
                }),
                fetchRecords().catch(err => {
                    console.error('❌ [fetchRecords] 錯誤:', err);
                })
            ]);
            console.log('✅ [fetchAll] 數據載入完成');
        } catch (error) {
            console.error('❌ [fetchAll] 發生嚴重錯誤:', error);
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
            console.log('🏁 [fetchAll] loading 狀態已重置為 false');
        }
    };

    const fetchSnapshot = async () => {
        console.log('📊 [fetchSnapshot] 開始請求...');
        try {
            const json = await fetchWithAuth('/api/portfolio');
            console.log('📊 [fetchSnapshot] API 回應:', json);
            
            if (json && json.success && json.data) {
                stats.value = json.data.summary || {};
                holdings.value = json.data.holdings || [];
                history.value = json.data.history || [];
                lastUpdate.value = json.data.updated_at;
                console.log('✅ [fetchSnapshot] 數據已更新');
            } else {
                console.warn('⚠️ [fetchSnapshot] 數據格式異常:', json);
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
            } else {
                console.warn('⚠️ [fetchRecords] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchRecords] 請求失敗:', error);
            throw error;
        }
    };

    // ✅ 修改：智慧輪詢改為每 5 秒
    const startPolling = () => {
        if (isPolling.value) return;
        
        console.log('⌛ [SmartPolling] 開始監控數據更新（每 5 秒檢查）...');
        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value;
        const { addToast } = useToast(); 

        pollTimer = setInterval(async () => {
            // 1. 超時檢查 (3 分鐘)
            if (Date.now() - startTime > 180000) {
                console.warn('⚠️ [SmartPolling] 更新超時，停止輪詢');
                stopPolling();
                addToast("⚠️ 更新等待超時，請稍後手動重新整理", "error");
                return;
            }

            try {
                // 2. 輕量檢查
                const json = await fetchWithAuth('/api/portfolio');
                
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    
                    // 3. 比對時間
                    if (newTime !== initialTime) {
                        console.log('✨ [SmartPolling] 偵測到新數據！時間:', newTime);
                        
                        stopPolling();
                        await fetchAll();
                        
                        addToast("✅ 數據已更新完畢！", "success");
                    } else {
                        console.log('💤 [SmartPolling] 數據尚未變更...');
                    }
                }
            } catch (e) {
                console.warn('⚠️ [SmartPolling] 檢查失敗:', e);
            }
        }, 5000); // ✅ 改為每 5 秒檢查一次
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
                console.error('Trigger Error:', errorData);
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
        lastUpdate, 
        unrealizedPnL, 
        connectionStatus,
        isPolling,
        fetchAll, 
        fetchRecords, 
        triggerUpdate
    };
});
