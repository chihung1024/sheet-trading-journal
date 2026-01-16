import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const { addToast } = useToast();
    
    // --- State ---
    const loading = ref(false);
    const rawData = ref(null); // 完整快照 (含 groups)
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected'); 
    
    // ✅ 輪詢與群組
    const isPolling = ref(false);
    let pollTimer = null;
    const currentGroup = ref('all');

    // --- Actions ---
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
                headers: { ...options.headers, 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
            });
            if (res.status === 401) { auth.logout(); return null; }
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            connectionStatus.value = 'connected';
            return await res.json();
        } catch (e) { connectionStatus.value = 'error'; throw e; }
    };

    const fetchAll = async () => {
        if (loading.value) return;
        loading.value = true;
        try {
            await Promise.all([fetchSnapshot(), fetchRecords()]);
        } catch (error) { console.error(error); } 
        finally { loading.value = false; }
    };

    const fetchSnapshot = async () => {
        try {
            const json = await fetchWithAuth('/api/portfolio');
            if (json && json.success && json.data) {
                rawData.value = json.data;
                lastUpdate.value = json.data.updated_at;
            }
        } catch (error) { throw error; }
    };

    const fetchRecords = async () => {
        try {
            const json = await fetchWithAuth('/api/records');
            if (json && json.success) records.value = json.data || [];
        } catch (error) { throw error; }
    };

    // --- 群組邏輯 ---
    const setGroup = (group) => {
        currentGroup.value = group;
    };

    const getHoldingDistribution = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        const result = [];
        const targetSym = symbol.toUpperCase();
        for (const [groupName, data] of Object.entries(rawData.value.groups)) {
            if (groupName === 'all') continue;
            const position = data.holdings.find(h => h.symbol === targetSym && h.qty > 0);
            if (position) {
                result.push({ group: groupName, qty: position.qty, pnl: position.pnl_percent });
            }
        }
        return result.sort((a, b) => b.qty - a.qty);
    };

    // --- Computed ---
    const availableGroups = computed(() => {
        if (!rawData.value || !rawData.value.groups) return ['all'];
        return ['all', ...Object.keys(rawData.value.groups).filter(k => k !== 'all').sort()];
    });

    const currentGroupData = computed(() => {
        if (!rawData.value) return {};
        if (rawData.value.groups && rawData.value.groups[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value];
        }
        return rawData.value; // Fallback
    });

    // 數據對映
    const stats = computed(() => currentGroupData.value.summary || {});
    const holdings = computed(() => currentGroupData.value.holdings || []);
    const history = computed(() => currentGroupData.value.history || []);
    const pending_dividends = computed(() => currentGroupData.value.pending_dividends || []);
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

    // --- Polling Logic ---
    const startPolling = () => {
        if (isPolling.value) return;
        isPolling.value = true;
        const initialTime = lastUpdate.value;
        pollTimer = setInterval(async () => {
            try {
                const json = await fetchWithAuth('/api/portfolio');
                if (json && json.data && json.data.updated_at !== initialTime) {
                    stopPolling();
                    await fetchAll();
                    addToast("數據已更新完畢", "success");
                }
            } catch(e) {}
        }, 5000);
    };

    const stopPolling = () => {
        isPolling.value = false;
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    };

    const triggerUpdate = async () => {
        const token = getToken();
        if (!token) throw new Error("請先登入"); 
        try {
            await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });
            startPolling();
        } catch (e) { throw e; }
    };

    // CRUD Actions (保持原樣，略)
    const addRecord = async (r) => { 
        await fetchWithAuth('/api/records', { method: 'POST', body: JSON.stringify(r) });
        await fetchRecords(); 
    };
    const updateRecord = async (r) => {
        await fetchWithAuth('/api/records', { method: 'PUT', body: JSON.stringify(r) });
        await fetchRecords();
    };
    const deleteRecord = async (id) => {
        await fetchWithAuth('/api/records', { method: 'DELETE', body: JSON.stringify({id}) });
        await fetchRecords();
    };

    return { 
        loading, stats, holdings, history, records, pending_dividends, 
        lastUpdate, unrealizedPnL, connectionStatus, isPolling,
        currentGroup, availableGroups, 
        fetchAll, fetchRecords, addRecord, updateRecord, deleteRecord, 
        triggerUpdate, setGroup, getHoldingDistribution
    };
});
