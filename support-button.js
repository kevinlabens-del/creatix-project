(() => {
  'use strict';

  const SUPPORT_URL = 'https://kevinlabens-del.github.io/CR3-TIX-SOUTIEN-/';
  const HOST_ID = 'cr3atix-support-button-host';

  const path = `${location.hostname}${location.pathname}`.toLowerCase();
  if (
    document.getElementById(HOST_ID) ||
    path.includes('/cr3-tix-soutien-') ||
    path.includes('/creatix-project/soutien/')
  ) return;

  function mount() {
    if (!document.body || document.getElementById(HOST_ID)) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-cr3atix-support', '');
    document.body.appendChild(host);

    const root = host.attachShadow({ mode: 'open' });
    const link = document.createElement('a');
    link.href = SUPPORT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Soutenir les projets CR3@TIX');
    link.title = 'Soutenir les projets CR3@TIX';
    link.innerHTML = '<span class="heart" aria-hidden="true">❤</span><span class="label">Soutenir</span>';

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      a {
        position: fixed;
        left: max(14px, env(safe-area-inset-left));
        bottom: max(14px, env(safe-area-inset-bottom));
        z-index: 2147483646;
        box-sizing: border-box;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 9px 14px;
        border: 1px solid rgba(118, 220, 255, .72);
        border-radius: 999px;
        background: rgba(7, 11, 24, .90);
        color: #f6fbff;
        font: 700 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-decoration: none;
        letter-spacing: .01em;
        box-shadow: 0 0 0 1px rgba(142, 79, 255, .20), 0 7px 26px rgba(0, 0, 0, .38), 0 0 20px rgba(0, 205, 255, .16);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }
      a:hover, a:focus-visible {
        transform: translateY(-2px);
        border-color: rgba(183, 113, 255, .95);
        background: rgba(12, 17, 37, .96);
        box-shadow: 0 0 0 1px rgba(0, 225, 255, .25), 0 9px 30px rgba(0, 0, 0, .42), 0 0 24px rgba(153, 75, 255, .28);
        outline: none;
      }
      a:active { transform: translateY(0) scale(.97); }
      .heart {
        color: #ff4e78;
        font-size: 17px;
        line-height: 1;
        filter: drop-shadow(0 0 5px rgba(255, 78, 120, .42));
      }
      @media (max-width: 420px) {
        a { padding: 9px 12px; font-size: 13px; left: max(10px, env(safe-area-inset-left)); bottom: max(10px, env(safe-area-inset-bottom)); }
      }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
      @media print { a { display: none !important; } }
    `;

    root.append(style, link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
