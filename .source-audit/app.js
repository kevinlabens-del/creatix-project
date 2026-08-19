const STORAGE_KEY='cr3atix-project-map-v1.1';
const WORLD={width:2200,height:1400};
const DEFAULT_NODES=[
{id:'root',parent:null,title:'CR3@TIX',type:'ÉCOSYSTÈME',desc:'Concepteur de projet digital',x:1510,y:460,icon:'assets/project-icons/creatix.svg'},
{id:'games',parent:'root',title:'Jeux',type:'BRANCHE',desc:'Expériences et jeux interactifs',x:850,y:130,icon:'assets/project-icons/games.svg'},
{id:'apps',parent:'root',title:'Applications',type:'BRANCHE',desc:'Outils web et applications',x:850,y:470,icon:'assets/project-icons/apps.svg'},
{id:'design',parent:'root',title:'Design',type:'BRANCHE',desc:'Identité visuelle et créations',x:850,y:810,icon:'assets/project-icons/design.svg'},
{id:'snake',parent:'games',title:'Snake 2.0',type:'JEU',desc:'Arcade évolutif et missions',x:300,y:20,url:'https://kevinlabens-del.github.io/snake-2.0/',icon:'https://kevinlabens-del.github.io/snake-2.0/icons/icon-512.png',status:'online',progress:85},
{id:'runner',parent:'games',title:'Cariste Runner',type:'JEU',desc:'Runner arcade logistique',x:300,y:270,url:'https://kevinlabens-del.github.io/cariste-runner/',icon:'https://raw.githubusercontent.com/kevinlabens-del/cariste-runner/main/icons/icon-512.png',status:'online',progress:100},
{id:'breizh',parent:'apps',title:'Breizh’ Balade',type:'APPLICATION',desc:'Découvrir la Bretagne autrement',x:300,y:520,url:'https://kevinlabens-del.github.io/breizh-balade/',icon:'https://raw.githubusercontent.com/kevinlabens-del/breizh-balade/main/assets/icons/icon-512.png',status:'online',progress:95},
{id:'website',parent:'design',title:'GPT-CREATIX',type:'SITE WEB',desc:'Site officiel CR3@TIX • galerie et créations',x:300,y:770,url:'https://www.gptcreatix.fr/',icon:'https://primary.jwwb.nl/public/g/z/z/temp-ccvhmyecizquiiougjtw/image-high-fjprsd.png?enable=upscale&enable-io=true&height=70',status:'online',progress:100},
{id:'boutik',parent:'design',title:'CR3@TIX BOUTIK',type:'DESIGN',desc:'Créations et collections visuelles',x:300,y:1020,url:'https://www.redbubble.com/fr/shop/ap/182865911?ref=studio-promote',icon:'assets/project-icons/boutik.svg',status:'online',progress:100}
];
const STATUS={online:{label:'En ligne',cls:'status-online'},development:{label:'En développement',cls:'status-development'},test:{label:'Test',cls:'status-test'},offline:{label:'Hors ligne',cls:'status-offline'},archived:{label:'Archivé',cls:'status-archived'}};

const $=id=>document.getElementById(id);
const viewport=$('viewport'),world=$('world'),nodesLayer=$('nodes'),links=$('links'),plusLayer=$('plusLayer'),dialog=$('nodeDialog');
const fitBtn=$('fitBtn'),searchBtn=$('searchBtn'),installBtn=$('installBtn'),zoomIn=$('zoomIn'),zoomOut=$('zoomOut');
const nodeForm=$('nodeForm'),dialogTitle=$('dialogTitle'),deleteBtn=$('deleteBtn');
const editId=$('editId'),editParent=$('editParent'),editTitle=$('editTitle'),editType=$('editType'),editDesc=$('editDesc'),editStatus=$('editStatus'),editProgress=$('editProgress'),editUrl=$('editUrl'),editIcon=$('editIcon');
const searchBox=$('searchBox'),searchInput=$('searchInput'),closeSearch=$('closeSearch'),toastEl=$('toast');

const REQUIRED=[viewport,world,nodesLayer,links,plusLayer,dialog,fitBtn,searchBtn,installBtn,zoomIn,zoomOut,nodeForm,dialogTitle,deleteBtn,editId,editParent,editTitle,editType,editDesc,editStatus,editProgress,editUrl,editIcon,searchBox,searchInput,closeSearch,toastEl];
if(REQUIRED.some(el=>!el)) throw new Error('[CR3@TIX MAP] Élément DOM requis manquant.');

const clone=v=>JSON.parse(JSON.stringify(v));
let nodes=loadNodes(),view={x:0,y:0,scale:.72},deferredPrompt=null;
function loadNodes(){let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}if(!Array.isArray(saved)||!saved.length)return JSON.parse(JSON.stringify(DEFAULT_NODES));const defs=new Map(DEFAULT_NODES.map(n=>[n.id,n]));const out=saved.filter(n=>n.id!=='factory').map(n=>{const d=defs.get(n.id);return d?{...d,...n}:{...n,status:n.status||'development',progress:Number.isFinite(Number(n.progress))?Math.max(0,Math.min(100,Number(n.progress))):0}});for(const d of DEFAULT_NODES)if(!out.some(n=>n.id===d.id))out.push(clone(d));return out}
const saveNodes=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(nodes));
const childrenOf=id=>nodes.filter(n=>n.parent===id),nodeById=id=>nodes.find(n=>n.id===id),safeProgress=n=>Math.max(0,Math.min(100,Number(n.progress)||0)),statusFor=n=>STATUS[n.status]||STATUS.development;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function toast(msg){toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toastEl._timer);toastEl._timer=setTimeout(()=>toastEl.hidden=true,1800)}

function render(){
  nodesLayer.innerHTML='';plusLayer.innerHTML='';links.innerHTML='';
  links.setAttribute('viewBox',`0 0 ${WORLD.width} ${WORLD.height}`);links.setAttribute('width',WORLD.width);links.setAttribute('height',WORLD.height);
  for(const n of nodes){
    const branch=childrenOf(n.id).length>0||(!n.url&&['root','games','apps','design'].includes(n.id)),c=childrenOf(n.id).length,s=statusFor(n),p=safeProgress(n),card=document.createElement('article');
    card.className=`node-card ${branch?'branch':'project'}`;card.dataset.id=n.id;card.style.left=n.x+'px';card.style.top=n.y+'px';
    card.innerHTML=`<div class="card-visual ${branch?'branch-visual':''}"><span class="brand-badge">CR3@TIX</span><img src="${esc(n.icon||'assets/project-icons/project.svg')}" alt="Icône ${esc(n.title)}" loading="lazy" onerror="this.style.display='none'">${n.url?'<span class="open-chip">OUVRIR ↗</span>':''}</div><div class="card-body"><div class="eyebrow">${esc(n.type||'PROJET')}</div><div class="card-title">${esc(n.title)}</div><div class="card-desc">${esc(n.desc||'')}</div><div class="project-meta"><span class="status-badge ${s.cls}">${esc(s.label)}</span><span class="progress-value">${p}%</span></div><div class="progress-track" aria-label="Progression ${p}%"><div class="progress-fill" style="width:${p}%"></div></div><div class="card-footer"><span>${branch?`${c} branche${c>1?'s':''}`:'Projet CR3@TIX'}</span><button type="button" class="more" aria-label="Modifier">•••</button></div></div>`;
    card.querySelector('.more').addEventListener('click',e=>{e.stopPropagation();openEditor(n)});
    if(n.url)card.addEventListener('click',()=>openProject(n));
    nodesLayer.appendChild(card);if(n.id!=='root')addPlus(n.x+240,n.y+108,n.id);
  }
  const root=nodeById('root');if(root)addPlus(root.x+240,root.y+108,'root');
  drawLinks();applyView();
}
function addPlus(x,y,parent){const b=document.createElement('button');b.type='button';b.className='plus-node';b.textContent='+';b.title='Ajouter un sous-projet';b.style.left=x+'px';b.style.top=y+'px';b.addEventListener('click',e=>{e.stopPropagation();openNew(parent)});plusLayer.appendChild(b)}
function drawLinks(){links.innerHTML='';for(const n of nodes){if(!n.parent)continue;const p=nodeById(n.parent);if(!p)continue;const x1=p.x,y1=p.y+116,x2=n.x+230,y2=n.y+116,mid=(x1+x2)/2,path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x1} ${y1} C ${mid} ${y1},${mid} ${y2},${x2} ${y2}`);links.appendChild(path);const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx',mid);dot.setAttribute('cy',(y1+y2)/2);dot.setAttribute('r','4');links.appendChild(dot)}}
function applyView(){world.style.transform=`translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`}
function openProject(n){if(!n.url)return;toast(`Ouverture de ${n.title}…`);window.open(n.url,'_blank','noopener,noreferrer')}
function fit(){if(!nodes.length)return;const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),minX=Math.min(...xs)-80,maxX=Math.max(...xs)+330,minY=Math.min(...ys)-60,maxY=Math.max(...ys)+330,r=viewport.getBoundingClientRect(),w=maxX-minX,h=maxY-minY;view.scale=Math.max(.28,Math.min(1,Math.min(r.width/w,r.height/h)*.94));view.x=(r.width-w*view.scale)/2-minX*view.scale;view.y=(r.height-h*view.scale)/2-minY*view.scale;applyView()}
function zoomAt(factor,cx,cy){const r=viewport.getBoundingClientRect(),wx=(cx-r.left-view.x)/view.scale,wy=(cy-r.top-view.y)/view.scale;view.scale=Math.max(.28,Math.min(1.8,view.scale*factor));view.x=(cx-r.left)-wx*view.scale;view.y=(cy-r.top)-wy*view.scale;applyView()}
viewport.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.1:.9,e.clientX,e.clientY)},{passive:false});

// v1.16.1 INPUT FIRST: un seul moteur pan/pinch, géométrie mise en cache, aucun changement CSS au contact.
const pts=new Map();let gesture=null,moved=false,suppressClick=false;
const points=()=>[...pts.values()];
const center=()=>{const a=points(),n=a.length||1;return{x:a.reduce((s,p)=>s+p.x,0)/n,y:a.reduce((s,p)=>s+p.y,0)/n}};
const distance=()=>{const a=points();return a.length<2?1:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1};
function startGesture(){if(!pts.size){gesture=null;return}const rect=viewport.getBoundingClientRect(),c=center();gesture={rect,cx:c.x,cy:c.y,vx:view.x,vy:view.y,scale:view.scale,dist:distance(),worldX:((c.x-rect.left)-view.x)/view.scale,worldY:((c.y-rect.top)-view.y)/view.scale};window.dispatchEvent(new Event('cr3atix-input-start'))}
function onDown(e){if(e.pointerType==='mouse'&&e.button!==0)return;if(e.target.closest('button,input,textarea,select,dialog,.search-box'))return;viewport.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;startGesture()}
function onMove(e){if(!pts.has(e.pointerId)||!gesture)return;e.preventDefault();const cs=e.getCoalescedEvents?.(),p=cs&&cs.length?cs[cs.length-1]:e;pts.set(e.pointerId,{x:p.clientX,y:p.clientY});const c=center();if(Math.hypot(c.x-gesture.cx,c.y-gesture.cy)>2)moved=true;if(pts.size===1){view.x=gesture.vx+c.x-gesture.cx;view.y=gesture.vy+c.y-gesture.cy}else{const ns=Math.max(.28,Math.min(1.8,gesture.scale*(distance()/Math.max(1,gesture.dist))));view.scale=ns;view.x=(c.x-gesture.rect.left)-gesture.worldX*ns;view.y=(c.y-gesture.rect.top)-gesture.worldY*ns}applyView()}
function onEnd(e){if(!pts.has(e.pointerId))return;if(moved)suppressClick=true;pts.delete(e.pointerId);if(pts.size)startGesture();else{gesture=null;window.dispatchEvent(new Event('cr3atix-input-end'));setTimeout(()=>{suppressClick=false},100)}}
viewport.addEventListener('pointerdown',onDown,{passive:false});
viewport.addEventListener('pointermove',onMove,{passive:false});
viewport.addEventListener('pointerup',onEnd,{passive:true});
viewport.addEventListener('pointercancel',onEnd,{passive:true});
viewport.addEventListener('lostpointercapture',onEnd,{passive:true});
viewport.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation()}},true);

fitBtn.addEventListener('click',fit);zoomIn.addEventListener('click',()=>zoomAt(1.16,innerWidth/2,innerHeight/2));zoomOut.addEventListener('click',()=>zoomAt(.86,innerWidth/2,innerHeight/2));
function openEditor(n){dialogTitle.textContent='Modifier le projet';editId.value=n.id;editParent.value=n.parent||'';editTitle.value=n.title||'';editType.value=n.type||'';editDesc.value=n.desc||'';editStatus.value=n.status||'development';editProgress.value=safeProgress(n);editUrl.value=n.url||'';editIcon.value=n.icon||'';deleteBtn.hidden=n.id==='root';dialog.showModal()}
function openNew(parent){dialogTitle.textContent='Nouveau sous-projet';editId.value='';editParent.value=parent;editTitle.value='Nouveau projet';editType.value='PROJET';editDesc.value='';editStatus.value='development';editProgress.value='10';editUrl.value='';editIcon.value='assets/project-icons/project.svg';deleteBtn.hidden=true;dialog.showModal()}
nodeForm.addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;const id=editId.value,parent=editParent.value,title=editTitle.value.trim(),obj={title,type:editType.value.trim(),desc:editDesc.value.trim(),status:editStatus.value,progress:Math.max(0,Math.min(100,Number(editProgress.value)||0)),url:editUrl.value.trim(),icon:editIcon.value.trim()};if(!title){e.preventDefault();return}if(id)Object.assign(nodeById(id),obj);else{const p=nodeById(parent),siblings=childrenOf(parent);nodes.push({id:'n'+Date.now(),parent,...obj,x:(p?.x||900)-520,y:(p?.y||400)+siblings.length*245})}saveNodes();setTimeout(render,0)});
deleteBtn.addEventListener('click',()=>{const id=editId.value;if(!id||id==='root')return;const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const n of nodes)if(n.parent&&ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true}}nodes=nodes.filter(n=>!ids.has(n.id));saveNodes();dialog.close();render();toast('Projet supprimé')});
searchBtn.addEventListener('click',()=>{searchBox.hidden=false;searchInput.focus()});closeSearch.addEventListener('click',()=>searchBox.hidden=true);searchInput.addEventListener('input',()=>{const q=searchInput.value.toLowerCase().trim();document.querySelectorAll('.node-card').forEach(el=>{const n=nodeById(el.dataset.id),s=statusFor(n).label,ok=!q||`${n.title} ${n.type} ${n.desc} ${s}`.toLowerCase().includes(q);el.style.opacity=ok?'1':'.18';el.style.filter=ok?'none':'grayscale(1)'})});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false});installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true});window.addEventListener('appinstalled',()=>toast('CR3@TIX Map installée'));
window.addEventListener('resize',()=>{if(innerWidth<700)fit()});
world.style.willChange='transform';world.style.backfaceVisibility='hidden';world.style.transformStyle='preserve-3d';
render();setTimeout(fit,80);
