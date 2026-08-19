/* CR3@TIX MAP — robust neon blue/violet card visibility */
(() => {
  'use strict';

  function installStyles() {
    if (document.getElementById('cr3-neon-cards-style')) return;
    const style = document.createElement('style');
    style.id = 'cr3-neon-cards-style';
    style.textContent = `
      .cr3-neon-target {
        border: 1px solid rgba(101,169,255,.88) !important;
        box-shadow:
          0 0 0 1px rgba(156,92,255,.32),
          0 0 10px rgba(66,150,255,.38),
          0 0 22px rgba(144,74,255,.24),
          0 16px 34px rgba(0,0,0,.34) !important;
        transition: box-shadow .2s ease,border-color .2s ease,transform .2s ease !important;
      }
      .cr3-neon-target:hover,
      .cr3-neon-target:focus-within {
        border-color: rgba(180,123,255,.98) !important;
        box-shadow:
          0 0 0 1px rgba(87,185,255,.5),
          0 0 16px rgba(74,159,255,.5),
          0 0 32px rgba(157,79,255,.38),
          0 18px 40px rgba(0,0,0,.42) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function looksLikeCard(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.id === 'cr3-business-card') return true;
    if (['SCRIPT','STYLE','IMG','SVG','PATH','CANVAS','BUTTON'].includes(el.tagName)) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const positioned = cs.position === 'absolute' || cs.position === 'relative';
    const hasPanelBg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const rounded = parseFloat(cs.borderRadius || '0') >= 6;
    const sensibleSize = r.width >= 90 && r.width <= 380 && r.height >= 90 && r.height <= 460;
    const text = (el.textContent || '').trim();
    return positioned && hasPanelBg && rounded && sensibleSize && text.length >= 2;
  }

  function apply() {
    installStyles();
    const world = document.getElementById('world') || document.querySelector('.world');
    if (!world) return;
    world.querySelectorAll('*').forEach(el => {
      if (looksLikeCard(el)) el.classList.add('cr3-neon-target');
    });
    const business = document.getElementById('cr3-business-card');
    if (business) business.classList.add('cr3-neon-target');
  }

  const start = () => {
    apply();
    const world = document.getElementById('world') || document.querySelector('.world');
    if (world) new MutationObserver(() => requestAnimationFrame(apply)).observe(world,{childList:true,subtree:true});
    setTimeout(apply,500);
    setTimeout(apply,1500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
