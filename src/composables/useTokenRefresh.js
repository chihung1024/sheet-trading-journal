import { onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

/**
 * Token 自動刷新 Composable
 * 功能：
 * 1. 定期檢查 Token 是否即將過期
 * 2. 使用 Google Identity Services 靜默刷新
 * 3. 刷新失敗時登出
 */
export function useTokenRefresh() {
    let checkTimer = null;
    const CHECK_INTERVAL = 5 * 60 * 1000; // 每 5 分鐘檢查一次
    const REFRESH_BEFORE_EXPIRE = 10 * 60; // 過期前 10 分鐘刷新

    /**
     * 檢查並刷新 Token
     */
    const checkAndRefresh = async () => {
        const authStore = useAuthStore();

        if (!authStore.token) return;

        // 解析 Token 過期時間
        try {
            const parts = authStore.token.split('.');
            if (parts.length !== 3) return;

            const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64Payload));
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpire = payload.exp - now;

            console.log(`🔐 [Token 刷新] Token 剩餘有效時間: ${Math.floor(timeUntilExpire / 60)} 分鐘`);

            // 如果距離過期不到 10 分鐘，嘗試刷新
            if (timeUntilExpire < REFRESH_BEFORE_EXPIRE) {
                console.log('🔄 [Token 刷新] Token 即將過期，嘗試靜默刷新...');
                const success = await silentRefresh();

                if (!success) {
                    console.warn('⚠️ [Token 刷新] 靜默刷新失敗，將在下次 API 呼叫時重試');
                }
            }
        } catch (e) {
            console.error('❌ [Token 刷新] Token 解析失敗:', e);
        }
    };

    /**
     * 靜默刷新 Token
     */
    const silentRefresh = async () => {
        if (!window.google?.accounts?.id) {
            console.warn('⚠️ [Token 刷新] Google Identity Services 未載入');
            return false;
        }

        const authStore = useAuthStore();

        return new Promise((resolve) => {
            try {
                window.google.accounts.id.initialize({
                    client_id: CONFIG.GOOGLE_CLIENT_ID,
                    callback: async (response) => {
                        console.log('🔐 [Token 刷新] 收到新的 Google 憑證');
                        try {
                            await authStore.login(response.credential);
                            console.log('✅ [Token 刷新] Token 刷新成功！');
                            resolve(true);
                        } catch (error) {
                            console.error('❌ [Token 刷新] 登入失敗:', error);
                            resolve(false);
                        }
                    },
                    auto_select: true,
                    cancel_on_tap_outside: false
                });

                // 觸發 One Tap 提示
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {
                        const reason = notification.getNotDisplayedReason();
                        console.log(`⚠️ [Token 刷新] One Tap 未顯示: ${reason}`);

                        // 如果是 opt_out_or_no_session，表示用戶沒有有效的 Google session
                        if (reason === 'opt_out_or_no_session' ||
                            reason === 'suppressed_by_user') {
                            resolve(false);
                        }
                    } else if (notification.isSkippedMoment()) {
                        console.log('⚠️ [Token 刷新] One Tap 被跳過');
                        resolve(false);
                    } else if (notification.isDismissedMoment()) {
                        console.log('⚠️ [Token 刷新] One Tap 被關閉');
                        resolve(false);
                    }
                });

                // 設定 10 秒逾時
                setTimeout(() => {
                    resolve(false);
                }, 10000);

            } catch (error) {
                console.error('❌ [Token 刷新] 初始化失敗:', error);
                resolve(false);
            }
        });
    };

    /**
     * 啟動定期檢查
     */
    const startTokenCheck = () => {
        if (checkTimer) return;

        console.log('🔐 [Token 刷新] 啟動 Token 過期檢查（每 5 分鐘）');

        // 立即檢查一次
        checkAndRefresh();

        // 設定定期檢查
        checkTimer = setInterval(checkAndRefresh, CHECK_INTERVAL);
    };

    const stopTokenCheck = () => {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    };

    onMounted(() => {
        const authStore = useAuthStore();
        if (authStore.token) {
            startTokenCheck();
        }
    });

    onUnmounted(() => {
        stopTokenCheck();
    });

    return {
        checkAndRefresh,
        silentRefresh,
        startTokenCheck,
        stopTokenCheck
    };
}
