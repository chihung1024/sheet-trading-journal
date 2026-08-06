import { ref, onMounted, onUnmounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from './useToast';
import {
    shouldScheduleMarketRefresh,
    shouldTriggerMarketRefresh
} from '../services/refreshPolicy';

/**
 * 盤中自動刷新 Composable
 * 功能：
 * 1. 台股盤中（09:00-13:30）和美股盤中自動觸發 triggerUpdate
 * 2. 每 3 分鐘執行一次，60 秒逾時
 * 3. 暫停或頁面隱藏時停止自動排程
 * 4. 自動判斷夏令/冬令時間
 */
export function useMarketHoursRefresh() {
    const isEnabled = ref(true);
    const isRunning = ref(false);
    const isPaused = ref(false);
    const lastTriggerTime = ref(null);
    const nextTriggerTime = ref(null);
    const currentMarket = ref(null); // 'TW', 'US', or null
    const timeRemaining = ref(0); // 倒數秒數

    let refreshTimer = null;
    let checkTimer = null;
    let countdownTimer = null;

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

        // 3月第二個週日
        const march = new Date(year, 2, 1);
        const marchSecondSunday = new Date(year, 2, 8 + (7 - march.getDay()) % 7);

        // 11月第一個週日
        const november = new Date(year, 10, 1);
        const novemberFirstSunday = new Date(year, 10, 1 + (7 - november.getDay()) % 7);

        return now >= marchSecondSunday && now < novemberFirstSunday;
    };

    /**
     * 判斷台股是否開盤
     * 週一至週五 09:00-13:30（台北時間）
     */
    const isTWMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        // 週一到週五 (1-5)
        if (day < 1 || day > 5) return false;

        // 09:00 (540分鐘) 到 13:30 (810分鐘)
        return timeInMinutes >= 540 && timeInMinutes <= 810;
    };

    /**
     * 判斷美股是否開盤
     * 夏令時間（EDT）：台北時間 21:30-04:00
     * 冬令時間（EST）：台北時間 22:30-05:00
     */
    const isUSMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        const isDST = isDaylightSavingTime();

        // 夏令：21:30-04:00，冬令：22:30-05:00
        const openTime = isDST ? 21 * 60 + 30 : 22 * 60 + 30;
        const closeTime = isDST ? 4 * 60 : 5 * 60;

        // 晚上時段 (21:30/22:30 - 23:59)：週一到週五
        if (timeInMinutes >= openTime && day >= 1 && day <= 5) {
            return true;
        }

        // 凌晨時段 (00:00 - 04:00/05:00)：週二到週六
        if (timeInMinutes <= closeTime && day >= 2 && day <= 6) {
            return true;
        }

        return false;
    };

    /**
     * 判斷是否為盤中時間
     */
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

    const getRefreshContext = () => {
        const hasToken = Boolean(authStore.token);
        return {
            enabled: isEnabled.value,
            paused: isPaused.value,
            visible: isPageVisible(),
            marketHours: isMarketHours(),
            hasToken,
            tokenExpired: !hasToken || authStore.isTokenExpired()
        };
    };

    const updateNextTriggerTime = () => {
        nextTriggerTime.value = new Date(Date.now() + INTERVAL_MS);
        timeRemaining.value = INTERVAL_SECONDS;
    };

    const startCountdown = () => {
        if (countdownTimer) return;
        countdownTimer = setInterval(() => {
            if (timeRemaining.value > 0) {
                timeRemaining.value--;
            }
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

    const triggerRefresh = async () => {
        const portfolioStore = usePortfolioStore();
        const { addToast } = useToast();
        const context = getRefreshContext();

        if (!shouldTriggerMarketRefresh({
            ...context,
            busy: portfolioStore.isPolling || portfolioStore.loading,
            running: isRunning.value
        })) {
            console.log('⏸️ [盤中刷新] 目前條件不允許自動刷新，跳過此次更新');
            return false;
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
            if (error.message === 'TIMEOUT') {
                console.warn('⚠️ [盤中刷新] triggerUpdate 逾時');
                addToast('股價更新逾時，將於後續排程重試', 'warning');
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

        console.log(`📈 [盤中刷新] 進入${currentMarket.value === 'TW' ? '台股' : '美股'}盤中時段`);
        updateNextTriggerTime();
        startCountdown();

        refreshTimer = setInterval(() => {
            const intervalContext = getRefreshContext();
            if (!shouldScheduleMarketRefresh(intervalContext)) {
                stopActiveSchedule();
                return;
            }
            void triggerRefresh();
            updateNextTriggerTime();
        }, INTERVAL_MS);

        if (triggerImmediately) {
            void triggerRefresh();
        }
        return true;
    };

    const startMarketRefresh = () => {
        if (!checkTimer) {
            console.log('✨ [盤中刷新] 系統已啟動，每分鐘檢查自動刷新資格');
            checkTimer = setInterval(() => {
                evaluateMarketRefresh({ triggerImmediately: true });
            }, 60 * 1000);
        }

        evaluateMarketRefresh({ triggerImmediately: true });
    };

    const formattedTimeRemaining = () => {
        const minutes = Math.floor(timeRemaining.value / 60);
        const seconds = timeRemaining.value % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const togglePause = () => {
        isPaused.value = !isPaused.value;
        if (isPaused.value) {
            stopActiveSchedule();
            return;
        }
        evaluateMarketRefresh({ triggerImmediately: true });
    };

    const stopMarketRefresh = () => {
        stopActiveSchedule();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        console.log('🚦 [盤中刷新] 系統已關閉');
    };

    const handleVisibilityChange = () => {
        if (!isPageVisible()) {
            stopActiveSchedule();
            return;
        }
        evaluateMarketRefresh({ triggerImmediately: true });
    };

    const manualTrigger = () => {
        console.log('🔧 [盤中刷新] 手動觸發更新');
        void triggerRefresh();
    };

    watch(() => authStore.token, (newToken) => {
        if (newToken && isEnabled.value) {
            startMarketRefresh();
        } else {
            stopMarketRefresh();
        }
    });

    watch(isEnabled, (enabled) => {
        if (enabled && authStore.token) {
            startMarketRefresh();
        } else {
            stopMarketRefresh();
        }
    });

    onMounted(() => {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        if (authStore.token && isEnabled.value) {
            startMarketRefresh();
        }
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
        manualTrigger
    };
}
