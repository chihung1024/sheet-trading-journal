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
    
    // Get token dynamically
    const getToken = () => {
        const auth = useAuthStore();
        return auth.token;
    };

    const fetchAll = async () => {
        loading.value = true;
        await Promise.all([fetchSnapshot(), fetchRecords()]);
        loading.value = false;
    };

    const fetchSnapshot = async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/portfolio`);
            const json = await res.json();
            if (json.success && json.data) {
                stats.value = json.data.summary || {};
                holdings.value = json.data.holdings || [];
                history.value = json.data.history || [];
                lastUpdate.value = json.data.updated_at;
            }
        } catch (e) { console.error("Snapshot Error", e); }
    };

    const fetchRecords = async () => {
        const token = getToken();
        if(!token) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if(json.success) records.value = json.data;
        } catch (e) { console.error("Records Error", e); }
    };

    const triggerUpdate = async () => {
        const token = getToken();
        if(!confirm("確定要觸發後端計算嗎？")) return;
        try {
            await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert("已觸發更新，請稍待片刻後重新整理。");
        } catch(e) { alert("Trigger failed"); }
    };

    // Getters
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

    return { 
        loading, stats, holdings, history, records, lastUpdate, unrealizedPnL,
        fetchAll, fetchRecords, triggerUpdate
    };
});
