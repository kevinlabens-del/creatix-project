/* CR3@TIX MAP — fullscreen landscape control */
(() => {
  'use strict';

  function addControl() {
    if (document.getElementById('cr3-fullscreen-landscape')) return;

    const style = document.createElement('style');
    style.textContent = `
      #cr3-fullscreen-landscape{
        position:fixed;
        top:max(8px,env(safe-area-inset-top));
        right:101px;
        z-index:100000;
        width:36px;
        height:36px;
        min-width:36px;
        min-height:36px;
        padding:0;
        margin:0;
        border:1px solid rgba(160,255,200,.22);
        border-radius:12px;
        background:rgba(8,34,25,.9);
        color:#ecfff4;
        display:flex;
        align-items:center;
        justify-content:center;
        font:700 18px/1 system-ui,sans-serif;
        box-shadow:none;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        backdrop-filter:blur(8px);
        box-sizing:border-box;
      }
      #cr3-fullscreen-landscape:active{transform:scale(.96)}
      #cr3-fullscreen-landscape.active{color:#b9ff4f;border-color:rgba(185,255,79,.5)}
      #cr3-fullscreen-toast{
        position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100001;
        max-width:calc(100vw - 36px);padding:10px 14px;border-radius:12px;background:rgba(5,20,15,.94);
        color:#eafff1;font:500 13px/1.35 system-ui,sans-serif;text-align:center;border:1px solid rgba(160,255,200,.18);
        opacity:0;pointer-events:none;transition:opacity .2s ease
      }
      #cr3-fullscreen-toast.show{opacity:1}
      @media (min-width:721px){
        #cr3-fullscreen-landscape{top:10px;right:146px;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:12px}
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'cr3-fullscreen-landscape';
    btn.type = 'button';
    btn.setAttribute('aria-label','Plein écran paysage');
    btn.setAttribute('title','Plein écran paysage');
    btn.textContent = '⛶';
    document.body.appendChild(btn);

    const toast = document.createElement('div');
    toast.id = 'cr3-fullscreen-toast';
    document.body.appendChild(toast);

    let toastTimer;
    const notify = msg => {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    };

    const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

    async function enterFullscreenLandscape() {
      try {
        const root = document.documentElement;
        if (!isFs()) {
          if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
          else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock('landscape'); }
          catch (_) { notify('Plein écran activé — tourne le téléphone en paysage si nécessaire.'); }
        } else {
          notify('Plein écran activé — tourne le téléphone en paysage.');
        }
      } catch (err) {
        notify('Le navigateur a refusé le plein écran. Réessaie depuis l’application installée.');
      }
      syncState();
    }

    async function exitFullscreenLandscape() {
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
        else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
      } catch (_) {}
      syncState();
    }

    function syncState() {
      const active = isFs();
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Plein écran paysage');
      btn.setAttribute('title', active ? 'Quitter le plein écran' : 'Plein écran paysage');
      btn.textContent = active ? '✕' : '⛶';
    }

    btn.addEventListener('click', () => isFs() ? exitFullscreenLandscape() : enterFullscreenLandscape());
    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    syncState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addControl);
  else addControl();
})();
