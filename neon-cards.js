/* CR3@TIX MAP — animated blue/violet neon frame on every map vignette */
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
      @property --cr3-neon-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }
      @keyframes cr3-neon-orbit {
        to { --cr3-neon-angle: 360deg; }
      }
      @keyframes cr3-neon-breathe {
        0%,100% { opacity:.78; filter:blur(7px); }
        50% { opacity:1; filter:blur(10px); }
      }

      .cr3-neon-target{
        position:relative !important;
        isolation:isolate;
        outline:none !important;
        overflow:visible !important;
        box-shadow:0 16px 34px rgba(0,0,0,.38) !important;
      }
      .cr3-neon-target::before,
      .cr3-neon-target::after{
        content:'';
        position:absolute;
        pointer-events:none;
        inset:-4px;
        border-radius:inherit;
        padding:3px;
        background:conic-gradient(
          from var(--cr3-neon-angle),
          #3bbcff 0deg,
          #655cff 55deg,
          #a64dff 120deg,
          #5b36ff 180deg,
          #2fc8ff 235deg,
          #7a5cff 300deg,
          #3bbcff 360deg
        );
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;
        mask-composite:exclude;
        animation:cr3-neon-orbit 3.4s linear infinite;
        z-index:2;
      }
      .cr3-neon-target::after{
        inset:-7px;
        padding:6px;
        opacity:.85;
        filter:blur(8px);
        z-index:1;
        animation:cr3-neon-orbit 3.4s linear infinite,cr3-neon-breathe 2.2s ease-in-out infinite;
      }
      .cr3-neon-target:hover::before,
      .cr3-neon-target:focus-within::before{
        animation-duration:2.1s;
      }
      .cr3-neon-target:hover::after,
      .cr3-neon-target:focus-within::after{
        animation-duration:2.1s,1.4s;
      }
      @media (prefers-reduced-motion: reduce){
        .cr3-neon-target::before,.cr3-neon-target::after{animation:none}
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
    world.querySelectorAll('[class*="card" i],[class*="node" i],[class*="project" i],[class*="branch" i],[class*="tile" i],[class*="panel" i],[data-id],[data-node],[data-key],[data-project]').forEach(el=>{
      const p=climbToPanel(el,world);
      if(p) targets.add(p);
    });
    world.querySelectorAll('button,a,[role="button"],[tabindex]').forEach(el=>{
      const p=climbToPanel(el,world);
      if(p) targets.add(p);
    });
    world.querySelectorAll('*').forEach(el=>{
      if(isReasonablePanel(el,world)){
        const p=climbToPanel(el,world);
        if(p) targets.add(p);
      }
    });

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
