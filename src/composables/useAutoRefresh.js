import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 自動刷新 Composable
 * 功能：
 * 1. 按指定間隔自動刷新數據（預設 3 分鐘）
 * 2. 無視頁面可見性，背景也會持續運作
 * 3. 提供倒數計時與手動控制
 */
export function useAutoRefresh(callback, intervalMinutes = 3) {
  const isEnabled = ref(true);
  const isPaused = ref(false);
  const timeRemaining = ref(intervalMinutes * 60); // 秒
  const nextUpdateTime = ref(null);

  let refreshTimer = null;
  let countdownTimer = null;

  // 計算下次更新時間
  const calculateNextUpdateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + intervalMinutes);
    nextUpdateTime.value = now;
  };

  // 啟動刷新
  const startRefresh = () => {
    if (!isEnabled.value || isPaused.value) return;

    stopRefresh(); // 清除舊的計時器
    calculateNextUpdateTime();
    timeRemaining.value = intervalMinutes * 60;

    // 主要刷新計時器
    refreshTimer = setInterval(() => {
      if (!isPaused.value) {
        console.log('🔄 [自動刷新] 觸發定時更新...');
        callback();
        calculateNextUpdateTime();
        timeRemaining.value = intervalMinutes * 60;
      }
    }, intervalMinutes * 60 * 1000);

    // 倒數計時器 (每秒更新)
    countdownTimer = setInterval(() => {
      if (!isPaused.value && timeRemaining.value > 0) {
        timeRemaining.value--;
      }
    }, 1000);
  };

  // 停止刷新
  const stopRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  };

  // 暫停/恢復
  const togglePause = () => {
    isPaused.value = !isPaused.value;
    if (!isPaused.value) {
      startRefresh();
    }
  };

  // 手動觸發刷新（並重置計時器）
  const manualRefresh = async () => {
    console.log('🔄 [手動刷新] 立即更新數據...');
    await callback();
    startRefresh(); // 重置計時器
  };

  // 頁面可見性監聽（保留用於頁面恢復時檢查是否需要立即刷新）
  const handleVisibilityChange = () => {
    const isPageVisible = !document.hidden;

    if (isPageVisible && isEnabled.value && !isPaused.value) {
      console.log('👁️ 頁面恢復可見');
      // 頁面恢復可見時，如果倒數已結束，立即刷新
      if (timeRemaining.value <= 0) {
        manualRefresh();
      }
    }
  };

  // 格式化倒數時間
  const formattedTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining.value / 60);
    const seconds = timeRemaining.value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  onMounted(() => {
    console.log(`✨ [自動刷新] 系統已啟動，每 ${intervalMinutes} 分鐘更新一次`);

    // 監聽頁面可見性
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 啟動刷新
    if (isEnabled.value) {
      startRefresh();
    }
  });

  onUnmounted(() => {
    console.log('🚦 [自動刷新] 系統已關閉');
    stopRefresh();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    isEnabled,
    isPaused,
    timeRemaining,
    nextUpdateTime,
    formattedTimeRemaining,
    togglePause,
    manualRefresh,
    startRefresh,
    stopRefresh
  };
}
