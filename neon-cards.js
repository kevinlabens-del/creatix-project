/* CR3@TIX MAP — neon blue/violet frame on every map vignette */
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
      .cr3-neon-target{
        outline:3px solid rgba(82,176,255,.96) !important;
        outline-offset:-1px !important;
        box-shadow:
          0 0 0 2px rgba(167,88,255,.62),
          0 0 14px rgba(61,148,255,.58),
          0 0 30px rgba(146,65,255,.42),
          0 16px 34px rgba(0,0,0,.38) !important;
        transition:box-shadow .2s ease,outline-color .2s ease,transform .2s ease !important;
      }
      .cr3-neon-target:hover,.cr3-neon-target:focus-within{
        outline-color:rgba(188,112,255,1) !important;
        box-shadow:
          0 0 0 2px rgba(82,196,255,.8),
          0 0 19px rgba(64,160,255,.72),
          0 0 40px rgba(164,72,255,.56),
          0 18px 42px rgba(0,0,0,.44) !important;
      }
    `;
  }

  function dims(el){
    const cs=getComputedStyle(el);
    return {w:el.offsetWidth||parseFloat(cs.width)||0,h:el.offsetHeight||parseFloat(cs.height)||0,cs};
  }

  function isReasonablePanel(el,world){
    if(!(el instanceof HTMLElement)||el===world) return false;
    if(['SCRIPT','STYLE','SVG','PATH','CANVAS','IMG'].includes(el.tagName)) return false;
    const {w,h,cs}=dims(el);
    if(w<120||w>560||h<90||h>700) return false;
    const txt=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(txt.length<2) return false;
    const radius=parseFloat(cs.borderRadius||'0');
    const bg=cs.backgroundColor;
    const hasBg=bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)';
    const positioned=['absolute','relative'].includes(cs.position);
    const interactive=el.matches('a,button,[role="button"],[tabindex]')||cs.cursor==='pointer'||!!el.querySelector('button,a,[role="button"]');
    const namedClass=/card|node|project|branch|tile|panel|vignette|item/i.test(el.className||'');
    const namedAttr=el.hasAttribute('data-id')||el.hasAttribute('data-node')||el.hasAttribute('data-key')||el.hasAttribute('data-project');
    return (hasBg||radius>=6) && (positioned||interactive||namedClass||namedAttr);
  }

  function climbToPanel(start,world){
    let el=start;
    let best=null;
    while(el&&el!==world&&el instanceof HTMLElement){
      if(isReasonablePanel(el,world)) best=el;
      el=el.parentElement;
    }
    return best;
  }

  function apply(){
    installStyles();
    const world=document.getElementById('world')||document.querySelector('.world');
    if(!world) return;

    const targets=new Set();

    // 1) Explicit semantic/card-like nodes.
    world.querySelectorAll('[class*="card" i],[class*="node" i],[class*="project" i],[class*="branch" i],[class*="tile" i],[class*="panel" i],[data-id],[data-node],[data-key],[data-project]').forEach(el=>{
      const p=climbToPanel(el,world);
      if(p) targets.add(p);
    });

    // 2) Start from every interactive element (OUVRIR buttons, clickable category cards, etc.)
    // and climb to the outer visual panel containing it.
    world.querySelectorAll('button,a,[role="button"],[tabindex]').forEach(el=>{
      const p=climbToPanel(el,world);
      if(p) targets.add(p);
    });

    // 3) Final visual pass: catch category/root panels even when they are not interactive.
    world.querySelectorAll('*').forEach(el=>{
      if(isReasonablePanel(el,world)){
        const p=climbToPanel(el,world);
        if(p) targets.add(p);
      }
    });

    // Remove nested false positives: keep the visually outer panel for each card.
    const arr=[...targets];
    arr.forEach(el=>{
      const outer=arr.find(other=>other!==el&&other.contains(el)&&isReasonablePanel(other,world));
      if(!outer) el.classList.add('cr3-neon-target');
    });

    const business=document.getElementById('cr3-business-card');
    if(business) business.classList.add('cr3-neon-target');
  }

  const start=()=>{
    apply();
    const world=document.getElementById('world')||document.querySelector('.world');
    if(world){
      let queued=false;
      new MutationObserver(()=>{
        if(queued) return;
        queued=true;
        requestAnimationFrame(()=>{queued=false;apply();});
      }).observe(world,{childList:true,subtree:true});
    }
    [150,400,800,1500,3000].forEach(ms=>setTimeout(apply,ms));
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
