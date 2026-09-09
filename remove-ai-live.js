/* CR3@TIX MAP — retire définitivement la vignette publique CR3@TIX AI LIVE. */
(() => {
  'use strict';

  const isAiLive = node => {
    const id = String(node?.id || '').toLowerCase();
    const title = String(node?.title || '').toLowerCase();
    const url = String(node?.url || '').toLowerCase();
    const github = String(node?.github || '').toLowerCase();
    return id === 'ai-live' ||
      title.includes('cr3@tix ai live') ||
      title.includes('creatix ai live') ||
      url.includes('creatix-ai-live') ||
      github.includes('creatix-ai-live');
  };

  const purgeAiLive = () => {
    try {
      if (!Array.isArray(nodes)) return false;
      const filtered = nodes.filter(node => !isAiLive(node));
      if (filtered.length === nodes.length) return false;
      nodes = filtered;
      try {
        if (typeof STORAGE_KEY !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
        }
      } catch {}
      return true;
    } catch {
      return false;
    }
  };

  if (typeof render === 'function') {
    const originalRender = render;
    render = function cr3atixRenderWithoutAiLive(...args) {
      purgeAiLive();
      return originalRender.apply(this, args);
    };
  }

  if (purgeAiLive() && typeof render === 'function') render();

  // Sécurité supplémentaire pour les chargements distants asynchrones.
  window.addEventListener('load', () => {
    if (purgeAiLive() && typeof render === 'function') render();
  }, { once: true });
})();
