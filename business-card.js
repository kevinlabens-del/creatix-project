/* CR3@TIX MAP — business card branch */
(() => {
  'use strict';
  const CARD_IMAGE = './business-card-v2.jpg';

  function mountBusinessCard() {
    if (document.getElementById('cr3-business-card')) return;
    const mapWorld = document.getElementById('world') || window.world || document.querySelector('.world');
    if (!mapWorld) return setTimeout(mountBusinessCard, 300);

    const style = document.createElement('style');
    style.textContent = `
      #cr3-card-link{position:absolute;z-index:4;pointer-events:none;overflow:visible}
      #cr3-business-card{position:absolute;z-index:8;width:300px;padding:10px;border:1px solid rgba(127,255,185,.24);border-radius:18px;background:rgba(8,34,25,.94);box-shadow:0 18px 55px rgba(0,0,0,.38);cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;box-sizing:border-box}
      #cr3-business-card:hover{transform:translateY(-3px);box-shadow:0 20px 65px rgba(0,0,0,.5)}
      #cr3-business-card img{display:block;width:100%;height:auto;object-fit:contain;border-radius:11px;background:transparent}
      #cr3-business-card .label{padding:10px 5px 3px;color:#e8fff0;font:600 15px/1.2 system-ui,sans-serif;letter-spacing:.02em}
      #cr3-business-card .hint{padding:0 5px 5px;color:#9bb7a6;font:11px/1.3 system-ui,sans-serif}
      #cr3-card-modal{position:fixed;inset:0;z-index:99999;display:none;overflow:hidden;background:rgba(0,0,0,.94);backdrop-filter:blur(7px);touch-action:none;overscroll-behavior:none}
      #cr3-card-modal.open{display:block}
      #cr3-card-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none}
      #cr3-card-modal img{display:block;width:auto;height:auto;max-width:calc(100vw - 36px);max-height:calc(100dvh - 100px);object-fit:contain;border-radius:12px;box-shadow:0 20px 80px #000;background:transparent;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-drag:none;touch-action:none}
      #cr3-card-close{position:fixed;right:18px;top:max(18px,env(safe-area-inset-top));z-index:100002;width:54px;height:54px;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:rgba(10,20,16,.9);color:white;font:34px/48px system-ui;text-align:center;cursor:pointer}
      #cr3-card-zoom-hint{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100002;padding:8px 12px;border-radius:999px;background:rgba(10,20,16,.82);border:1px solid rgba(255,255,255,.12);color:#dfffea;font:12px/1.2 system-ui,sans-serif;white-space:nowrap;pointer-events:none}
      @media (orientation:portrait){#cr3-card-modal img{max-width:calc(100vw - 28px);max-height:75dvh}}
    `;
    document.head.appendChild(style);

    const link = document.createElementNS('http://www.w3.org/2000/svg','svg');
    link.id = 'cr3-card-link';
    link.innerHTML = '<path fill="none" stroke="rgba(124,207,255,.38)" stroke-width="2"/><circle r="4" fill="#9eeaff"/>';
    mapWorld.appendChild(link);

    const card = document.createElement('div');
    card.id = 'cr3-business-card';
    card.setAttribute('role','button'); card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','Agrandir la carte de visite CR3@TIX');
    card.innerHTML = `<img src="${CARD_IMAGE}?v=1.16.14" alt="Carte de visite CR3@TIX"><div class="label">Carte de visite</div><div class="hint">Toucher pour agrandir</div>`;
    mapWorld.appendChild(card);

    const modal = document.createElement('div');
    modal.id = 'cr3-card-modal';
    modal.innerHTML = `<div id="cr3-card-stage"><img id="cr3-card-full" src="${CARD_IMAGE}?v=1.16.14" alt="Carte de visite CR3@TIX agrandie"></div><button id="cr3-card-close" aria-label="Fermer">×</button><div id="cr3-card-zoom-hint">Pincer pour zoomer • Glisser pour déplacer</div>`;
    document.body.appendChild(modal);

    const stage = modal.querySelector('#cr3-card-stage');
    const full = modal.querySelector('#cr3-card-full');
    let scale = 1, tx = 0, ty = 0;
    let startScale = 1, startDistance = 0;
    let startTx = 0, startTy = 0;
    let dragStartX = 0, dragStartY = 0;
    let touches = [];

    const clampScale = value => Math.min(5, Math.max(1, value));
    function applyTransform() {
      if (scale === 1) { tx = 0; ty = 0; }
      full.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    function resetZoom() { scale = 1; tx = 0; ty = 0; applyTransform(); }
    const distance = (a,b) => Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    const midpoint = (a,b) => ({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});

    stage.addEventListener('touchstart', e => {
      if (!modal.classList.contains('open')) return;
      touches = Array.from(e.touches);
      if (e.touches.length === 2) {
        startDistance = distance(e.touches[0], e.touches[1]);
        startScale = scale;
        startTx = tx; startTy = ty;
      } else if (e.touches.length === 1 && scale > 1) {
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startTx = tx; startTy = ty;
      }
      e.preventDefault();
    }, {passive:false});

    stage.addEventListener('touchmove', e => {
      if (!modal.classList.contains('open')) return;
      if (e.touches.length === 2 && startDistance > 0) {
        const nextScale = clampScale(startScale * (distance(e.touches[0], e.touches[1]) / startDistance));
        const m = midpoint(e.touches[0], e.touches[1]);
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const ratio = nextScale / scale;
        tx = (tx - (m.x - cx)) * ratio + (m.x - cx);
        ty = (ty - (m.y - cy)) * ratio + (m.y - cy);
        scale = nextScale;
        applyTransform();
      } else if (e.touches.length === 1 && scale > 1) {
        tx = startTx + (e.touches[0].clientX - dragStartX);
        ty = startTy + (e.touches[0].clientY - dragStartY);
        applyTransform();
      }
      e.preventDefault();
    }, {passive:false});

    stage.addEventListener('touchend', e => {
      if (e.touches.length < 2) startDistance = 0;
      if (scale < 1.03) resetZoom();
      e.preventDefault();
    }, {passive:false});

    stage.addEventListener('dblclick', e => {
      if (scale > 1) resetZoom();
      else { scale = 2.5; tx = 0; ty = 0; applyTransform(); }
      e.preventDefault();
    });

    stage.addEventListener('wheel', e => {
      if (!modal.classList.contains('open')) return;
      const next = clampScale(scale * (e.deltaY < 0 ? 1.15 : 0.87));
      scale = next; applyTransform(); e.preventDefault();
    }, {passive:false});

    const open = () => { resetZoom(); modal.classList.add('open'); document.documentElement.style.overflow='hidden'; document.body.style.overflow='hidden'; };
    const close = () => { modal.classList.remove('open'); resetZoom(); document.documentElement.style.overflow=''; document.body.style.overflow=''; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    modal.querySelector('#cr3-card-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    function position() {
      let root = null;
      try { root = typeof nodeById === 'function' ? nodeById('root') : null; } catch (_) {}
      if (!root) return;
      const rootWidth=250, rootHeight=300, cardWidth=300;
      const cardX=root.x+(rootWidth-cardWidth)/2, cardY=root.y+rootHeight+180;
      card.style.left=`${cardX}px`; card.style.top=`${cardY}px`;
      const x1=root.x+rootWidth/2, y1=root.y+rootHeight, x2=cardX+cardWidth/2, y2=cardY, pad=20;
      const minX=Math.min(x1,x2)-pad,minY=Math.min(y1,y2)-pad;
      const w=Math.max(40,Math.abs(x2-x1)+pad*2),h=Math.max(40,Math.abs(y2-y1)+pad*2);
      link.style.left=`${minX}px`;link.style.top=`${minY}px`;link.style.width=`${w}px`;link.style.height=`${h}px`;
      link.setAttribute('viewBox',`0 0 ${w} ${h}`);
      const sx=x1-minX,sy=y1-minY,ex=x2-minX,ey=y2-minY,mid=(sy+ey)/2;
      link.querySelector('path').setAttribute('d',`M ${sx} ${sy} C ${sx} ${mid}, ${ex} ${mid}, ${ex} ${ey}`);
      const dot=link.querySelector('circle');dot.setAttribute('cx',ex);dot.setAttribute('cy',(sy+ey)/2);
      if(typeof WORLD==='object'&&WORLD&&WORLD.height<cardY+300){WORLD.height=cardY+360;mapWorld.style.height=`${WORLD.height}px`;}
    }
    position(); setInterval(position,800); window.addEventListener('resize',position,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountBusinessCard);else mountBusinessCard();
})();
