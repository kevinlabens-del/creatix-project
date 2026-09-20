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

    const actions = document.querySelector('.top-actions');
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-cr3atix-support', '');
    host.dataset.mode = actions ? 'topbar' : 'fallback';

    if (actions) actions.insertBefore(host, actions.firstChild);
    else document.body.appendChild(host);

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
      :host {
        all: initial;
        display: block;
        flex: 0 0 auto;
      }
      a {
        box-sizing: border-box;
        height: 36px;
        min-width: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 0 11px;
        border: 1px solid rgba(255, 255, 255, .16);
        border-radius: 12px;
        background: rgba(12, 28, 22, .88);
        color: #f2fff5;
        font: 800 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-decoration: none;
        letter-spacing: .02em;
        box-shadow: 0 0 0 1px rgba(82, 176, 255, .08), 0 0 15px rgba(146, 65, 255, .10);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
      }
      a:hover, a:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(118, 220, 255, .72);
        background: rgba(14, 35, 27, .96);
        box-shadow: 0 0 0 1px rgba(167, 88, 255, .22), 0 0 18px rgba(61, 148, 255, .24);
        outline: none;
      }
      a:active { transform: translateY(0) scale(.97); }
      .heart {
        color: #ff4e78;
        font-size: 16px;
        line-height: 1;
        filter: drop-shadow(0 0 5px rgba(255, 78, 120, .38));
      }
      :host([data-mode="fallback"]) a {
        position: fixed;
        z-index: 80;
        top: max(66px, calc(env(safe-area-inset-top, 0px) + 66px));
        right: max(12px, env(safe-area-inset-right, 0px));
      }
      @media (max-width: 600px) {
        a {
          width: 36px;
          padding: 0;
          gap: 0;
        }
        .label { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
      @media print { :host { display: none !important; } }
    `;

    root.append(style, link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
