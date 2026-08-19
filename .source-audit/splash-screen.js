(() => {
  'use strict';

  const splash = document.getElementById('appSplash');
  const fill = document.getElementById('appSplashFill');
  if (!splash || !fill) return;

  const DURATION = 3200;
  const HOLD_AT_100 = 180;
  const EXIT_DURATION = 450;

  let started = false;
  let finished = false;
  let rafId = 0;

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const easeInOutCubic = (t) => (
    t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2
  );

  function setProgress(progress) {
    const p = clamp01(progress);
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    splash.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }

  function complete() {
    if (finished) return;
    finished = true;

    if (rafId) cancelAnimationFrame(rafId);
    setProgress(1);
    splash.classList.add('is-complete');

    window.setTimeout(() => {
      splash.classList.add('is-exiting');

      window.setTimeout(() => {
        if (splash.parentNode) splash.remove();
        window.dispatchEvent(new CustomEvent('splash-complete'));
      }, EXIT_DURATION);
    }, HOLD_AT_100);
  }

  function start() {
    if (started || finished) return;
    started = true;

    setProgress(0);
    splash.classList.add('is-ready');
    const startTime = performance.now();

    function frame(now) {
      if (finished) return;

      const raw = clamp01((now - startTime) / DURATION);
      setProgress(easeInOutCubic(raw));

      if (raw >= 1) {
        complete();
        return;
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
  }

  // The artwork must be decoded before the splash is revealed. This avoids
  // any black frame or loader-only frame on cold start and cached reloads.
  const img = new Image();
  img.decoding = 'async';
  img.src = 'assets/splash-screen.png';

  const reveal = () => {
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {}).finally(start);
    } else {
      start();
    }
  };

  if (img.complete) {
    reveal();
  } else {
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', start, { once: true });
  }
})();
