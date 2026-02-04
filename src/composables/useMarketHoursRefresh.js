import { ref, onMounted, onUnmounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from './useToast';

/**
 * 盤中自動刷新 Composable
 * 功能：
 * 1. 台股盤中（09:00-13:30）和美股盤中自動觸發 triggerUpdate
 * 2. 每 3 分鐘執行一次，60 秒逾時
 * 3. 無視頁面可見性，背景也會持續運作
 * 4. 自動判斷夏令/冬令時間
 */
export function useMarketHoursRefresh() {
    const isEnabled = ref(true);
    const isRunning = ref(false);
    const lastTriggerTime = ref(null);
    const nextTriggerTime = ref(null);
    const currentMarket = ref(null); // 'TW', 'US', or null

    let refreshTimer = null;
    let checkTimer = null;

    const INTERVAL_MS = 3 * 60 * 1000; // 3 分鐘
    const TIMEOUT_MS = 60 * 1000; // 60 秒逾時

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
        const openTime = isDST ? 21 * 60 + 30 : 22 * 60 + 30;  // 21:30 或 22:30
        const closeTime = isDST ? 4 * 60 : 5 * 60;  // 04:00 或 05:00

        // 美股交易日：週一晚上到週五凌晨，對應台北時間週二到週六
        // 週一晚上開盤（台北週二凌晨收盤）... 週五晚上開盤（台北週六凌晨收盤）

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

    /**
     * 觸發更新（帶逾時控制）
     */
    const triggerRefresh = async () => {
        const portfolioStore = usePortfolioStore();
        const authStore = useAuthStore();
        const { addToast } = useToast();

        // 檢查登入狀態
        if (!authStore.token || authStore.isTokenExpired()) {
            console.log('⏸️ [盤中刷新] Token 無效，跳過此次刷新');
            return;
        }

        // 檢查是否正在輪詢
        if (portfolioStore.isPolling || portfolioStore.loading) {
            console.log('⏸️ [盤中刷新] 系統忙碌中，跳過此次刷新');
            return;
        }

        isRunning.value = true;
        lastTriggerTime.value = new Date();

        const market = currentMarket.value === 'TW' ? '台股' : '美股';
        console.log(`🚀 [盤中刷新] ${market}盤中，觸發 triggerUpdate...`);

        try {
            // 使用 Promise.race 實現逾時控制
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
            });

            const updatePromise = portfolioStore.triggerUpdate();

            await Promise.race([updatePromise, timeoutPromise]);

            console.log('✅ [盤中刷新] triggerUpdate 完成');

        } catch (error) {
            if (error.message === 'TIMEOUT') {
                console.warn('⚠️ [盤中刷新] triggerUpdate 逾時（60秒），將繼續等待下次觸發');
                addToast('股價更新逾時，將於 3 分鐘後重試', 'warning');
            } else {
                console.error('❌ [盤中刷新] triggerUpdate 失敗:', error);
            }
        } finally {
            isRunning.value = false;
        }
    };

    /**
     * 啟動盤中刷新
     */
    const startMarketRefresh = () => {
        if (refreshTimer) return;

        console.log('✨ [盤中刷新] 系統已啟動，每 3 分鐘檢查並觸發更新');

        // 每分鐘檢查一次是否為盤中
        checkTimer = setInterval(() => {
            if (!isEnabled.value) return;

            const inMarketHours = isMarketHours();

            if (inMarketHours && !refreshTimer) {
                // 進入盤中，啟動 3 分鐘輪詢
                console.log(`📈 [盤中刷新] 進入${currentMarket.value === 'TW' ? '台股' : '美股'}盤中時段`);

                // 立即觸發一次
                triggerRefresh();
                updateNextTriggerTime();

                // 設定 3 分鐘定時器
                refreshTimer = setInterval(() => {
                    if (isMarketHours() && isEnabled.value) {
                        triggerRefresh();
                        updateNextTriggerTime();
                    } else {
                        stopRefreshTimer();
                    }
                }, INTERVAL_MS);

            } else if (!inMarketHours && refreshTimer) {
                // 離開盤中，停止輪詢
                console.log('📉 [盤中刷新] 離開盤中時段，停止自動刷新');
                stopRefreshTimer();
            }
        }, 60 * 1000); // 每分鐘檢查

        // 啟動時立即檢查一次
        if (isMarketHours()) {
            triggerRefresh();
            updateNextTriggerTime();

            refreshTimer = setInterval(() => {
                if (isMarketHours() && isEnabled.value) {
                    triggerRefresh();
                    updateNextTriggerTime();
                } else {
                    stopRefreshTimer();
                }
            }, INTERVAL_MS);
        }
    };

    const updateNextTriggerTime = () => {
        nextTriggerTime.value = new Date(Date.now() + INTERVAL_MS);
    };

    const stopRefreshTimer = () => {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        nextTriggerTime.value = null;
    };

    const stopMarketRefresh = () => {
        stopRefreshTimer();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        console.log('🚦 [盤中刷新] 系統已關閉');
    };

    /**
     * 手動觸發（測試用）
     */
    const manualTrigger = () => {
        console.log('🔧 [盤中刷新] 手動觸發更新');
        triggerRefresh();
    };

    // 監聽登入狀態
    const authStore = useAuthStore();
    watch(() => authStore.token, (newToken) => {
        if (newToken && isEnabled.value) {
            startMarketRefresh();
        } else if (!newToken) {
            stopMarketRefresh();
        }
    });

    onMounted(() => {
        if (authStore.token && isEnabled.value) {
            startMarketRefresh();
        }
    });

    onUnmounted(() => {
        stopMarketRefresh();
    });

    return {
        isEnabled,
        isRunning,
        lastTriggerTime,
        nextTriggerTime,
        currentMarket,
        isMarketHours,
        isTWMarketOpen,
        isUSMarketOpen,
        isDaylightSavingTime,
        startMarketRefresh,
        stopMarketRefresh,
        manualTrigger
    };
}
