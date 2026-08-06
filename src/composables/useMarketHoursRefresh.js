import { ref, onMounted, onUnmounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from './useToast';
import { createMarketRefreshLeadership } from '../services/marketRefreshLeadership.js';
import {
    shouldCompeteForMarketRefreshLeadership,
    shouldScheduleMarketRefresh,
    shouldTriggerMarketRefresh,
} from '../services/refreshPolicy.js';

/**
 * 盤中自動刷新 Composable
 * 1. 台股盤中（09:00-13:30）和美股盤中自動觸發 triggerUpdate
 * 2. 每 3 分鐘執行一次，60 秒逾時
 * 3. 暫停、隱藏、登出或失去跨分頁 leadership 時停止自動排程
 * 4. 同一登入者只有一個可見分頁擁有自動刷新與倒數 timer
 * 5. 自動判斷夏令/冬令時間
 */
export function useMarketHoursRefresh() {
    const isEnabled = ref(true);
    const isRunning = ref(false);
    const isPaused = ref(false);
    const isLeader = ref(false);
    const lastTriggerTime = ref(null);
    const nextTriggerTime = ref(null);
    const currentMarket = ref(null); // 'TW', 'US', or null
    const timeRemaining = ref(0);

    let refreshTimer = null;
    let checkTimer = null;
    let countdownTimer = null;
    let leadership = null;
    let leadershipSyncPromise = null;

    const INTERVAL_MS = 3 * 60 * 1000;
    const INTERVAL_SECONDS = 3 * 60;
    const TIMEOUT_MS = 60 * 1000;

    const authStore = useAuthStore();

    const isPageVisible = () => {
        if (typeof document === 'undefined') return true;
        return document.visibilityState !== 'hidden';
    };

    /**
     * 判斷是否為美國夏令時間
     * 夏令時間：3月第二個週日 02:00 ~ 11月第一個週日 02:00
     */
    const isDaylightSavingTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const march = new Date(year, 2, 1);
        const marchSecondSunday = new Date(year, 2, 8 + (7 - march.getDay()) % 7);
        const november = new Date(year, 10, 1);
        const novemberFirstSunday = new Date(year, 10, 1 + (7 - november.getDay()) % 7);
        return now >= marchSecondSunday && now < novemberFirstSunday;
    };

    /** 台股：週一至週五 09:00-13:30（台北時間） */
    const isTWMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const timeInMinutes = now.getHours() * 60 + now.getMinutes();
        if (day < 1 || day > 5) return false;
        return timeInMinutes >= 540 && timeInMinutes <= 810;
    };

    /** 美股：夏令 21:30-04:00，冬令 22:30-05:00（台北時間） */
    const isUSMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const timeInMinutes = now.getHours() * 60 + now.getMinutes();
        const isDST = isDaylightSavingTime();
        const openTime = isDST ? 21 * 60 + 30 : 22 * 60 + 30;
        const closeTime = isDST ? 4 * 60 : 5 * 60;

        if (timeInMinutes >= openTime && day >= 1 && day <= 5) return true;
        if (timeInMinutes <= closeTime && day >= 2 && day <= 6) return true;
        return false;
    };

    const isMarketHours = () => {
        if (isTWMarketOpen()) {
            currentMarket.value = 'TW';
            return true;
        }
        if (isUSMarketOpen()) {
            currentMarket.value = 'US';
            return true;
        }
        currentMarket.value = null;
        return false;
    };

    const getBaseRefreshContext = () => {
        const hasToken = Boolean(authStore.token);
        return {
            enabled: isEnabled.value,
            paused: isPaused.value,
            visible: isPageVisible(),
            marketHours: isMarketHours(),
            hasToken,
            tokenExpired: !hasToken || authStore.isTokenExpired(),
        };
    };

    const getRefreshContext = () => ({
        ...getBaseRefreshContext(),
        hasLeadership: isLeader.value && leadership?.isLeader() === true,
    });

    const updateNextTriggerTime = () => {
        nextTriggerTime.value = new Date(Date.now() + INTERVAL_MS);
        timeRemaining.value = INTERVAL_SECONDS;
    };

    const startCountdown = () => {
        if (countdownTimer) return;
        countdownTimer = setInterval(() => {
            if (timeRemaining.value > 0) timeRemaining.value--;
        }, 1000);
    };

    const stopCountdown = () => {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    };

    const stopRefreshTimer = () => {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        nextTriggerTime.value = null;
    };

    const stopActiveSchedule = () => {
        stopRefreshTimer();
        stopCountdown();
        timeRemaining.value = 0;
    };

    const triggerRefresh = async ({ automatic = true } = {}) => {
        const portfolioStore = usePortfolioStore();
        const { addToast } = useToast();
        const context = getRefreshContext();
        const policyContext = automatic
            ? context
            : { ...context, hasLeadership: true };

        if (!shouldTriggerMarketRefresh({
            ...policyContext,
            busy: portfolioStore.isPolling || portfolioStore.loading,
            running: isRunning.value,
        })) {
            console.log('⏸️ [盤中刷新] 目前條件不允許刷新，跳過此次更新');
            return false;
        }

        if (automatic) {
            const claimed = await leadership?.claimAutomaticAction(INTERVAL_MS);
            if (!claimed) {
                console.log('🔗 [盤中刷新] 其他分頁已取得本次自動刷新權');
                return false;
            }

            const confirmedContext = getRefreshContext();
            if (!shouldTriggerMarketRefresh({
                ...confirmedContext,
                busy: portfolioStore.isPolling || portfolioStore.loading,
                running: isRunning.value,
            })) return false;
        }

        isRunning.value = true;
        lastTriggerTime.value = new Date();
        const market = currentMarket.value === 'TW' ? '台股' : '美股';
        console.log(`🚀 [盤中刷新] ${market}盤中，觸發 triggerUpdate...`);

        let timeoutId = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
            });
            const updatePromise = portfolioStore.triggerUpdate();
            await Promise.race([updatePromise, timeoutPromise]);
            console.log('✅ [盤中刷新] triggerUpdate 完成');
            return true;
        } catch (error) {
            if (error?.message === 'TIMEOUT') {
                console.warn('⚠️ [盤中刷新] triggerUpdate 逾時');
                addToast('股價更新逾時，請先確認目前工作狀態', 'warning');
            } else {
                console.error('❌ [盤中刷新] triggerUpdate 失敗:', error);
            }
            return false;
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
            isRunning.value = false;
        }
    };

    const evaluateMarketRefresh = ({ triggerImmediately = false } = {}) => {
        const context = getRefreshContext();
        if (!shouldScheduleMarketRefresh(context)) {
            stopActiveSchedule();
            return false;
        }
        if (refreshTimer) return true;

        console.log(`📈 [盤中刷新] 本分頁取得${currentMarket.value === 'TW' ? '台股' : '美股'}自動刷新 leadership`);
        updateNextTriggerTime();
        startCountdown();

        refreshTimer = setInterval(() => {
            const intervalContext = getRefreshContext();
            if (!shouldScheduleMarketRefresh(intervalContext)) {
                stopActiveSchedule();
                return;
            }
            void triggerRefresh({ automatic: true });
            updateNextTriggerTime();
        }, INTERVAL_MS);

        if (triggerImmediately) void triggerRefresh({ automatic: true });
        return true;
    };

    const handleLeadershipChange = (nextLeader) => {
        isLeader.value = nextLeader === true;
        if (!isLeader.value) {
            stopActiveSchedule();
            return;
        }
        evaluateMarketRefresh({ triggerImmediately: true });
    };

    const ensureLeadership = () => {
        if (leadership) return leadership;
        try {
            leadership = createMarketRefreshLeadership({
                storage: globalThis.localStorage,
                eventTarget: globalThis.window,
                onLeadershipChange: handleLeadershipChange,
                logger: console,
            });
        } catch (error) {
            console.error('❌ [盤中刷新] 無法建立跨分頁協調器，自動刷新停用:', error);
            leadership = null;
        }
        return leadership;
    };

    const stopLeadership = () => {
        leadership?.stop();
        isLeader.value = false;
        stopActiveSchedule();
    };

    const syncLeadership = () => {
        if (leadershipSyncPromise) return leadershipSyncPromise;

        leadershipSyncPromise = Promise.resolve().then(async () => {
            const baseContext = getBaseRefreshContext();
            if (!shouldCompeteForMarketRefreshLeadership(baseContext)) {
                stopLeadership();
                return false;
            }

            const coordinator = ensureLeadership();
            if (!coordinator) {
                stopActiveSchedule();
                return false;
            }

            const elected = await coordinator.start(authStore.token);
            isLeader.value = elected && coordinator.isLeader();
            if (isLeader.value) evaluateMarketRefresh({ triggerImmediately: true });
            else stopActiveSchedule();
            return isLeader.value;
        }).finally(() => {
            leadershipSyncPromise = null;
        });

        return leadershipSyncPromise;
    };

    const startMarketRefresh = () => {
        if (!checkTimer) {
            console.log('✨ [盤中刷新] 系統已啟動，每分鐘檢查自動刷新資格');
            checkTimer = setInterval(() => {
                void syncLeadership();
            }, 60 * 1000);
        }
        void syncLeadership();
    };

    const formattedTimeRemaining = () => {
        const minutes = Math.floor(timeRemaining.value / 60);
        const seconds = timeRemaining.value % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const togglePause = () => {
        isPaused.value = !isPaused.value;
        if (isPaused.value) {
            stopLeadership();
            return;
        }
        void syncLeadership();
    };

    const stopMarketRefresh = () => {
        stopActiveSchedule();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        stopLeadership();
        console.log('🚦 [盤中刷新] 系統已關閉');
    };

    const handleVisibilityChange = () => {
        if (!isPageVisible()) {
            stopLeadership();
            return;
        }
        void syncLeadership();
    };

    const manualTrigger = () => {
        console.log('🔧 [盤中刷新] 手動觸發更新');
        void triggerRefresh({ automatic: false });
    };

    watch(() => authStore.token, (newToken) => {
        if (newToken && isEnabled.value) startMarketRefresh();
        else stopMarketRefresh();
    });

    watch(isEnabled, (enabled) => {
        if (enabled && authStore.token) startMarketRefresh();
        else stopMarketRefresh();
    });

    onMounted(() => {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        if (authStore.token && isEnabled.value) startMarketRefresh();
    });

    onUnmounted(() => {
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        stopMarketRefresh();
    });

    return {
        isEnabled,
        isRunning,
        isPaused,
        isLeader,
        lastTriggerTime,
        nextTriggerTime,
        currentMarket,
        timeRemaining,
        isMarketHours,
        isTWMarketOpen,
        isUSMarketOpen,
        isDaylightSavingTime,
        formattedTimeRemaining,
        togglePause,
        startMarketRefresh,
        stopMarketRefresh,
        manualTrigger,
    };
}
