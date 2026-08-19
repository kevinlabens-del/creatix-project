/* CR3@TIX MAP — protection des actions d'administration
   Consultation libre. Ajout / modification / suppression protégés par PIN.
   Le PIN n'est jamais stocké en clair dans ce fichier. */
(() => {
  'use strict';

  const PIN_HASH = 'c1a874609dc4dabee741f9832227626396e3cf3af3d2d9d380f71d230df2bae3';
  const protectedWords = [
    'ajouter', 'ajout', 'nouveau', 'nouvelle',
    'modifier', 'modification', 'éditer', 'editer',
    'supprimer', 'suppression', 'effacer', 'retirer',
    'enregistrer', 'sauvegarder', 'valider les modifications',
    'add', 'edit', 'modify', 'delete', 'remove', 'save'
  ];

  let dialogOpen = false;
  const bypassOnce = new WeakSet();

  function normalize(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function elementLabel(el) {
    if (!el) return '';
    return normalize([
      el.textContent,
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('title'),
      el.getAttribute?.('name'),
      el.getAttribute?.('id'),
      el.getAttribute?.('class'),
      el.dataset?.action,
      el.dataset?.mode,
      el.dataset?.type
    ].filter(Boolean).join(' '));
  }

  function isProtectedControl(el) {
    const control = el?.closest?.('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!control) return null;

    const label = elementLabel(control);
    if (!label) return null;

    const isProtected = protectedWords.some(word => label.includes(normalize(word)));
    return isProtected ? control : null;
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function injectStyles() {
    if (document.getElementById('cr3-admin-security-style')) return;
    const style = document.createElement('style');
    style.id = 'cr3-admin-security-style';
    style.textContent = `
      .cr3-pin-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px}
      .cr3-pin-box{width:min(92vw,360px);border:1px solid rgba(121,95,255,.5);border-radius:22px;background:linear-gradient(145deg,rgba(12,14,24,.98),rgba(25,18,42,.98));box-shadow:0 24px 70px rgba(0,0,0,.55),0 0 35px rgba(122,82,255,.18);padding:24px;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center}
      .cr3-pin-lock{font-size:34px;margin-bottom:8px}.cr3-pin-title{font-size:20px;font-weight:800;letter-spacing:.2px}.cr3-pin-sub{font-size:13px;opacity:.72;margin:7px 0 17px}
      .cr3-pin-input{box-sizing:border-box;width:100%;height:54px;border-radius:14px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#fff;text-align:center;font-size:25px;font-weight:800;letter-spacing:10px;outline:none;padding-left:10px}
      .cr3-pin-input:focus{border-color:#8f6cff;box-shadow:0 0 0 3px rgba(143,108,255,.16)}
      .cr3-pin-error{min-height:20px;margin:9px 0 2px;font-size:13px;color:#ff6f87;font-weight:700}
      .cr3-pin-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:10px}.cr3-pin-btn{height:44px;border:0;border-radius:13px;font-weight:800;cursor:pointer}.cr3-pin-cancel{background:rgba(255,255,255,.09);color:#fff}.cr3-pin-ok{background:linear-gradient(135deg,#7357ff,#b64cff);color:#fff}
    `;
    document.head.appendChild(style);
  }

  function requestPin(actionLabel) {
    return new Promise(resolve => {
      if (dialogOpen) return resolve(false);
      dialogOpen = true;
      injectStyles();

      const backdrop = document.createElement('div');
      backdrop.className = 'cr3-pin-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.innerHTML = `
        <div class="cr3-pin-box">
          <div class="cr3-pin-lock">🔐</div>
          <div class="cr3-pin-title">Code administrateur</div>
          <div class="cr3-pin-sub">Modification protégée${actionLabel ? ` · ${actionLabel}` : ''}</div>
          <input class="cr3-pin-input" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*" aria-label="Code administrateur à 4 chiffres">
          <div class="cr3-pin-error" aria-live="polite"></div>
          <div class="cr3-pin-actions">
            <button type="button" class="cr3-pin-btn cr3-pin-cancel">Annuler</button>
            <button type="button" class="cr3-pin-btn cr3-pin-ok">Déverrouiller</button>
          </div>
        </div>`;

      const input = backdrop.querySelector('.cr3-pin-input');
      const error = backdrop.querySelector('.cr3-pin-error');
      const cancel = backdrop.querySelector('.cr3-pin-cancel');
      const ok = backdrop.querySelector('.cr3-pin-ok');

      function close(result) {
        dialogOpen = false;
        backdrop.remove();
        resolve(result);
      }

      async function verify() {
        const pin = input.value.replace(/\D/g, '').slice(0, 4);
        input.value = pin;
        if (pin.length !== 4) {
          error.textContent = 'Entre les 4 chiffres du code.';
          input.focus();
          return;
        }

        try {
          if (await sha256(pin) === PIN_HASH) {
            close(true);
          } else {
            error.textContent = 'Code incorrect. Réessaie.';
            input.value = '';
            input.focus();
          }
        } catch {
          error.textContent = 'Vérification impossible sur ce navigateur.';
        }
      }

      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 4);
        error.textContent = '';
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') verify();
        if (event.key === 'Escape') close(false);
      });
      cancel.addEventListener('click', () => close(false));
      ok.addEventListener('click', verify);
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) close(false);
      });

      document.body.appendChild(backdrop);
      setTimeout(() => input.focus(), 0);
    });
  }

  document.addEventListener('click', async event => {
    const control = isProtectedControl(event.target);
    if (!control) return;

    if (bypassOnce.has(control)) {
      bypassOnce.delete(control);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const label = (control.textContent || control.getAttribute('aria-label') || control.title || '').trim();
    const allowed = await requestPin(label);
    if (!allowed) return;

    bypassOnce.add(control);
    control.click();
  }, true);
})();
