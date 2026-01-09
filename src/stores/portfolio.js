import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const stats = ref({});
    const holdings = ref([]);
    const history = ref([]);
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 

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

    // ✅ 修復：增強的 fetchAll，確保 loading 一定會重置
    const fetchAll = async () => {
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
            // ✅ 關鍵修復：確保 loading 一定會變回 false
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
                lastUpdate.value = json.data.updated_at;
                console.log('✅ [fetchSnapshot] 數據已更新');
            } else {
                console.warn('⚠️ [fetchSnapshot] 數據格式異常:', json);
            }
        } catch (error) {
            console.error('❌ [fetchSnapshot] 請求失敗:', error);
            throw error; // 拋出讓 fetchAll 捕捉
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
            throw error; // 拋出讓 fetchAll 捕捉
        }
    };

    // ✅ 保留：Tag 1.10 的 triggerUpdate 實現
    const triggerUpdate = async () => {
        const token = getToken();
        if (!token) {
            alert("請先登入");
            return;
        }
        
        if(!confirm("確定要觸發後端計算嗎？")) return;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok || response.status === 204) {
                alert("✅ 已觸發更新！\n\n系統正在背景計算，請稍待 30-60 秒後重新整理頁面。");
                // 延遲後自動重整數據
                setTimeout(() => {
                    fetchAll();
                }, 5000);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(`❌ 觸發失敗\n\n錯誤: ${errorData.error || '後端無回應'}`);
                console.error('Trigger Error:', errorData);
            }
        } catch (e) { 
            alert(`❌ 觸發失敗\n\n網路錯誤: ${e.message}`);
            console.error('Trigger failed:', e);
        }
    };

    // Getters
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
        fetchAll, 
        fetchRecords, 
        triggerUpdate
    };
});
