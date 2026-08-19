/* CR3@TIX MAP — neon blue/violet card visibility */
(() => {
  'use strict';
  function applyNeonCards() {
    if (document.getElementById('cr3-neon-cards-style')) return;
    const style = document.createElement('style');
    style.id = 'cr3-neon-cards-style';
    style.textContent = `
      .node, .card, .project-card, #cr3-business-card {
        border: 1px solid rgba(120,140,255,.58) !important;
        box-shadow:
          0 0 0 1px rgba(142,93,255,.20),
          0 0 12px rgba(76,139,255,.18),
          0 0 24px rgba(146,70,255,.12),
          0 16px 34px rgba(0,0,0,.34) !important;
        transition: box-shadow .2s ease, border-color .2s ease, transform .2s ease;
      }
      .node:hover, .card:hover, .project-card:hover, #cr3-business-card:hover {
        border-color: rgba(164,121,255,.92) !important;
        box-shadow:
          0 0 0 1px rgba(86,174,255,.34),
          0 0 16px rgba(73,151,255,.34),
          0 0 30px rgba(152,73,255,.26),
          0 18px 40px rgba(0,0,0,.42) !important;
      }
    `;
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyNeonCards);
  else applyNeonCards();
})();
