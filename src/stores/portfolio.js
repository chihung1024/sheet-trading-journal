import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';
import {
    clearPendingCalculationRequest as clearStoredCalculationRequest,
    readPendingCalculationRequest as readStoredCalculationRequest,
    rememberPendingCalculationRequest as rememberStoredCalculationRequest,
} from '../services/calculationJobState';
import {
    buildRecordsPageEndpoint,
    fetchAllRecordPages,
} from '../services/recordPagination';
import { clearLegacyRecordCache } from '../services/projectStorage';
import { readApiJson } from '../services/apiResponse';
import {
    formatRequestError,
    isExplicitServerRejection,
    markRequestOutcome,
} from '../services/requestErrors';
import {
    DEFAULT_REQUEST_TIMEOUT_MS,
    fetchWithDeadline,
} from '../services/fetchDeadline';
import { createSingleFlight } from '../services/singleFlight.js';
import {
    committedMutationOutcome,
    failedMutationOutcome,
    isMutationCommitted,
} from '../services/mutationOutcome.js';

const CALCULATION_JOB_POLL_DELAY_MS = 5000;
const CALCULATION_JOB_POLL_LIMIT_MS = 20 * 60 * 1000;
const SNAPSHOT_POLL_DELAY_MS = 5000;
const SNAPSHOT_POLL_LIMIT_MS = 180000;

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const rawData = ref(null);
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('unknown');
    const portfolioReadStatus = ref('unknown');
    const snapshotFreshness = ref('unknown');
    const lastRecordMutationOutcome = ref(null);
    const isPolling = ref(false);
    const calculationJob = ref(null);
    let pollTimer = null;
    let calculationJobPollTimer = null;
    let snapshotPollActive = false;
    let calculationJobPollActive = false;
    let snapshotPollEpoch = 0;
    let calculationJobPollEpoch = 0;
    let triggerUpdatePromise = null;
    let didAttemptCalculationRecovery = false;

    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
    const currentGroup = ref('all');

    const getAuth = () => useAuthStore();
    const getToken = () => getAuth().token;
    const getCalculationOwner = () => getAuth().user?.email || '';

    const markSnapshotStale = () => {
        snapshotFreshness.value = 'stale';
    };

    const fetchWithAuth = async (endpoint, options = {}, retryAfterRefresh = true) => {
        const auth = getAuth();
        if (!auth.token) return null;
        const method = options.method || 'GET';

        try {
            const { response: res, json } = await fetchWithDeadline(
                `${CONFIG.API_BASE_URL}${endpoint}`,
                {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${auth.token}`,
                        'Content-Type': 'application/json'
                    }
                },
                {
                    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
                    responseHandler: async (response) => ({
                        response,
                        json: response.status === 401
                            ? null
                            : await readApiJson(response, { endpoint }),
                    }),
                },
            );

            if (res.status === 401) {
                if (retryAfterRefresh) {
                    console.warn('Token expired, attempting refresh...');
                    const refreshed = await auth.refreshToken();
                    if (refreshed) return fetchWithAuth(endpoint, options, false);
                }
                connectionStatus.value = 'error';
                auth.logout();
                return null;
            }

            connectionStatus.value = 'connected';
            return json;
        } catch (error) {
            const contextualError = markRequestOutcome(error, method);
            console.error(`Fetch error [${endpoint}]:`, contextualError);
            connectionStatus.value = 'error';
            throw contextualError;
        }
    };

    const resetData = () => {
        rawData.value = null;
        records.value = [];
        lastUpdate.value = '';
        clearLegacyRecordCache(localStorage);
    };

    const fetchSnapshot = async () => {
        try {
            const json = await fetchWithAuth('/api/portfolio');
            if (json && json.success && json.data) {
                if (!json.data.updated_at) {
                    if (records.value.length === 0) {
                        resetData();
                        snapshotFreshness.value = 'loaded';
                    }
                    return;
                }
                if (records.value.length === 0 && json.data.holdings && json.data.holdings.length > 0) return;
                rawData.value = json.data;
                lastUpdate.value = json.data.updated_at;
                snapshotFreshness.value = 'loaded';
            } else if (records.value.length === 0) {
                resetData();
                snapshotFreshness.value = 'loaded';
            }
        } catch (error) {
            console.error('fetchSnapshot error:', error);
            throw error;
        }
    };

    const fetchRecords = async () => {
        try {
            const allRecords = await fetchAllRecordPages(async ({ limit, cursor }) => {
                const endpoint = buildRecordsPageEndpoint({ limit, cursor });
                return fetchWithAuth(endpoint);
            });
            records.value = allRecords;
            clearLegacyRecordCache(localStorage);
            if (records.value.length === 0) resetData();
        } catch (error) {
            console.error('fetchRecords error:', error);
            throw error;
        }
    };

    const readPendingCalculationRequest = () => readStoredCalculationRequest(
        localStorage,
        getCalculationOwner(),
    );

    const rememberPendingCalculationRequest = (pending) => rememberStoredCalculationRequest(
        localStorage,
        getCalculationOwner(),
        pending,
    );

    const clearPendingCalculationRequest = () => clearStoredCalculationRequest(localStorage);

    const updatePollingState = () => {
        isPolling.value = snapshotPollActive || calculationJobPollActive;
    };

    const stopCalculationJobPolling = () => {
        calculationJobPollEpoch += 1;
        calculationJobPollActive = false;
        if (calculationJobPollTimer) {
            clearTimeout(calculationJobPollTimer);
            calculationJobPollTimer = null;
        }
        updatePollingState();
    };

    const completeCalculationJob = async (job, addToast) => {
        stopCalculationJobPolling();
        clearPendingCalculationRequest();
        if (job.status === 'succeeded') {
            try {
                await fetchAllFresh();
                addToast('✅ 數據已更新完畢！', 'success');
            } catch (error) {
                console.error('計算完成但重新載入資料失敗:', error);
                addToast('⚠️ 計算已完成，但最新資料載入失敗，請手動刷新', 'warning');
            }
        } else {
            addToast(`後端計算失敗 (${job.error_code || 'UNKNOWN'})`, 'error');
        }
    };

    const pollCalculationJobOnce = async (jobId, addToast, epoch) => {
        try {
            const json = await fetchWithAuth(`/api/calculation-jobs/${encodeURIComponent(jobId)}`);
            if (epoch !== calculationJobPollEpoch) return true;
            if (!json?.success || !json.job) return false;
            calculationJob.value = json.job;
            if (json.job.status === 'queued' || json.job.status === 'running') {
                calculationJobPollActive = true;
                updatePollingState();
                return false;
            }
            if (json.job.status === 'succeeded' || json.job.status === 'failed') {
                await completeCalculationJob(json.job, addToast);
                return true;
            }
            return false;
        } catch (error) {
            if (epoch !== calculationJobPollEpoch) return true;
            if (error?.status === 404) {
                stopCalculationJobPolling();
                clearPendingCalculationRequest();
                calculationJob.value = null;
                addToast('找不到先前的計算工作，已清除本機恢復狀態', 'info');
                return true;
            }
            console.warn('Calculation job polling error:', error);
            return false;
        }
    };

    const startCalculationJobPolling = async (jobId) => {
        stopCalculationJobPolling();
        const startedAt = Date.now();
        const { addToast } = useToast();
        calculationJobPollActive = true;
        const epoch = calculationJobPollEpoch;
        updatePollingState();

        const pollAgain = async () => {
            calculationJobPollTimer = null;
            if (epoch !== calculationJobPollEpoch) return;
            if (Date.now() - startedAt > CALCULATION_JOB_POLL_LIMIT_MS) {
                stopCalculationJobPolling();
                addToast('計算工作仍在排隊或執行中，稍後重新整理可繼續追蹤', 'info');
                return;
            }

            const completed = await pollCalculationJobOnce(jobId, addToast, epoch);
            if (epoch !== calculationJobPollEpoch || completed) return;
            calculationJobPollTimer = setTimeout(pollAgain, CALCULATION_JOB_POLL_DELAY_MS);
            updatePollingState();
        };

        const completedImmediately = await pollCalculationJobOnce(jobId, addToast, epoch);
        if (epoch !== calculationJobPollEpoch || completedImmediately) return;
        calculationJobPollTimer = setTimeout(pollAgain, CALCULATION_JOB_POLL_DELAY_MS);
        updatePollingState();
    };

    const resumePendingCalculationJob = () => {
        if (didAttemptCalculationRecovery) return;
        didAttemptCalculationRecovery = true;
        const pending = readPendingCalculationRequest();
        if (pending?.jobId) void startCalculationJobPolling(pending.jobId);
    };

    const performFetchAll = async () => {
        resumePendingCalculationJob();
        clearLegacyRecordCache(localStorage);
        loading.value = true;
        portfolioReadStatus.value = 'loading';
        try {
            await fetchRecords();
            try {
                const settingsJson = await fetchWithAuth('/api/user-settings');
                if (settingsJson && settingsJson.success && settingsJson.benchmark) {
                    selectedBenchmark.value = settingsJson.benchmark;
                    localStorage.setItem('user_benchmark', settingsJson.benchmark);
                }
            } catch (error) {
                console.warn('無法載入 benchmark 設定，使用預設值', error);
            }
            if (records.value && records.value.length > 0) await fetchSnapshot();
            else {
                resetData();
                snapshotFreshness.value = 'loaded';
            }
            portfolioReadStatus.value = 'loaded';
            return true;
        } catch (error) {
            console.error('fetchAll error:', error);
            connectionStatus.value = 'error';
            portfolioReadStatus.value = 'error';
            throw error;
        } finally {
            loading.value = false;
        }
    };

    const fetchAll = createSingleFlight(performFetchAll);
    const fetchAllFresh = () => fetchAll.afterCurrent();

    const handleAutoUpdateSignal = (message = '✨ 系統正自動同步股價與數據，請稍候...') => {
        const { addToast } = useToast();
        addToast(message, 'info');
        startPolling();
    };

    const publishRecordMutationOutcome = (outcome) => {
        lastRecordMutationOutcome.value = outcome;
        return isMutationCommitted(outcome);
    };

    const unconfirmedMutationError = (action) => {
        const error = new Error(`${action}未獲伺服器確認，請重新登入後再操作`);
        error.outcomeAmbiguous = false;
        return error;
    };

    const refreshRecordsAfterCommittedMutation = async (action, addToast) => {
        try {
            await fetchRecords();
            return { refreshed: true, refreshError: null };
        } catch (refreshError) {
            console.error(`${action}已提交，但交易紀錄重新載入失敗:`, refreshError);
            addToast(`${action}已完成，但畫面重新載入失敗；請重新整理確認最新紀錄`, 'warning');
            return { refreshed: false, refreshError };
        }
    };

    const recordMutationFailure = (error, { action, method, fallback }, addToast) => {
        const outcome = failedMutationOutcome(error);
        addToast(
            formatRequestError(error, { action, method, fallback }),
            outcome.outcomeAmbiguous ? 'warning' : 'error'
        );
        return publishRecordMutationOutcome(outcome);
    };

    const addRecord = async (formData) => {
        const { addToast } = useToast();
        let json;
        try {
            json = await fetchWithAuth('/api/records', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
        } catch (error) {
            return recordMutationFailure(error, {
                action: '新增交易',
                method: 'POST',
                fallback: '新增失敗',
            }, addToast);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('新增交易');
            return recordMutationFailure(error, {
                action: '新增交易',
                method: 'POST',
                fallback: '新增失敗',
            }, addToast);
        }

        markSnapshotStale();
        addToast('新增成功；持倉快照待重新計算', 'success');
        const refresh = await refreshRecordsAfterCommittedMutation('新增交易', addToast);
        if (json.auto_update) handleAutoUpdateSignal('🚀 這是您的第一筆交易，系統正自動啟動背景計算...');
        return publishRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }));
    };

    const updateRecord = async (formData) => {
        const { addToast } = useToast();
        let json;
        try {
            json = await fetchWithAuth('/api/records', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
        } catch (error) {
            return recordMutationFailure(error, {
                action: '更新交易',
                method: 'PUT',
                fallback: '更新失敗',
            }, addToast);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('更新交易');
            return recordMutationFailure(error, {
                action: '更新交易',
                method: 'PUT',
                fallback: '更新失敗',
            }, addToast);
        }

        markSnapshotStale();
        addToast('更新成功；持倉快照待重新計算', 'success');
        const refresh = await refreshRecordsAfterCommittedMutation('更新交易', addToast);
        return publishRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }));
    };

    const deleteRecord = async (id) => {
        const { addToast } = useToast();
        let json;
        try {
            json = await fetchWithAuth('/api/records', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
        } catch (error) {
            return recordMutationFailure(error, {
                action: '刪除交易',
                method: 'DELETE',
                fallback: '刪除失敗',
            }, addToast);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('刪除交易');
            return recordMutationFailure(error, {
                action: '刪除交易',
                method: 'DELETE',
                fallback: '刪除失敗',
            }, addToast);
        }

        markSnapshotStale();
        addToast('刪除成功；持倉快照待重新計算', 'success');

        if (json.message === 'RELOAD_UI') {
            records.value = [];
            handleAutoUpdateSignal('🧹 紀錄已清空，系統正重置資產數據...');
            return publishRecordMutationOutcome(committedMutationOutcome({
                response: json,
                refreshed: true,
            }));
        }

        const refresh = await refreshRecordsAfterCommittedMutation('刪除交易', addToast);
        return publishRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }));
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
        if (rawData.value.groups && rawData.value.groups[currentGroup.value]) return rawData.value.groups[currentGroup.value];
        return rawData.value;
    });

    const stats = computed(() => currentGroupData.value.summary || {});
    const holdings = computed(() => currentGroupData.value.holdings || []);
    const history = computed(() => currentGroupData.value.history || []);
    const pending_dividends = computed(() => currentGroupData.value.pending_dividends || []);
    const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
    const dailyPnL = computed(() => stats.value.daily_pnl_twd || 0);

    const setGroup = (group) => {
        if (availableGroups.value.includes(group)) currentGroup.value = group;
    };

    const getGroupsWithHolding = (symbol) => {
        if (!rawData.value || !rawData.value.groups) return [];
        const groups = [];
        for (const [groupName, data] of Object.entries(rawData.value.groups)) {
            if (groupName === 'all') continue;
            if (data.holdings.some(holding => holding.symbol === symbol && holding.qty > 0)) groups.push(groupName);
        }
        return groups;
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

    const stopPolling = () => {
        snapshotPollEpoch += 1;
        snapshotPollActive = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        updatePollingState();
    };

    const startPolling = () => {
        if (snapshotPollActive) return;
        const startTime = Date.now();
        const initialTime = lastUpdate.value;
        const { addToast } = useToast();
        snapshotPollEpoch += 1;
        const epoch = snapshotPollEpoch;
        snapshotPollActive = true;
        updatePollingState();

        const pollAgain = async () => {
            pollTimer = null;
            if (epoch !== snapshotPollEpoch) return;
            if (Date.now() - startTime > SNAPSHOT_POLL_LIMIT_MS) {
                stopPolling();
                return;
            }

            try {
                const json = await fetchWithAuth('/api/portfolio');
                if (epoch !== snapshotPollEpoch) return;
                if (json && json.success && json.data) {
                    const newTime = json.data.updated_at;
                    const isNewData = newTime && newTime !== initialTime && (json.data.holdings?.length > 0 || records.value.length === 0);
                    const isResetConfirmed = records.value.length === 0 && !newTime;
                    if (isNewData || isResetConfirmed) {
                        stopPolling();
                        try {
                            await fetchAllFresh();
                            addToast(isResetConfirmed ? '✅ 所有資產數據已歸零' : '✅ 數據已更新完畢！', 'success');
                        } catch (error) {
                            console.error('新快照已產生但載入失敗:', error);
                            addToast('⚠️ 已偵測到新快照，但載入失敗，請手動刷新', 'warning');
                        }
                        return;
                    }
                }
            } catch (error) {
                if (epoch !== snapshotPollEpoch) return;
                console.warn('SmartPolling check error:', error);
            }

            if (epoch !== snapshotPollEpoch || !snapshotPollActive) return;
            pollTimer = setTimeout(pollAgain, SNAPSHOT_POLL_DELAY_MS);
            updatePollingState();
        };

        pollTimer = setTimeout(pollAgain, SNAPSHOT_POLL_DELAY_MS);
        updatePollingState();
    };

    const performTriggerUpdate = async (benchmark = null) => {
        const token = getToken();
        if (!token) throw new Error('請先登入');

        if (benchmark && benchmark !== selectedBenchmark.value) {
            try {
                const saveJson = await fetchWithAuth('/api/user-settings', {
                    method: 'POST',
                    body: JSON.stringify({ benchmark: benchmark.toUpperCase().trim() })
                });
                if (!saveJson?.success) throw new Error('無法保存 benchmark 設定');
                selectedBenchmark.value = saveJson.benchmark;
                localStorage.setItem('user_benchmark', saveJson.benchmark);
            } catch (error) {
                const contextualError = markRequestOutcome(error, 'POST');
                contextualError.message = formatRequestError(contextualError, {
                    action: '保存 benchmark',
                    method: 'POST',
                    fallback: '無法保存 benchmark 設定',
                });
                console.error('保存 benchmark 失敗:', contextualError);
                throw contextualError;
            }
        }

        const targetBenchmark = benchmark || selectedBenchmark.value;
        const idempotencyKey = getOrCreateIdempotencyKey();
        try {
            const responseData = await fetchWithAuth('/api/trigger-update', {
                method: 'POST',
                headers: {
                    'Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify({ benchmark: targetBenchmark })
            });
            if (!responseData) throw new Error('後端無回應');
            markSnapshotStale();

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
                        ? '相同的計算要求已在排隊，繼續追蹤原工作'
                        : '🔄 已建立後端計算工作，正在同步中...',
                    'info'
                );
                await startCalculationJobPolling(responseData.job.id);
            } else {
                clearPendingCalculationRequest();
                handleAutoUpdateSignal('🔄 已手動觸發數據重算，正在同步中...');
            }
            return true;
        } catch (error) {
            const contextualError = markRequestOutcome(error, 'POST');
            if (isExplicitServerRejection(contextualError)) clearPendingCalculationRequest();
            contextualError.message = formatRequestError(contextualError, {
                action: '觸發重算',
                method: 'POST',
                fallback: '觸發重算失敗',
            });
            console.error('Trigger failed:', contextualError);
            throw contextualError;
        }
    };

    const triggerUpdate = (benchmark = null) => {
        if (triggerUpdatePromise) return triggerUpdatePromise;
        triggerUpdatePromise = performTriggerUpdate(benchmark).finally(() => {
            triggerUpdatePromise = null;
        });
        return triggerUpdatePromise;
    };

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
        portfolioReadStatus,
        snapshotFreshness,
        lastRecordMutationOutcome,
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
        startPolling,
        markSnapshotStale,
        resumePendingCalculationJob,
    };
});
