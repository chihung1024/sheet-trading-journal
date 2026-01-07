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
    // 新增連線狀態: 'connected', 'error', 'offline'
    const connectionStatus = ref('connected'); 

    // 統一處理帶有驗證的 Fetch 請求
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

            // 關鍵：偵測 Token 過期 (401)
            if (res.status === 401) {
                console.warn("Token expired, logging out...");
                connectionStatus.value = 'error';
                auth.logout(); // 自動登出，觸發 LoginOverlay 顯示
                return null;
            }

            // 處理其他錯誤
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
        loading.value = true;
        try {
            await Promise.all([fetchSnapshot(), fetchRecords()]);
        } finally {
            loading.value = false;
        }
    };

    const fetchSnapshot = async () => {
        const json = await fetchWithAuth('/api/portfolio');
        if (json && json.success && json.data) {
            stats.value = json.data.summary || {};
            holdings.value = json.data.holdings || [];
            history.value = json.data.history || [];
            lastUpdate.value = json.data.updated_at;
        }
    };

    const fetchRecords = async () => {
        const json = await fetchWithAuth('/api/records');
        if (json && json.success) {
            records.value = json.data;
        }
    };

    const triggerUpdate = async () => {
        if(!confirm("確定要觸發後端計算嗎？這可能需要幾秒鐘。")) return;
        try {
            await fetchWithAuth('/api/trigger-update', { method: "POST" });
            alert("已觸發更新，系統正在重新計算中...");
            // 延遲幾秒後自動重整數據
            setTimeout(() => fetchAll(), 3000);
        } catch(e) { 
            alert("觸發更新失敗，請檢查連線。"); 
        }
    };

    // Getters
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

    return { 
        loading, stats, holdings, history, records, lastUpdate, unrealizedPnL, connectionStatus,
        fetchAll, fetchRecords, triggerUpdate
    };
});
