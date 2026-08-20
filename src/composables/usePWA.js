import { ref, onMounted } from 'vue';

export function usePWA() {
  const needRefresh = ref(false);

  const updateServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
    }
  };

  onMounted(() => {
    // Preserve the current product behavior: do not show an unsolicited browser install prompt.
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === 'installed'
              && navigator.serviceWorker.controller
            ) {
              needRefresh.value = true;
            }
          };
        });
      });
    }
  });

  return {
    needRefresh,
    updateServiceWorker,
  };
}
