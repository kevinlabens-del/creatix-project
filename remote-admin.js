/* CR3@TIX MAP — authoritative Supabase admin layer
   Public reads come from Supabase. Official writes require the 4-digit admin
   code and are performed by the Supabase Edge Function. No PIN/hash is stored here. */
(() => {
  'use strict';

  const ENDPOINT = 'https://gwqojqwcbwoulxrctaqz.supabase.co/functions/v1/cr3atix-admin';
  let busy = false;
  let activePin = null;

  // Navigation système : le registre Supabase reste la source des projets.
  // La vignette est ajoutée si elle n'existe pas encore, puis sera incluse dans
  // la prochaine écriture MAP explicitement autorisée par le code administrateur.
  const SYSTEM_NODES = [{
    id: 'soutien',
    parent: 'apps',
    title: 'CR3@TIX SOUTIEN',
    type: 'APPLICATION',
    desc: 'Soutenir volontairement les projets CR3@TIX, sans contrepartie',
    x: 300,
    y: 770,
    url: 'https://kevinlabens-del.github.io/creatix-project/soutien/',
    icon: 'https://kevinlabens-del.github.io/creatix-project/soutien/assets/icon.svg',
    status: 'online',
    progress: 100
  }];

  const cloneState = value => JSON.parse(JSON.stringify(value));
  const ensureSystemNodes = value => {
    const next = cloneState(Array.isArray(value) ? value : []);
    const ids = new Set(next.map(node => node?.id));
    for (const node of SYSTEM_NODES) if (!ids.has(node.id)) next.push(cloneState(node));
    return next;
  };

  function ensureAdminStyles() {
    if (document.getElementById('cr3atix-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'cr3atix-admin-style';
    style.textContent = `
      .cr3-admin-backdrop{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(3,7,18,.72);backdrop-filter:blur(10px);padding:20px}
      .cr3-admin-card{width:min(92vw,390px);border:1px solid rgba(96,165,250,.35);border-radius:22px;padding:24px;background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98));box-shadow:0 24px 80px rgba(0,0,0,.55);color:#f8fafc;font-family:inherit}
      .cr3-admin-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;margin-bottom:10px}
      .cr3-admin-title{font-size:22px;font-weight:900;margin:0 0 8px}.cr3-admin-copy{margin:0 0 18px;color:#cbd5e1;font-size:14px;line-height:1.45}
      .cr3-admin-input{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid rgba(148,163,184,.35);background:#020617;color:#fff;font-size:26px;font-weight:900;letter-spacing:.5em;text-align:center;padding:14px 10px;outline:none}
      .cr3-admin-input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.16)}
      .cr3-admin-error{min-height:22px;margin:10px 0 0;color:#fca5a5;font-size:13px;font-weight:700}
      .cr3-admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.cr3-admin-btn{border:0;border-radius:13px;padding:12px 14px;font:inherit;font-weight:900;cursor:pointer}
      .cr3-admin-cancel{background:#1e293b;color:#e2e8f0}.cr3-admin-ok{background:#2563eb;color:white}.cr3-admin-btn:disabled{opacity:.55;cursor:wait}
    `;
    document.head.appendChild(style);
  }

  function pinDialog(action, submitPin) {
    ensureAdminStyles();
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'cr3-admin-backdrop';
      wrap.innerHTML = `
        <form class="cr3-admin-card" autocomplete="off">
          <div class="cr3-admin-badge">🔐 Administration CR3@TIX</div>
          <h2 class="cr3-admin-title">Code administrateur</h2>
          <p class="cr3-admin-copy">${action} nécessite ton code à 4 chiffres.</p>
          <input class="cr3-admin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="Code administrateur" autocomplete="off" />
          <div class="cr3-admin-error" aria-live="polite"></div>
          <div class="cr3-admin-actions"><button class="cr3-admin-btn cr3-admin-cancel" type="button">Annuler</button><button class="cr3-admin-btn cr3-admin-ok" type="submit">Valider</button></div>
        </form>`;
      document.body.appendChild(wrap);
      const form = wrap.querySelector('form');
      const input = wrap.querySelector('input');
      const error = wrap.querySelector('.cr3-admin-error');
      const ok = wrap.querySelector('.cr3-admin-ok');
      const cancel = wrap.querySelector('.cr3-admin-cancel');
      const close = value => { wrap.remove(); resolve(value); };
      cancel.addEventListener('click', () => close(false));
      wrap.addEventListener('click', e => { if (e.target === wrap) close(false); });
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); error.textContent = ''; });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (input.value.length !== 4) { error.textContent = 'Entre les 4 chiffres.'; input.focus(); return; }
        ok.disabled = true; cancel.disabled = true; error.textContent = 'Vérification…';
        try {
          const pin = input.value;
          const result = await submitPin(pin);
          if (result === true) return close(pin);
          error.textContent = result || 'Code incorrect. Réessaie.';
          input.value = ''; input.focus();
        } catch {
          error.textContent = 'Serveur indisponible. Réessaie.';
        } finally {
          ok.disabled = false; cancel.disabled = false;
        }
      });
      setTimeout(() => input.focus(), 30);
    });
  }

  async function callServer(payload) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    let body = {};
    try { body = await response.json(); } catch {}
    return { response, body };
  }

  async function verifyPin(pin) {
    const { response, body } = await callServer({ action: 'verify', pin });
    if (response.ok && body.ok === true) return true;
    return body.error === 'Code incorrect' ? 'Code incorrect. Réessaie.' : (body.error || 'Échec de la vérification.');
  }

  async function postState(pin, nextNodes) {
    const { response, body } = await callServer({ action: 'write', pin, nodes: nextNodes });
    if (!response.ok || body.ok !== true) return { ok: false, error: body.error || 'Échec de la vérification.' };
    return { ok: true, nodes: body.nodes };
  }

  async function requestAdminPin(action) {
    if (busy) return null;
    busy = true;
    try {
      return await pinDialog(action, verifyPin);
    } finally {
      busy = false;
    }
  }

  async function commitAuthorized(nextNodes, successMessage, fallbackAction) {
    let pin = activePin;
    if (!pin) pin = await requestAdminPin(fallbackAction);
    if (!pin) return false;

    const result = await postState(pin, ensureSystemNodes(nextNodes));
    if (!result.ok) {
      activePin = null;
      if (typeof toast === 'function') toast(result.error === 'Code incorrect' ? 'Code administrateur refusé' : result.error);
      return false;
    }

    nodes = ensureSystemNodes(result.nodes);
    activePin = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); } catch {}
    render();
    if (typeof toast === 'function') toast(successMessage);
    return true;
  }

  async function loadOfficialState() {
    try {
      const response = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || body.ok !== true || !Array.isArray(body.nodes) || !body.nodes.length) throw new Error('Invalid remote state');
      nodes = ensureSystemNodes(body.nodes);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); } catch {}
      render();
      setTimeout(() => { try { fit(); } catch {} }, 60);
    } catch (error) {
      console.warn('[CR3@TIX] Supabase unavailable; cached state kept read-only.', error);
      nodes = ensureSystemNodes(nodes);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)); } catch {}
      render();
      if (typeof toast === 'function') toast('Mode hors ligne — modifications désactivées');
    }
  }

  // Gate the editor itself: PIN is required before add/edit UI opens.
  const originalOpenEditor = openEditor;
  openEditor = async function protectedOpenEditor(n) {
    const pin = await requestAdminPin('Modifier ce projet');
    if (!pin) return;
    activePin = pin;
    originalOpenEditor(n);
  };

  const originalOpenNew = openNew;
  openNew = async function protectedOpenNew(parent) {
    const pin = await requestAdminPin('Ajouter un projet');
    if (!pin) return;
    activePin = pin;
    originalOpenNew(parent);
  };

  // If the editor is closed/cancelled, forget the PIN immediately.
  dialog.addEventListener('close', () => { activePin = null; });
  dialog.addEventListener('cancel', () => { activePin = null; });

  // Capture submit before the original localStorage-only handler.
  nodeForm.addEventListener('submit', async e => {
    if (e.submitter?.value === 'cancel') { activePin = null; return; }
    e.preventDefault();
    e.stopImmediatePropagation();

    const id = editId.value;
    const parent = editParent.value;
    const title = editTitle.value.trim();
    if (!title) return;
    const obj = {
      title,
      type: editType.value.trim(),
      desc: editDesc.value.trim(),
      status: editStatus.value,
      progress: Math.max(0, Math.min(100, Number(editProgress.value) || 0)),
      url: editUrl.value.trim(),
      icon: editIcon.value.trim()
    };
    const next = cloneState(nodes);
    if (id) {
      const target = next.find(n => n.id === id);
      if (!target) return;
      Object.assign(target, obj);
    } else {
      const p = next.find(n => n.id === parent);
      const siblings = next.filter(n => n.parent === parent);
      next.push({ id: 'n' + Date.now(), parent, ...obj, x: (p?.x || 900) - 520, y: (p?.y || 400) + siblings.length * 245 });
    }

    const ok = await commitAuthorized(next, id ? 'Projet modifié' : 'Projet ajouté', id ? 'Modifier ce projet' : 'Ajouter ce projet');
    if (ok) dialog.close();
  }, true);

  // Delete is also server-authorized. Normally it reuses the PIN that opened the editor.
  deleteBtn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const id = editId.value;
    if (!id || id === 'root') return;

    let pin = activePin;
    if (!pin) pin = await requestAdminPin('Supprimer ce projet');
    if (!pin) return;
    activePin = pin;

    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) if (n.parent && ids.has(n.parent) && !ids.has(n.id)) { ids.add(n.id); changed = true; }
    }
    const next = cloneState(nodes).filter(n => !ids.has(n.id));
    const ok = await commitAuthorized(next, 'Projet supprimé', 'Supprimer ce projet');
    if (ok) dialog.close();
  }, true);

  loadOfficialState();
})();
