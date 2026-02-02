import { ref, onMounted, onUnmounted } from 'vue';

/**
 * useAutoRefresh - 自動刷新 Composable (v14.0)
 * 功能：
 * 1. 定時觸發數據更新回調 (預設每 5 分鐘)。
 * 2. 智慧監測：僅在頁面可見時執行，節省系統資源。
 * 3. 狀態追蹤：提供倒數計時與下次更新時間，增加 UI 透明度。
 * 4. 提供手動刷新接口，並自動重置定時器。
 */
export function useAutoRefresh(callback, intervalMinutes = 5) {
  const isEnabled = ref(true);
  const isPaused = ref(false);
  const timeRemaining = ref(intervalMinutes * 60); // 剩餘秒數
  const nextUpdateTime = ref(null);
  
  let refreshTimer = null;
  let countdownTimer = null;
  let isPageVisible = true;

  /**
   * 計算並設定下一次預計更新的時間點
   */
  const calculateNextUpdateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + intervalMinutes);
    nextUpdateTime.value = now;
  };

  /**
   * 啟動自動刷新計時器
   */
  const startRefresh = () => {
    if (!isEnabled.value || isPaused.value) return;
    
    stopRefresh(); // 啟動前先清除舊有計時器，避免堆疊
    calculateNextUpdateTime();
    timeRemaining.value = intervalMinutes * 60;
    
    // 主刷新計時器：執行實際的數據抓取
    refreshTimer = setInterval(() => {
      if (isPageVisible && !isPaused.value) {
        console.log('🔄 [AutoRefresh] 觸發定時數據同步 (v14.0 NAV)...');
        callback();
        calculateNextUpdateTime();
        timeRemaining.value = intervalMinutes * 60;
      }
    }, intervalMinutes * 60 * 1000);
    
    // 倒數計時器：更新 UI 上的秒數顯示
    countdownTimer = setInterval(() => {
      if (isPageVisible && !isPaused.value && timeRemaining.value > 0) {
        timeRemaining.value--;
      }
    }, 1000);
  };

  /**
   * 停止所有計時器
   */
  const stopRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    refreshTimer = null;
    countdownTimer = null;
  };

  /**
   * 切換暫停/恢復狀態
   */
  const togglePause = () => {
    isPaused.value = !isPaused.value;
    if (!isPaused.value) {
      console.log('▶️ [AutoRefresh] 恢復自動監控');
      startRefresh();
    } else {
      console.log('⏸️ [AutoRefresh] 暫停自動監控');
    }
  };

  /**
   * 🚀 手動立即刷新
   * 執行傳入的 callback 並重時計時器，確保數據新鮮度
   */
  const manualRefresh = async () => {
    console.log('⚡ [AutoRefresh] 執行手動即時刷新...');
    await callback();
    startRefresh(); // 重新計算下次更新時間
  };

  /**
   * 處理頁面可見性變動 (Visibility API)
   */
  const handleVisibilityChange = () => {
    isPageVisible = !document.hidden;
    
    if (isPageVisible && isEnabled.value && !isPaused.value) {
      console.log('👁️ [AutoRefresh] 視窗恢復可見');
      // 若在背景期間已超時，恢復後立即刷新
      if (timeRemaining.value <= 0) {
        manualRefresh();
      }
    } else if (!isPageVisible) {
      console.log('😴 [AutoRefresh] 視窗進入背景，掛起計時');
    }
  };

  /**
   * 格式化剩餘時間 (MM:SS) 供 UI 組件直接調用
   */
  const formattedTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining.value / 60);
    const seconds = timeRemaining.value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  onMounted(() => {
    console.log(`✨ [AutoRefresh] 初始化完成，監控頻率: ${intervalMinutes} min`);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startRefresh();
  });

  onUnmounted(() => {
    console.log('🛑 [AutoRefresh] 組件卸載，清除計時器');
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    stopRefresh();
  });

  return {
    isEnabled,
    isPaused,
    timeRemaining,
    nextUpdateTime,
    togglePause,
    manualRefresh,
    formattedTimeRemaining
  };
}
