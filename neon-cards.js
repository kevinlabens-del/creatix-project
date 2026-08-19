/* CR3@TIX MAP — neon blue/violet visibility for every map card */
(() => {
  'use strict';

  function installStyles() {
    let style = document.getElementById('cr3-neon-cards-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'cr3-neon-cards-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      .cr3-neon-target {
        border: 3px solid rgba(88,176,255,.96) !important;
        box-shadow:
          0 0 0 1px rgba(170,88,255,.72),
          0 0 12px rgba(52,146,255,.58),
          0 0 28px rgba(146,64,255,.42),
          0 16px 34px rgba(0,0,0,.38) !important;
        transition: box-shadow .2s ease,border-color .2s ease,transform .2s ease !important;
      }
      .cr3-neon-target:hover,
      .cr3-neon-target:focus-within {
        border-color: rgba(188,112,255,1) !important;
        box-shadow:
          0 0 0 1px rgba(82,196,255,.85),
          0 0 18px rgba(64,160,255,.72),
          0 0 38px rgba(164,72,255,.58),
          0 18px 42px rgba(0,0,0,.44) !important;
      }
    `;
  }

  function panelLike(el, world) {
    if (!(el instanceof HTMLElement) || el === world) return false;
    if (el.id === 'cr3-business-card') return true;
    if (['SCRIPT','STYLE','SVG','PATH','CANVAS','IMG'].includes(el.tagName)) return false;

    const cs = getComputedStyle(el);
    const w = el.offsetWidth || parseFloat(cs.width) || 0;
    const h = el.offsetHeight || parseFloat(cs.height) || 0;
    const radius = parseFloat(cs.borderRadius || '0');
    const bg = cs.backgroundColor;
    const text = (el.textContent || '').replace(/\s+/g,' ').trim();

    return w >= 150 && w <= 520 &&
           h >= 120 && h <= 650 &&
           radius >= 8 &&
           bg !== 'transparent' &&
           bg !== 'rgba(0, 0, 0, 0)' &&
           text.length >= 3;
  }

  function apply() {
    installStyles();
    const world = document.getElementById('world') || document.querySelector('.world');
    if (!world) return;

    const all = Array.from(world.querySelectorAll('*'));
    const candidates = all.filter(el => panelLike(el, world));

    // Keep only the outermost panel-like element. This prevents inner content blocks
    // from receiving their own neon frame while still catching the actual map cards.
    candidates.forEach(el => {
      const hasCandidateAncestor = candidates.some(other => other !== el && other.contains(el));
      if (!hasCandidateAncestor) el.classList.add('cr3-neon-target');
    });

    const business = document.getElementById('cr3-business-card');
    if (business) business.classList.add('cr3-neon-target');
  }

  const start = () => {
    apply();
    const world = document.getElementById('world') || document.querySelector('.world');
    if (world) {
      const observer = new MutationObserver(() => requestAnimationFrame(apply));
      observer.observe(world,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    }
    [250,700,1500,3000].forEach(ms => setTimeout(apply,ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
