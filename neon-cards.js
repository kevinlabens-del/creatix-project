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
        border: 2px solid rgba(92,174,255,.92) !important;
        box-shadow:
          0 0 0 1px rgba(163,91,255,.58),
          0 0 11px rgba(58,145,255,.48),
          0 0 24px rgba(143,66,255,.34),
          0 16px 34px rgba(0,0,0,.38) !important;
        transition: box-shadow .2s ease,border-color .2s ease,transform .2s ease !important;
      }
      .cr3-neon-target:hover,
      .cr3-neon-target:focus-within {
        border-color: rgba(181,116,255,1) !important;
        box-shadow:
          0 0 0 1px rgba(82,190,255,.72),
          0 0 17px rgba(65,158,255,.62),
          0 0 34px rgba(160,73,255,.48),
          0 18px 42px rgba(0,0,0,.44) !important;
      }
    `;
  }

  function looksLikeMapCard(el, world) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.id === 'cr3-business-card') return true;
    if (el === world) return false;
    if (['SCRIPT','STYLE','IMG','SVG','PATH','CANVAS','BUTTON','INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return false;

    const cs = getComputedStyle(el);
    const width = el.offsetWidth || parseFloat(cs.width) || 0;
    const height = el.offsetHeight || parseFloat(cs.height) || 0;
    const text = (el.textContent || '').replace(/\s+/g,' ').trim();

    const positioned = cs.position === 'absolute' || cs.position === 'relative';
    const rounded = parseFloat(cs.borderRadius || '0') >= 8;
    const hasVisiblePanel = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const cardSized = width >= 130 && width <= 430 && height >= 120 && height <= 520;
    const hasUsefulText = text.length >= 3;

    return positioned && rounded && hasVisiblePanel && cardSized && hasUsefulText;
  }

  function apply() {
    installStyles();
    const world = document.getElementById('world') || document.querySelector('.world');
    if (!world) return;

    // offsetWidth/offsetHeight are used deliberately: unlike getBoundingClientRect,
    // they are not reduced by the current map zoom, so every card is detected.
    world.querySelectorAll('div,article,section,a').forEach(el => {
      if (looksLikeMapCard(el, world)) el.classList.add('cr3-neon-target');
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
