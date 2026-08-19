/* CR3@TIX MAP — extra global map zoom-out */
(() => {
  'use strict';

  const EXTRA_SCALE = 0.88; // ~12% more zoom-out than the current minimum

  function applyExtraZoom() {
    const world = document.getElementById('world') || document.querySelector('.world');
    if (!world) return;

    world.style.setProperty('scale', String(EXTRA_SCALE), 'important');
    world.style.setProperty('transform-origin', 'center center', 'important');
  }

  const start = () => {
    applyExtraZoom();
    window.addEventListener('resize', applyExtraZoom, { passive: true });
    document.addEventListener('fullscreenchange', applyExtraZoom);
    document.addEventListener('webkitfullscreenchange', applyExtraZoom);
    [250, 800, 1600].forEach(ms => setTimeout(applyExtraZoom, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
