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
      #cr3-card-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.94);backdrop-filter:blur(7px);box-sizing:border-box}
      #cr3-card-modal.open{display:flex}
      #cr3-card-modal img{display:block;width:auto;height:auto;max-width:calc(100vw - 36px);max-height:calc(100dvh - 90px);object-fit:contain;border-radius:12px;box-shadow:0 20px 80px #000;background:transparent}
      #cr3-card-close{position:fixed;right:18px;top:max(18px,env(safe-area-inset-top));z-index:100001;width:54px;height:54px;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:rgba(10,20,16,.9);color:white;font:34px/48px system-ui;text-align:center;cursor:pointer}
      @media (orientation:portrait){#cr3-card-modal img{width:calc(100vw - 36px);height:auto;max-height:75dvh}}
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
    card.innerHTML = `<img src="${CARD_IMAGE}?v=1.16.13" alt="Carte de visite CR3@TIX"><div class="label">Carte de visite</div><div class="hint">Toucher pour agrandir</div>`;
    mapWorld.appendChild(card);

    const modal = document.createElement('div');
    modal.id = 'cr3-card-modal';
    modal.innerHTML = `<img src="${CARD_IMAGE}?v=1.16.13" alt="Carte de visite CR3@TIX agrandie"><button id="cr3-card-close" aria-label="Fermer">×</button>`;
    document.body.appendChild(modal);

    const open = () => { modal.classList.add('open'); document.documentElement.style.overflow='hidden'; };
    const close = () => { modal.classList.remove('open'); document.documentElement.style.overflow=''; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
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
