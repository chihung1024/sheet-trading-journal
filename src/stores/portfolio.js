import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';
import {
    clearPendingCalculationRequest as clearStoredCalculationRequest,
    pendingCalculationMatchesBenchmark,
    readPendingCalculationRequest as readStoredCalculationRequest,
    rememberPendingCalculationRequest as rememberStoredCalculationRequest,
} from '../services/calculationJobState';
import {
    clearAutomaticRecalculationState,
    markAutomaticRecalculationCoverage,
    markAutomaticRecalculationDirty,
    readAutomaticRecalculationStatus,
    settleAutomaticRecalculationJob,
} from '../services/automaticRecalculationState.js';
import {
    claimCalculationJobPoll,
    clearCalculationJobPollClaim,
} from '../services/calculationJobPollClaim.js';
import {
    buildRecordsPageEndpoint,
    fetchAllRecordPages,
} from '../services/recordPagination';
import { clearLegacyRecordCache } from '../services/projectStorage';
import {
    beginRecordCreateIntent,
    completeRecordCreateIntent,
    markRecordCreateIntentTerminal,
    readEligibleRecordCreateIntents,
    rotateRecordMutationBarrier,
} from '../services/recordCreateIntent.js';
import { publishRecordCreateRecoverySuccess } from '../services/recordCreateRecoverySignal.js';
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
const AUTOMATIC_RECALCULATION_DEBOUNCE_MS = 1200;

export const usePortfolioStore = defineStore('portfolio', () => {
    const loading = ref(false);
    const rawData = ref(null);
    const records = ref([]);
    const lastUpdate = ref('');
    const connectionStatus = ref('unknown');
    const portfolioReadStatus = ref('unknown');
    const snapshotFreshness = ref('unknown');
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
    let lastRecordCreateRecoveryKey = null;
    let recordCreateRecoveryPromise = null;
    let automaticRecalculationTimer = null;
    let automaticRecalculationPromise = null;
    let lastAutomaticRecalculationAttemptToken = null;

    const selectedBenchmark = ref(localStorage.getItem('user_benchmark') || 'SPY');
    const currentGroup = ref('all');

    const getAuth = () => useAuthStore();
    const getToken = () => getAuth().token;
    const getCalculationOwner = () => getAuth().user?.email || '';
    const getRecordMutationOwner = () => getAuth().user?.email || '';

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

    const clearPendingCalculationRequest = (selector) => clearStoredCalculationRequest(
        localStorage,
        getCalculationOwner(),
        selector,
    );

    const cancelAutomaticRecalculationTimer = () => {
        if (automaticRecalculationTimer) {
            clearTimeout(automaticRecalculationTimer);
            automaticRecalculationTimer = null;
        }
    };

    const readAutomaticRecalculation = () => readAutomaticRecalculationStatus(
        localStorage,
        getCalculationOwner(),
    );

    const hasActiveCalculationIntent = () => {
        if (snapshotPollActive) return true;
        if (triggerUpdatePromise) return true;
        if (calculationJob.value?.status === 'queued' || calculationJob.value?.status === 'running') return true;
        const pending = readPendingCalculationRequest();
        return Boolean(pending?.jobId);
    };

    const scheduleAutomaticRecalculationFlush = (delayMs = AUTOMATIC_RECALCULATION_DEBOUNCE_MS) => {
        cancelAutomaticRecalculationTimer();
        automaticRecalculationTimer = setTimeout(() => {
            automaticRecalculationTimer = null;
            void flushAutomaticRecalculation();
        }, delayMs);
    };

    const markCommittedMutationDirtyForAutomaticRecalculation = () => {
        try {
            const generation = markAutomaticRecalculationDirty(
                localStorage,
                getCalculationOwner(),
                selectedBenchmark.value,
            );
            lastAutomaticRecalculationAttemptToken = null;
            scheduleAutomaticRecalculationFlush();
            return generation;
        } catch (error) {
            console.warn('交易已提交，但無法保存自動重算狀態:', error);
            const { addToast } = useToast();
            addToast('交易已保存，但自動重新計算狀態無法保存；必要時可手動更新', 'warning');
            return null;
        }
    };

    const clearAutomaticRecalculationForCurrentOwner = () => {
        cancelAutomaticRecalculationTimer();
        lastAutomaticRecalculationAttemptToken = null;
        try {
            return clearAutomaticRecalculationState(localStorage, getCalculationOwner());
        } catch (error) {
            console.warn('無法清除自動重算恢復狀態:', error);
            return 0;
        }
    };

    const resumeAutomaticRecalculation = () => {
        if (records.value.length === 0) {
            clearAutomaticRecalculationForCurrentOwner();
            return false;
        }
        try {
            const status = readAutomaticRecalculation();
            if (!status.dirty || hasActiveCalculationIntent()) return false;
            scheduleAutomaticRecalculationFlush();
            return true;
        } catch (error) {
            console.warn('無法恢復自動重算狀態:', error);
            return false;
        }
    };

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
        clearCalculationJobPollClaim(localStorage, getToken(), job.id);
        clearPendingCalculationRequest({ jobId: job.id });

        let automaticStatus = null;
        try {
            automaticStatus = settleAutomaticRecalculationJob(
                localStorage,
                getCalculationOwner(),
                job.id,
                { succeeded: job.status === 'succeeded' },
            );
        } catch (error) {
            console.warn('無法結算自動重算 coverage:', error);
            if (job.status === 'succeeded') {
                lastAutomaticRecalculationAttemptToken = null;
                scheduleAutomaticRecalculationFlush();
            }
        }

        if (job.status === 'succeeded') {
            if (automaticStatus?.dirty) scheduleAutomaticRecalculationFlush();
            try {
                await fetchAllFresh();
                addToast('✅ 數據已更新完畢！', 'success');
            } catch (error) {
                console.error('計算完成但重新載入資料失敗:', error);
                addToast('⚠️ 計算已完成；最新資料暫時載入失敗，系統將自動重試', 'warning');
            }
        } else {
            addToast(`後端計算失敗 (${job.error_code || 'UNKNOWN'})`, 'error');
        }
    };

    const pollCalculationJobOnce = async (jobId, addToast, epoch) => {
        const claimed = await claimCalculationJobPoll({
            storage: localStorage,
            token: getToken(),
            jobId,
            minimumIntervalMs: CALCULATION_JOB_POLL_DELAY_MS,
        });
        if (epoch !== calculationJobPollEpoch) return true;
        if (!claimed) return false;

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
                clearCalculationJobPollClaim(localStorage, getToken(), jobId);
                clearPendingCalculationRequest({ jobId });
                calculationJob.value = null;
                try {
                    settleAutomaticRecalculationJob(
                        localStorage,
                        getCalculationOwner(),
                        jobId,
                        { succeeded: false },
                    );
                    scheduleAutomaticRecalculationFlush();
                } catch (settleError) {
                    console.warn('找不到計算工作且無法釋放自動重算 coverage:', settleError);
                }
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
        if (!pending) return;
        try {
            rememberPendingCalculationRequest(pending);
        } catch (error) {
            console.warn('無法升級待處理計算恢復狀態:', error);
        }
        if (pending.jobId) void startCalculationJobPolling(pending.jobId);
    };

    const performFetchAll = async () => {
        await recoverPendingRecordCreateIntent();
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
            if (records.value.length === 0) clearAutomaticRecalculationForCurrentOwner();
            else resumeAutomaticRecalculation();
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

    const resolveRecordMutationOutcome = (outcome, { returnOutcome = false } = {}) => (
        returnOutcome ? outcome : isMutationCommitted(outcome)
    );

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
            addToast(`${action}已完成；最新交易紀錄暫時載入失敗，系統將自動重試`, 'warning');
            return { refreshed: false, refreshError };
        }
    };

    const recordMutationFailure = (error, { action, method, fallback }, addToast, options) => {
        const outcome = failedMutationOutcome(error);
        addToast(
            formatRequestError(error, { action, method, fallback }),
            outcome.outcomeAmbiguous ? 'warning' : 'error'
        );
        return resolveRecordMutationOutcome(outcome, options);
    };

    const postRecordCreateIntent = (intent) => fetchWithAuth('/api/records/idempotent', {
        method: 'POST',
        headers: {
            'Idempotency-Key': intent.idempotencyKey,
        },
        body: intent.body,
    });

    const settleRecordCreateIntentFailure = (intent, error) => {
        if (!intent || error?.outcomeAmbiguous === true) return;
        try {
            markRecordCreateIntentTerminal(
                localStorage,
                intent.owner,
                intent.idempotencyKey,
                {
                    reason: error?.apiCode || (error?.status ? `HTTP_${error.status}` : error?.code || 'REJECTED'),
                },
            );
        } catch (storageError) {
            console.warn('無法保存新增交易終止狀態:', storageError);
        }
    };

    const supersedePendingRecordCreateRecovery = () => {
        const owner = getRecordMutationOwner();
        const pending = readEligibleRecordCreateIntents(localStorage, owner);
        if (pending.length === 0) return false;
        rotateRecordMutationBarrier(localStorage, owner);
        return true;
    };

    const recoverPendingRecordCreateIntent = async () => {
        const owner = getRecordMutationOwner();
        if (!owner) return false;
        if (recordCreateRecoveryPromise) return recordCreateRecoveryPromise;

        let intent;
        try {
            [intent] = readEligibleRecordCreateIntents(localStorage, owner);
        } catch (error) {
            console.warn('無法讀取待恢復新增交易狀態:', error);
            return false;
        }
        if (!intent || lastRecordCreateRecoveryKey === intent.idempotencyKey) return false;
        lastRecordCreateRecoveryKey = intent.idempotencyKey;

        recordCreateRecoveryPromise = (async () => {
            const { addToast } = useToast();
            let json;
            try {
                json = await postRecordCreateIntent(intent);
            } catch (error) {
                settleRecordCreateIntentFailure(intent, error);
                if (isExplicitServerRejection(error)) {
                    addToast('先前未確認的新增交易無法安全恢復，已停止自動重試', 'error');
                }
                return false;
            }

            if (!json?.success) {
                const error = unconfirmedMutationError('恢復新增交易');
                settleRecordCreateIntentFailure(intent, error);
                return false;
            }

            try {
                completeRecordCreateIntent(localStorage, intent.owner, intent.idempotencyKey);
            } catch (error) {
                console.warn('新增交易已由伺服器確認，但本機恢復狀態清除失敗:', error);
            }
            markSnapshotStale();
            if (!json.auto_update) markCommittedMutationDirtyForAutomaticRecalculation();
            publishRecordCreateRecoverySuccess({
                owner: intent.owner,
                body: intent.body,
            });
            addToast('已自動確認先前未完成回應的新增交易', 'success');
            if (json.auto_update) handleAutoUpdateSignal('🚀 已恢復第一筆交易，系統正自動啟動背景計算...');
            return true;
        })().finally(() => {
            recordCreateRecoveryPromise = null;
        });

        return recordCreateRecoveryPromise;
    };

    const addRecord = async (formData, options = {}) => {
        const { addToast } = useToast();
        let intent;
        try {
            intent = beginRecordCreateIntent(localStorage, getRecordMutationOwner(), formData);
        } catch (error) {
            error.outcomeAmbiguous = false;
            return recordMutationFailure(error, {
                action: '新增交易',
                method: 'POST',
                fallback: '新增失敗',
            }, addToast, options);
        }

        let json;
        try {
            json = await postRecordCreateIntent(intent);
        } catch (error) {
            settleRecordCreateIntentFailure(intent, error);
            return recordMutationFailure(error, {
                action: '新增交易',
                method: 'POST',
                fallback: '新增失敗',
            }, addToast, options);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('新增交易');
            settleRecordCreateIntentFailure(intent, error);
            return recordMutationFailure(error, {
                action: '新增交易',
                method: 'POST',
                fallback: '新增失敗',
            }, addToast, options);
        }

        try {
            completeRecordCreateIntent(localStorage, intent.owner, intent.idempotencyKey);
        } catch (error) {
            console.warn('新增交易已提交，但本機待處理狀態清除失敗:', error);
        }
        markSnapshotStale();
        if (!json.auto_update) markCommittedMutationDirtyForAutomaticRecalculation();
        addToast('新增成功；持倉快照待重新計算', 'success');
        const refresh = await refreshRecordsAfterCommittedMutation('新增交易', addToast);
        if (json.auto_update) handleAutoUpdateSignal('🚀 這是您的第一筆交易，系統正自動啟動背景計算...');
        return resolveRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }), options);
    };

    const updateRecord = async (formData, options = {}) => {
        const { addToast } = useToast();
        try {
            supersedePendingRecordCreateRecovery();
        } catch (error) {
            error.outcomeAmbiguous = false;
            return recordMutationFailure(error, {
                action: '更新交易',
                method: 'PUT',
                fallback: '更新失敗',
            }, addToast, options);
        }

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
            }, addToast, options);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('更新交易');
            return recordMutationFailure(error, {
                action: '更新交易',
                method: 'PUT',
                fallback: '更新失敗',
            }, addToast, options);
        }

        markSnapshotStale();
        markCommittedMutationDirtyForAutomaticRecalculation();
        addToast('更新成功；持倉快照待重新計算', 'success');
        const refresh = await refreshRecordsAfterCommittedMutation('更新交易', addToast);
        return resolveRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }), options);
    };

    const deleteRecord = async (id, options = {}) => {
        const { addToast } = useToast();
        try {
            supersedePendingRecordCreateRecovery();
        } catch (error) {
            error.outcomeAmbiguous = false;
            return recordMutationFailure(error, {
                action: '刪除交易',
                method: 'DELETE',
                fallback: '刪除失敗',
            }, addToast, options);
        }

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
            }, addToast, options);
        }

        if (!json?.success) {
            const error = unconfirmedMutationError('刪除交易');
            return recordMutationFailure(error, {
                action: '刪除交易',
                method: 'DELETE',
                fallback: '刪除失敗',
            }, addToast, options);
        }

        markSnapshotStale();
        addToast('刪除成功；持倉快照待重新計算', 'success');

        if (json.message === 'RELOAD_UI') {
            clearAutomaticRecalculationForCurrentOwner();
            records.value = [];
            handleAutoUpdateSignal('🧹 紀錄已清空，系統正重置資產數據...');
            return resolveRecordMutationOutcome(committedMutationOutcome({
                response: json,
                refreshed: true,
            }), options);
        }

        markCommittedMutationDirtyForAutomaticRecalculation();
        const refresh = await refreshRecordsAfterCommittedMutation('刪除交易', addToast);
        return resolveRecordMutationOutcome(committedMutationOutcome({
            response: json,
            refreshed: refresh.refreshed,
            refreshError: refresh.refreshError,
        }), options);
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

    const getOrCreateIdempotencyKey = (targetBenchmark) => {
        const pending = readPendingCalculationRequest();
        if (pendingCalculationMatchesBenchmark(pending, targetBenchmark)) return pending.key;
        const key = createIdempotencyKey();
        rememberPendingCalculationRequest({
            key,
            createdAt: Date.now(),
            jobId: null,
            benchmark: targetBenchmark,
        });
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
                            addToast('⚠️ 已偵測到新快照；載入暫時失敗，系統將自動重試', 'warning');
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

    const performTriggerUpdate = async (benchmark = null, options = {}) => {
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

        const targetBenchmark = String(benchmark || selectedBenchmark.value || '').toUpperCase().trim();
        const idempotencyKey = getOrCreateIdempotencyKey(targetBenchmark);
        let generationAtDispatch = null;
        try {
            const automaticStatus = readAutomaticRecalculation();
            generationAtDispatch = automaticStatus.dirty ? automaticStatus.generation : null;
        } catch (error) {
            console.warn('無法讀取重算 dirty generation；本次計算仍可執行，但不宣告 coverage:', error);
        }

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
                    jobId: responseData.job.id,
                    benchmark: responseData.job.benchmark || targetBenchmark,
                });

                let coverageRecorded = false;
                if (generationAtDispatch && responseData.job.deduplicated !== true) {
                    try {
                        coverageRecorded = markAutomaticRecalculationCoverage(
                            localStorage,
                            getCalculationOwner(),
                            generationAtDispatch,
                            responseData.job,
                        );
                    } catch (error) {
                        console.warn('計算工作已建立，但無法保存 dirty-generation coverage:', error);
                    }
                }
                if (typeof options.onJob === 'function') {
                    options.onJob(responseData.job, {
                        generation: generationAtDispatch,
                        coverageRecorded,
                    });
                }

                const { addToast } = useToast();
                addToast(
                    responseData.job.deduplicated
                        ? '相同的計算要求已在排隊，繼續追蹤原工作'
                        : options.automatic
                            ? '🔄 交易已變更，系統正在自動重新計算...'
                            : '🔄 已建立後端計算工作，正在同步中...',
                    'info'
                );
                await startCalculationJobPolling(responseData.job.id);
            } else {
                clearPendingCalculationRequest({ key: idempotencyKey });
                handleAutoUpdateSignal(
                    options.automatic
                        ? '🔄 交易已變更，系統正在自動重新計算...'
                        : '🔄 已手動觸發數據重算，正在同步中...'
                );
            }
            return true;
        } catch (error) {
            const contextualError = markRequestOutcome(error, 'POST');
            if (isExplicitServerRejection(contextualError)) {
                clearPendingCalculationRequest({ key: idempotencyKey });
            }
            contextualError.message = formatRequestError(contextualError, {
                action: '觸發重算',
                method: 'POST',
                fallback: '觸發重算失敗',
            });
            console.error('Trigger failed:', contextualError);
            throw contextualError;
        }
    };

    const triggerUpdate = (benchmark = null, options = {}) => {
        if (triggerUpdatePromise) return triggerUpdatePromise;
        triggerUpdatePromise = performTriggerUpdate(benchmark, options).finally(() => {
            triggerUpdatePromise = null;
        });
        return triggerUpdatePromise;
    };

    const flushAutomaticRecalculation = async () => {
        if (automaticRecalculationPromise) return automaticRecalculationPromise;

        let status;
        try {
            status = readAutomaticRecalculation();
        } catch (error) {
            console.warn('無法讀取自動重算狀態:', error);
            return false;
        }
        if (!status.dirty || !status.generation) return false;
        if (hasActiveCalculationIntent()) return false;
        if (lastAutomaticRecalculationAttemptToken === status.generation.token) return false;

        lastAutomaticRecalculationAttemptToken = status.generation.token;
        const benchmark = selectedBenchmark.value || status.generation.benchmark;
        automaticRecalculationPromise = (async () => {
            try {
                await triggerUpdate(benchmark, {
                    automatic: true,
                    onJob: (job, metadata) => {
                        if (job?.deduplicated === true || metadata?.coverageRecorded !== true) {
                            lastAutomaticRecalculationAttemptToken = null;
                        }
                    },
                });
                return true;
            } catch (error) {
                console.warn('自動重新計算暫時失敗，保留 dirty generation 供後續安全恢復:', error);
                const { addToast } = useToast();
                addToast('交易已保存，但自動重新計算暫時失敗；稍後重新整理可安全恢復', 'warning');
                return false;
            }
        })().finally(() => {
            automaticRecalculationPromise = null;
        });
        return automaticRecalculationPromise;
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