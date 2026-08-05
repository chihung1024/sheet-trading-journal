import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const rawData = ref(null);
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('connected');
    const isPolling = ref(false);
    const calculationJob = ref(null);
    let pollTimer = null;
    let calculationJobPollTimer = null;
    let triggerUpdatePromise = null;
    const CALCULATION_REQUEST_STORAGE_KEY = 'pending_calculation_request';
    const CALCULATION_REQUEST_TTL_MS = 15 * 60 * 1000;

    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
    const currentGroup = ref('all');

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
                console.warn("Token expired, attempting refresh...");
                const refreshed = await auth.refreshToken();
                if (refreshed) {
                    // 重試原請求
                    console.log("Token refreshed, retrying request...");
                    return fetchWithAuth(endpoint, options);
                }
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

    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        localStorage.removeItem('cached_records');
    };

    const fetchAll = async () => {
        if (loading.value) return;
        loading.value = true;

        try {
            await fetchRecords();

            // [v2.54] 從 API 獲取用戶的 benchmark 設定
            try {
                const settingsJson = await fetchWithAuth('/api/user-settings');
                if (settingsJson && settingsJson.success && settingsJson.benchmark) {
                    selectedBenchmark.value = settingsJson.benchmark;
                    localStorage.setItem('user_benchmark', settingsJson.benchmark);
                }
            } catch (e) {
                console.warn('無法載入 benchmark 設定，使用預設值', e);
            }

            if (records.value && records.value.length > 0) {
                await fetchSnapshot();
            } else {
                resetData();
            }
        } catch (error) {
            console.error('fetchAll error:', error);
            connectionStatus.value = 'error';
        } finally {
            loading.value = false;
        }
    };

    const fetchSnapshot = async () => {
        try {
            const json = await fetchWithAuth('/api/portfolio');

            if (json && json.success && json.data) {
                if (!json.data.updated_at) {
                    if (records.value.length === 0) resetData();
                    return;
                }

                if (records.value.length === 0 && json.data.holdings && json.data.holdings.length > 0) {
                    return;
                }

                rawData.value = json.data;
                lastUpdate.value = json.data.updated_at;
            } else {
                if (records.value.length === 0) resetData();
            }
        } catch (error) {
            console.error('fetchSnapshot error:', error);
            throw error;
        }
    };

    const fetchRecords = async () => {
        try {
            const json = await fetchWithAuth('/api/records');

            if (json && json.success) {
                records.value = json.data || [];
                localStorage.setItem('cached_records', JSON.stringify(records.value));

                if (records.value.length === 0) resetData();
            }
        } catch (error) {
            console.error('fetchRecords error:', error);
            throw error;
        }
    };

    const handleAutoUpdateSignal = (message = "✨ 系統正自動同步股價與數據，請稍候...") => {
        const { addToast } = useToast();
        addToast(message, "info");
        startPolling();
    };

    const addRecord = async (formData) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (json && json.success) {
                addToast("新增成功", "success");
                await fetchRecords();

                if (json.auto_update) {
                    handleAutoUpdateSignal("🚀 這是您的第一筆交易，系統正自動啟動背景計算...");
                }
                return true;
            }
            return false;
        } catch (e) {
            addToast(e.message || "新增失敗", "error");
            return false;
        }
    };

    const updateRecord = async (formData) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            if (json && json.success) {
                addToast("更新成功", "success");
                await fetchRecords();
                return true;
            }
            return false;
        } catch (e) {
            addToast(e.message || "更新失敗", "error");
            return false;
        }
    };

    const deleteRecord = async (id) => {
        const { addToast } = useToast();
        try {
            const json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });

            if (json && json.success) {
                addToast("刪除成功", "success");

                if (json.message === "RELOAD_UI") {
                    records.value = [];
                    handleAutoUpdateSignal("🧹 紀錄已清空，系統正重置資產數據...");
                } else {
                    await fetchRecords();
                }
                return true;
            }
            return false;
        } catch (e) {
            addToast("刪除失敗", "error");
            return false;
        }
    };

    const availableGroups = computed(() => {
        if (!rawData.value || !rawData.value.groups) return ['all'];
        return Object.keys(rawData.value.groups).sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            return a.localeCompare(b);
        });
    });

    const currentGroupData = computed(() => {
        if (!rawData.value) return {};
        if (rawData.value.groups && rawData.value.groups[currentGroup.value]) {
            return rawData.value.groups[currentGroup.value];
        }
        return rawData.value;
    });

    const stats = computed(() => currentGroupData.value.summary || {});
    const holdings = computed(() => currentGroupData.value.holdings || []);
    const history = computed(() => currentGroupData.value.history || []);
    const pending_dividends = computed(() => currentGroupData.value.pending_dividends || []);
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
    const dailyPnL = computed(() => stats.value.daily_pnl_twd || 0);

    const setGroup = (group) => {
        if (availableGroups.value.includes(group)) {
            currentGroup.value = group;
        }
    };

    const getGroupsWithHolding = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        const groups = [];
        for (const [groupName, data] of Object.entries(rawData.value.groups)) {
            if (groupName === 'all') continue;
            const hasStock = data.holdings.some(h => h.symbol === symbol && h.qty > 0);
            if (hasStock) groups.push(groupName);
        }
        return groups;
    };

    const stopCalculationJobPolling = () => {
        if (calculationJobPollTimer) {
  clearInterval(calculationJobPollTimer);
  calculationJobPollTimer = null;
        }
    };

    const readPendingCalculationRequest = () => {
        try {
  const pending = JSON.parse(localStorage.getItem(CALCULATION_REQUEST_STORAGE_KEY) || 'null');
  if (!pending || typeof pending.key !== 'string' || !Number.isFinite(pending.createdAt)) return null;
  if (Date.now() - pending.createdAt >= CALCULATION_REQUEST_TTL_MS) {
      localStorage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
      return null;
  }
  return pending;
        } catch {
  localStorage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
  return null;
        }
    };

    const rememberPendingCalculationRequest = (pending) => {
        localStorage.setItem(CALCULATION_REQUEST_STORAGE_KEY, JSON.stringify(pending));
    };

    const clearPendingCalculationRequest = () => {
        localStorage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
    };

    const startCalculationJobPolling = (jobId) => {
        stopCalculationJobPolling();
        const startedAt = Date.now();
        const { addToast } = useToast();

        calculationJobPollTimer = setInterval(async () => {
  if (Date.now() - startedAt > 20 * 60 * 1000) {
      stopCalculationJobPolling();
      addToast("計算工作仍在排隊或執行中，稍後可重新整理查看結果", "info");
      return;
  }
  try {
      const json = await fetchWithAuth(`/api/calculation-jobs/${encodeURIComponent(jobId)}`);
      if (!json?.success || !json.job) return;
      calculationJob.value = json.job;
      if (json.job.status === 'succeeded') {
          stopCalculationJobPolling();
          await fetchAll();
          addToast("✅ 數據已更新完畢！", "success");
      } else if (json.job.status === 'failed') {
          stopCalculationJobPolling();
          addToast(`後端計算失敗 (${json.job.error_code || 'UNKNOWN'})`, "error");
      }
  } catch (error) {
      console.warn('Calculation job polling error:', error);
  }
        }, 5000);
    };

    const createIdempotencyKey = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    };

    const getOrCreateIdempotencyKey = () => {
        const pending = readPendingCalculationRequest();
        if (pending) return pending.key;
        const key = createIdempotencyKey();
        rememberPendingCalculationRequest({ key, createdAt: Date.now(), jobId: null });
        return key;
    };

    const startPolling = () => {
        if (isPolling.value) return;

        isPolling.value = true;
        const startTime = Date.now();
        const initialTime = lastUpdate.value;
        const { addToast } = useToast();

        pollTimer = setInterval(async () => {
            if (Date.now() - startTime > 180000) {
                stopPolling();
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');

                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    const isNewData = newTime && (newTime !== initialTime) && (json.data.holdings?.length > 0 || records.value.length === 0);
                    const isResetConfirmed = (records.value.length === 0) && !newTime;

                    if (isNewData || isResetConfirmed) {
                        stopPolling();
                        await fetchAll();
                        if (isResetConfirmed) addToast("✅ 所有資產數據已歸零", "success");
                        else addToast("✅ 數據已更新完畢！", "success");
                    }
                }
            } catch (e) {
                console.warn('SmartPolling check error:', e);
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

    // [v2.60] Durable calculation job trigger with idempotency and status polling.
    const performTriggerUpdate = async (benchmark = null) => {
        const token = getToken();
        if (!token) throw new Error("請先登入");

        if (benchmark && benchmark !== selectedBenchmark.value) {
  try {
      const saveResponse = await fetch(`${CONFIG.API_BASE_URL}/api/user-settings`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ benchmark: benchmark.toUpperCase().trim() })
      });
      if (!saveResponse.ok) throw new Error('無法保存 benchmark 設定');
      const saveJson = await saveResponse.json();
      if (saveJson.success) {
          selectedBenchmark.value = saveJson.benchmark;
          localStorage.setItem('user_benchmark', saveJson.benchmark);
      }
  } catch (e) {
      console.error('保存 benchmark 失敗:', e);
      throw new Error('無法保存 benchmark 設定: ' + e.message);
  }
        }

        const targetBenchmark = benchmark || selectedBenchmark.value;
        const idempotencyKey = getOrCreateIdempotencyKey();

        try {
  const response = await fetch(`${CONFIG.API_BASE_URL}/api/trigger-update`, {
      method: "POST",
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ benchmark: targetBenchmark })
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
      clearPendingCalculationRequest();
      throw new Error(responseData.error || '後端無回應');
  }

  if (responseData.job?.id) {
      calculationJob.value = responseData.job;
      rememberPendingCalculationRequest({
key: idempotencyKey,
createdAt: Date.now(),
jobId: responseData.job.id
      });
      const { addToast } = useToast();
      addToast(
          responseData.job.deduplicated
              ? "相同的計算要求已在排隊，繼續追蹤原工作"
              : "🔄 已建立後端計算工作，正在同步中...",
          "info"
      );
      startCalculationJobPolling(responseData.job.id);
  } else {
      handleAutoUpdateSignal("🔄 已手動觸發數據重算，正在同步中...");
  }
  return true;
        } catch (e) {
  console.error('Trigger failed:', e);
  throw e;
        }
    };

    const triggerUpdate = (benchmark = null) => {
        if (triggerUpdatePromise) return triggerUpdatePromise;
        triggerUpdatePromise = performTriggerUpdate(benchmark)
  .finally(() => {
      triggerUpdatePromise = null;
  });
        return triggerUpdatePromise;
    };

    const pendingCalculationRequest = readPendingCalculationRequest();
    if (pendingCalculationRequest?.jobId) {
        queueMicrotask(() => startCalculationJobPolling(pendingCalculationRequest.jobId));
    }

    return {
        loading,
        rawData,
        stats,
        holdings,
        history,
        records,
        pending_dividends,
        lastUpdate,
        unrealizedPnL,
        dailyPnL,
        connectionStatus,
        isPolling,
        calculationJob,
        currentGroup,
        availableGroups,
        selectedBenchmark,
        setGroup,
        getGroupsWithHolding,
        fetchAll,
        fetchRecords,
        fetchSnapshot,
        addRecord,
        updateRecord,
        deleteRecord,
        triggerUpdate,
        resetData,
        startPolling
    };
});