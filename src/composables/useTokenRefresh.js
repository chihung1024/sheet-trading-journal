import { onUnmounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
    createTokenRefreshMonitor,
    TOKEN_CHECK_INTERVAL_MS,
    TOKEN_REFRESH_THRESHOLD_SECONDS,
} from '../services/tokenRefreshMonitor.js';

export function useTokenRefresh() {
    const authStore = useAuthStore();
    const monitor = createTokenRefreshMonitor({
        getToken: () => authStore.token,
        refreshToken: () => authStore.refreshToken(),
        checkIntervalMs: TOKEN_CHECK_INTERVAL_MS,
        refreshThresholdSeconds: TOKEN_REFRESH_THRESHOLD_SECONDS,
        logger: console,
    });

    const stopTokenWatch = watch(
        () => authStore.token,
        (currentToken) => {
            monitor.syncToken(currentToken);
            if (!currentToken) authStore.cancelTokenRefresh();
        },
        { immediate: true },
    );

    onUnmounted(() => {
        stopTokenWatch();
        monitor.stop();
        authStore.cancelTokenRefresh();
    });

    return {
        checkAndRefresh: monitor.checkAndRefresh,
        silentRefresh: () => authStore.refreshToken(),
        startTokenCheck: monitor.start,
        stopTokenCheck: monitor.stop,
    };
}
