import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthStore } from './auth';
import { CONFIG } from '../config';

export const usePortfolioStore = defineStore('portfolio', () => {
    const auth = useAuthStore();
    
    // --- State ---
    const records = ref([]);
    const holdings = ref([]);
    const stats = ref({});
    const history = ref([]);
    const pending_dividends = ref([]);
    const last_update = ref(null);
    const loading = ref(false);
    const isPolling = ref(false);
    const error = ref(null);
    const currentGroup = ref('all');

    // --- Internal State for Polling ---
    let pollInterval = null;

    // --- Getters ---
    
    const availableGroups = computed(() => {
        const groups = new Set(['all']);
        // 增加安全檢查：確保 records.value 是陣列
        if (Array.isArray(records.value)) {
            records.value.forEach(r => {
                if (r.tag) {
                    r.tag.split(/[,;]/).forEach(t => {
                        const cleanTag = t.trim();
                        if (cleanTag) groups.add(cleanTag);
                    });
                }
            });
        }
        return Array.from(groups).sort();
    });

    const dailyPnL = computed(() => {
        if (!Array.isArray(holdings.value) || holdings.value.length === 0) return 0;
        return holdings.value.reduce((sum, h) => sum + (Number(h.daily_pl_twd) || 0), 0);
    });

    const getGroupsWithHolding = (symbol) => {
        if (!symbol || !Array.isArray(holdings.value)) return [];
        const targetSymbol = symbol.toUpperCase();
        
        const hasHolding = holdings.value.some(h => h.symbol === targetSymbol && h.qty > 0);
        if (!hasHolding) return [];

        const groups = new Set();
        if (Array.isArray(records.value)) {
            records.value.filter(r => r.symbol === targetSymbol).forEach(r => {
                 if (r.tag) {
                    r.tag.split(/[,;]/).forEach(t => {
                        const cleanTag = t.trim();
                        if (cleanTag) groups.add(cleanTag);
                    });
                 }
            });
        }
        return Array.from(groups);
    };

    // --- Actions ---

    const setGroup = (group) => {
        currentGroup.value = group;
        fetchAll();
    };

    // 核心數據獲取 (修正解包邏輯)
    const fetchAll = async () => {
        if (!auth.token) return;
        loading.value = true;
        error.value = null;
        try {
            const query = currentGroup.value !== 'all' ? `?group=${encodeURIComponent(currentGroup.value)}` : '';
            
            // 並行請求
            const results = await Promise.allSettled([
                fetch(`${CONFIG.API_BASE_URL}/api/records`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/holdings${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/stats${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/history${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/dividends/pending`, { headers: auth.authHeader })
            ]);

            // 輔助函式：解析 Response
            const parseRes = async (resResult, defaultVal) => {
                if (resResult.status === 'fulfilled' && resResult.value.ok) {
                    try {
                        const json = await resResult.value.json();
                        // 修正：後端回傳格式為 { success: true, data: ... }
                        return json.data !== undefined ? json.data : json; 
                    } catch (e) {
                        console.warn('JSON parse failed', e);
                    }
                }
                return defaultVal;
            };

            // 依序賦值 (使用預設值防止 undefined 錯誤)
            records.value = await parseRes(results[0], []);
            holdings.value = await parseRes(results[1], []);
            stats.value = await parseRes(results[2], {});
            history.value = await parseRes(results[3], []);
            pending_dividends.value = await parseRes(results[4], []);

            last_update.value = new Date();
        } catch (e) {
            console.error('Fetch error:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    };

    const fetchRecords = async () => {
        if (!auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, { headers: auth.authHeader });
            if (res.ok) {
                const json = await res.json();
                records.value = json.data || []; // 修正
            }
        } catch (e) {
            console.error(e);
        }
    };

    const triggerUpdate = async () => {
        if (!auth.token) return;
        isPolling.value = true;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, { // 修正 endpoint 名稱
                method: 'POST',
                headers: auth.authHeader
            });
            if (!res.ok) throw new Error('Update trigger failed');
            startPolling();
        } catch (e) {
            isPolling.value = false;
            throw e;
        }
    };

    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        checkStatus();
        pollInterval = setInterval(async () => {
            if (document.hidden) return;
            await checkStatus();
        }, 5000);
        setTimeout(() => stopPolling(), 60000);
    };

    const stopPolling = () => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        isPolling.value = false;
    };

    const checkStatus = async () => {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/status`, { headers: auth.authHeader });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'idle' && isPolling.value) {
                    stopPolling();
                    await fetchAll();
                }
            }
        } catch (e) {
            console.error('Status check failed', e);
        }
    };

    // CRUD Actions
    const addRecord = async (record) => {
        const tempId = 'temp_' + Date.now();
        const tempRecord = { ...record, id: tempId, isTemp: true };
        records.value.unshift(tempRecord);

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                method: 'POST',
                headers: { ...auth.authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            
            if (!res.ok) throw new Error('Add failed');
            await fetchRecords(); 
            triggerUpdate(); 
            return true;
        } catch (e) {
            records.value = records.value.filter(r => r.id !== tempId);
            error.value = e.message;
            throw e;
        }
    };

    const updateRecord = async (record) => {
        const originalIndex = records.value.findIndex(r => r.id === record.id);
        const originalRecord = records.value[originalIndex];
        if (originalIndex !== -1) records.value[originalIndex] = { ...record };

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                method: 'PUT',
                headers: { ...auth.authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });

            if (!res.ok) throw new Error('Update failed');
            await fetchRecords();
            triggerUpdate();
            return true;
        } catch (e) {
            if (originalIndex !== -1 && originalRecord) {
                records.value[originalIndex] = originalRecord;
            }
            throw e;
        }
    };

    const deleteRecord = async (id) => {
        const originalRecords = [...records.value];
        records.value = records.value.filter(r => r.id !== id);

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                method: 'DELETE',
                headers: { ...auth.authHeader, 'Content-Type': 'application/json' }, // Delete often needs content-type if using body
                body: JSON.stringify({ id })
            });

            if (!res.ok) throw new Error('Delete failed');
            triggerUpdate();
            return true;
        } catch (e) {
            records.value = originalRecords;
            throw e;
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && auth.token) {
                const now = new Date();
                if (!last_update.value || (now - last_update.value) > 5 * 60 * 1000) {
                    fetchAll();
                }
            }
        });
    }

    return {
        records,
        holdings,
        stats,
        history,
        pending_dividends,
        loading,
        isPolling,
        currentGroup,
        availableGroups,
        dailyPnL,
        getGroupsWithHolding,
        setGroup,
        fetchAll,
        fetchRecords,
        triggerUpdate,
        addRecord,
        updateRecord,
        deleteRecord
    };
});
