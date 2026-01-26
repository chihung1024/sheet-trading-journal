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
    const pending_dividends = ref([]); // 新增：待確認配息
    const last_update = ref(null);
    const loading = ref(false);
    const isPolling = ref(false);
    const error = ref(null);
    const currentGroup = ref('all'); // 當前選擇的策略群組

    // --- Internal State for Polling ---
    let pollInterval = null;
    const POLLING_DELAY = 60 * 1000; // 60秒輪詢一次狀態

    // --- Getters ---
    
    // 計算所有可用的策略群組 (從 tags 解析)
    const availableGroups = computed(() => {
        const groups = new Set(['all']);
        records.value.forEach(r => {
            if (r.tag) {
                // 支援以逗號或分號分隔的多標籤
                r.tag.split(/[,;]/).forEach(t => {
                    const cleanTag = t.trim();
                    if (cleanTag) groups.add(cleanTag);
                });
            }
        });
        return Array.from(groups).sort();
    });

    // 取得當日損益 (從 holdings 加總)
    const dailyPnL = computed(() => {
        if (!holdings.value || holdings.value.length === 0) return 0;
        return holdings.value.reduce((sum, h) => sum + (Number(h.daily_pl_twd) || 0), 0);
    });

    // 輔助函式：查詢某個 Symbol 在哪些群組有持倉
    // 用於 TradeForm 的智慧賣出提示
    const getGroupsWithHolding = (symbol) => {
        if (!symbol) return [];
        const targetSymbol = symbol.toUpperCase();
        // 找出該標的目前持倉大於 0 的紀錄標籤
        // 註：這裡做簡易推斷，若要精確對應需後端提供分群持倉，
        // 此處邏輯為：若該標的在持倉列表中，且有相關歷史紀錄標籤，則列出。
        const hasHolding = holdings.value.some(h => h.symbol === targetSymbol && h.qty > 0);
        if (!hasHolding) return [];

        const groups = new Set();
        records.value.filter(r => r.symbol === targetSymbol).forEach(r => {
             if (r.tag) {
                r.tag.split(/[,;]/).forEach(t => {
                    const cleanTag = t.trim();
                    if (cleanTag) groups.add(cleanTag);
                });
             }
        });
        return Array.from(groups);
    };

    // --- Actions ---

    const setGroup = (group) => {
        currentGroup.value = group;
        // 切換群組時重新 fetch 該群組數據
        fetchAll();
    };

    // 核心數據獲取
    const fetchAll = async () => {
        if (!auth.token) return;
        loading.value = true;
        error.value = null;
        try {
            // 根據是否選擇群組決定 API 參數
            const query = currentGroup.value !== 'all' ? `?group=${encodeURIComponent(currentGroup.value)}` : '';
            
            const [resRecords, resHoldings, resStats, resHistory, resDivs] = await Promise.all([
                fetch(`${CONFIG.API_BASE_URL}/api/records`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/holdings${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/stats${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/history${query}`, { headers: auth.authHeader }),
                fetch(`${CONFIG.API_BASE_URL}/api/dividends/pending`, { headers: auth.authHeader }) // 獲取待確認配息
            ]);

            if (resRecords.ok) records.value = await resRecords.json();
            if (resHoldings.ok) holdings.value = await resHoldings.json();
            if (resStats.ok) stats.value = await resStats.json();
            if (resHistory.ok) history.value = await resHistory.json();
            if (resDivs.ok) pending_dividends.value = await resDivs.json();

            last_update.value = new Date();
        } catch (e) {
            console.error('Fetch error:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    };

    // 僅更新紀錄 (用於 CRUD 後)
    const fetchRecords = async () => {
        if (!auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, { headers: auth.authHeader });
            if (res.ok) records.value = await res.json();
        } catch (e) {
            console.error(e);
        }
    };

    // 觸發後端計算 (GitHub Dispatch)
    const triggerUpdate = async () => {
        if (!auth.token) return;
        isPolling.value = true;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/update`, {
                method: 'POST',
                headers: auth.authHeader
            });
            if (!res.ok) throw new Error('Update trigger failed');
            
            // 開始輪詢檢查狀態
            startPolling();
        } catch (e) {
            isPolling.value = false;
            throw e;
        }
    };

    // 輪詢機制
    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        
        // 立即執行一次檢查
        checkStatus();

        pollInterval = setInterval(async () => {
            // 如果頁面不可見，暫停輪詢 (由 Page Visibility API 控制)
            if (document.hidden) return;
            await checkStatus();
        }, 5000); // 每 5 秒檢查一次更新狀態

        // 設定 60 秒後強制停止輪詢 (避免無限迴圈)
        setTimeout(() => {
            stopPolling();
        }, 60000);
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
                const data = await res.json();
                // 假設後端回傳 status: 'idle' | 'updating'
                // 若變回 idle 代表更新完成，重新拉取數據
                if (data.status === 'idle' && isPolling.value) {
                    stopPolling();
                    await fetchAll();
                }
            }
        } catch (e) {
            console.error('Status check failed', e);
        }
    };

    // CRUD Actions with Optimistic Updates (樂觀更新)
    
    const addRecord = async (record) => {
        // 1. 樂觀更新：先加到本地列表
        const tempId = 'temp_' + Date.now();
        const tempRecord = { ...record, id: tempId, isTemp: true };
        records.value.unshift(tempRecord); // 加到最前面

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                method: 'POST',
                headers: { ...auth.authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            
            if (!res.ok) throw new Error('Add failed');
            
            // 2. 成功後，重新拉取正確資料 (或用回傳值替換 temp)
            await fetchRecords(); 
            // 觸發計算以更新持倉
            triggerUpdate(); 
            return true;
        } catch (e) {
            // 3. 失敗回滾
            records.value = records.value.filter(r => r.id !== tempId);
            error.value = e.message;
            throw e;
        }
    };

    const updateRecord = async (record) => {
        const originalIndex = records.value.findIndex(r => r.id === record.id);
        const originalRecord = records.value[originalIndex];
        
        // 1. 樂觀更新
        if (originalIndex !== -1) {
            records.value[originalIndex] = { ...record };
        }

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
            // 3. 失敗回滾
            if (originalIndex !== -1 && originalRecord) {
                records.value[originalIndex] = originalRecord;
            }
            throw e;
        }
    };

    const deleteRecord = async (id) => {
        const originalRecords = [...records.value];
        // 1. 樂觀更新
        records.value = records.value.filter(r => r.id !== id);

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/records?id=${id}`, {
                method: 'DELETE',
                headers: auth.authHeader
            });

            if (!res.ok) throw new Error('Delete failed');
            
            triggerUpdate();
            return true;
        } catch (e) {
            // 3. 失敗回滾
            records.value = originalRecords;
            throw e;
        }
    };

    // --- Page Visibility Handling ---
    // 當使用者切換分頁時停止輪詢，回來時自動更新
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 回到頁面
                if (auth.token) {
                    console.log('👀 Tab active, refreshing data...');
                    // 檢查是否超過 5 分鐘未更新，如果是則強制更新
                    const now = new Date();
                    if (!last_update.value || (now - last_update.value) > 5 * 60 * 1000) {
                        fetchAll();
                    }
                }
            }
        });
    }

    return {
        // State
        records,
        holdings,
        stats,
        history,
        pending_dividends,
        loading,
        isPolling,
        currentGroup,
        
        // Getters
        availableGroups,
        dailyPnL,
        getGroupsWithHolding,
        
        // Actions
        setGroup,
        fetchAll,
        fetchRecords,
        triggerUpdate,
        addRecord,
        updateRecord,
        deleteRecord
    };
});
