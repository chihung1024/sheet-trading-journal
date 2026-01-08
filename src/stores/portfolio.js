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

    // ✅ 保留：直接獲取 Token 的方法（Tag 1.10 原始方法）
    const getToken = () => {
        const auth = useAuthStore();
        return auth.token;
    };

    // 保留：統一處理帶有驗證的 Fetch 請求（給其他方法使用）
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

    // ✅ 修復：還原為 Tag 1.10 的 triggerUpdate 實現（這是核心修復）
    const triggerUpdate = async () => {
        const token = getToken();
        if (!token) {
            alert("請先登入");
            return;
        }
        
        if (!confirm("確定要觸發後端計算嗎？")) return;
        
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
