(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let busy = false;
  let reloadPending = false;

  async function activate(registration) {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadPending) return;
    reloadPending = true;
    location.reload();
  });

  async function update() {
    if (busy) return;
    busy = true;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        updateViaCache: 'none',
      });

      registration.addEventListener(
        'updatefound',
        () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              void activate(registration);
            }
          });
        },
        { once: true },
      );

      await registration.update();
      await activate(registration);
    } catch (error) {
      console.warn('[CR3@TIX MAP] update:', error);
    } finally {
      busy = false;
    }
  }

  addEventListener('load', update, { once: true });
  addEventListener('focus', update);
  addEventListener('pageshow', update);
  addEventListener('online', update);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void update();
  });

  setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void update();
    }
  }, 2 * 60 * 1000);
})();
