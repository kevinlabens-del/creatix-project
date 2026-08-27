import { loadProjects, safeHttps } from './projects.js';

const config = window.CR3ATIX_SOUTIEN_CONFIG || {};
const state = { projects: [], stats: null, health: null, selectedAmount: 1000, deferredPrompt: null };
const byId = id => document.getElementById(id);
const euro = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: cents % 100 ? 2 : 0 }).format((Number(cents) || 0) / 100);
const number = value => new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const safeUrl = value => safeHttps(value) || '#';

function apiUrl(path) {
  const base = String(config.apiBase || '').replace(/\/$/, '');
  return base ? `${base}${path}` : '';
}

async function api(path, options = {}) {
  const url = apiUrl(path);
  if (!url) throw new Error('Le serveur de paiement TEST n’est pas encore connecté.');
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || payload.message || `Erreur serveur (${response.status})`);
  return payload;
}

function toast(message, duration = 3800) {
  const element = byId('toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(element.timer);
  element.timer = setTimeout(() => { element.hidden = true; }, duration);
}

function setRegistryStatus(kind, label) {
  const element = byId('registryStatus');
  element.className = `registry-status ${kind}`;
  element.querySelector('span').textContent = label;
}

function projectStats(id) {
  const rows = state.stats?.by_project || [];
  return rows.find(row => row.project_id === id) || null;
}

function renderSkeletons() {
  byId('projectGrid').innerHTML = '<div class="skeleton"></div>'.repeat(6);
}

function renderFilters() {
  const filter = byId('categoryFilter');
  const current = filter.value;
  const categories = [...new Set(state.projects.map(project => project.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  filter.innerHTML = '<option value="all">Toutes les catégories</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if ([...filter.options].some(option => option.value === current)) filter.value = current;
}

function filteredProjects() {
  const query = byId('searchInput').value.trim().toLocaleLowerCase('fr');
  const category = byId('categoryFilter').value;
  const sort = byId('sortSelect').value;
  const result = state.projects.filter(project => {
    const haystack = `${project.name} ${project.description} ${project.category}`.toLocaleLowerCase('fr');
    return (!query || haystack.includes(query)) && (category === 'all' || project.category === category);
  });
  result.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
    if (sort === 'progress') return b.developmentProgress - a.developmentProgress;
    if (sort === 'recent') return String(b.addedAt || '').localeCompare(String(a.addedAt || '')) || b.sourceIndex - a.sourceIndex;
    const aStats = projectStats(a.id), bStats = projectStats(b.id);
    return Number(bStats?.net_cents || 0) - Number(aStats?.net_cents || 0) || a.sourceIndex - b.sourceIndex;
  });
  return result;
}

function imageMarkup(project) {
  const initial = escapeHtml(project.name.charAt(0).toUpperCase());
  return `<img src="${escapeHtml(safeUrl(project.icon))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${initial}">`;
}

function renderProjects() {
  const projects = filteredProjects();
  const grid = byId('projectGrid');
  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = projects.map(project => {
    const stats = projectStats(project.id);
    const goal = Number(stats?.goal_cents || 0);
    const collected = Number(stats?.net_cents || 0);
    const progress = goal > 0 ? Math.min(100, Math.round(collected * 100 / goal)) : null;
    const statLabel = stats ? `${euro(collected)} confirmé${stats.confirmed_count > 1 ? 's' : ''}` : 'Données financières indisponibles';
    return `<article class="project-card" data-project-id="${escapeHtml(project.id)}">
      <div class="project-visual"><span class="project-category">${escapeHtml(project.category)}</span>${imageMarkup(project)}</div>
      <div class="project-body"><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p>
        <div class="project-stat"><span>${escapeHtml(statLabel)}</span><b>${progress === null ? `${project.developmentProgress}% développé` : `${progress}% de l’objectif`}</b></div>
        <progress class="progress-track" max="100" value="${progress === null ? project.developmentProgress : progress}" aria-label="Progression ${progress === null ? project.developmentProgress : progress}%"></progress>
        <div class="project-actions"><button class="button primary" type="button" data-support-project="${escapeHtml(project.id)}">Soutenir ce projet</button><button class="details-button" type="button" data-details-project="${escapeHtml(project.id)}" aria-label="Détails de ${escapeHtml(project.name)}">↗</button></div>
      </div></article>`;
  }).join('');
  grid.querySelectorAll('img[data-fallback]').forEach(image => image.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'project-fallback-icon';
    fallback.textContent = image.dataset.fallback || 'C';
    image.replaceWith(fallback);
  }, { once: true }));
  byId('emptyState').hidden = projects.length > 0;
}

function renderTotals() {
  const hasStats = !!state.stats;
  byId('totalAmount').textContent = hasStats ? euro(state.stats.total_net_cents) : '—';
  byId('totalContributions').textContent = hasStats ? `${number(state.stats.confirmed_count)} contribution${state.stats.confirmed_count > 1 ? 's' : ''} confirmée${state.stats.confirmed_count > 1 ? 's' : ''}` : 'Statistiques indisponibles';
  byId('projectCount').textContent = number(state.projects.length);
  const mode = state.health?.payment_mode || 'disabled';
  byId('paymentMode').textContent = mode === 'test' ? 'TEST' : mode === 'live' ? 'RÉEL' : 'VERROUILLÉ';
  byId('servicePulse').className = state.health?.ok ? 'online' : 'offline';
  const enabled = !!state.health?.payments_enabled;
  byId('modeNotice').textContent = enabled && mode === 'test' ? 'Mode Stripe TEST : aucune carte réelle n’est débitée.' : enabled && mode === 'live' ? 'Paiements réels activés après validation.' : 'Aucun paiement réel n’est activé.';
}

function findProject(id) { return state.projects.find(project => project.id === id); }

function openProjectDetails(id) {
  const project = findProject(id);
  if (!project) return;
  const stats = projectStats(project.id);
  const roadmap = stats?.roadmap?.length ? stats.roadmap : project.roadmap;
  const purpose = stats?.purpose || project.supportPurpose || `Aider à améliorer, maintenir et faire évoluer ${project.name}.`;
  const goal = Number(stats?.goal_cents || 0), collected = Number(stats?.net_cents || 0);
  byId('projectDialogContent').innerHTML = `<div class="project-dialog-inner">
    <div class="project-dialog-visual">${imageMarkup(project)}</div>
    <div class="project-dialog-copy"><div class="eyebrow"><span></span>${escapeHtml(project.category)}</div><h2 id="projectDialogTitle">${escapeHtml(project.name)}</h2><p>${escapeHtml(project.description)}</p>
      <div class="detail-meta"><span>${escapeHtml(project.status === 'online' ? 'En ligne' : project.status)}</span>${project.version ? `<span>Version ${escapeHtml(project.version)}</span>` : ''}<span>${project.developmentProgress}% développé</span></div>
      <div class="detail-block"><h3>Objectif du soutien</h3><p>${escapeHtml(purpose)}</p>${goal > 0 ? `<p><b>${euro(collected)}</b> sur ${euro(goal)} • ${Math.min(100, Math.round(collected * 100 / goal))}%</p><progress class="progress-track" max="100" value="${Math.min(100, collected * 100 / goal)}" aria-label="Progression de l’objectif"></progress>` : '<p>Objectif financier non publié pour le moment.</p>'}</div>
      <div class="detail-block"><h3>Évolutions envisagées</h3>${roadmap?.length ? `<ul>${roadmap.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Les prochaines évolutions seront ajoutées à cette fiche dès qu’elles seront définies.</p>'}</div>
      <div class="detail-actions"><button class="button primary" type="button" data-support-project="${escapeHtml(project.id)}">Soutenir ce projet</button><a class="button secondary" href="${escapeHtml(safeUrl(project.url))}" target="_blank" rel="noopener noreferrer">Ouvrir l’application</a>${project.repositoryUrl ? `<a class="button secondary" href="${escapeHtml(safeUrl(project.repositoryUrl))}" target="_blank" rel="noopener noreferrer">Dépôt GitHub</a>` : ''}</div>
    </div></div>`;
  byId('projectDialog').showModal();
  track('project_view', project.id);
}

function openSupport(id) {
  const project = id === 'global' ? null : findProject(id);
  if (id !== 'global' && !project) return;
  byId('projectDialog').close();
  byId('supportProjectId').value = id;
  byId('supportTitle').textContent = project ? `Soutenir ${project.name}` : 'Soutenir CR3@TIX globalement';
  byId('supportDescription').textContent = project ? project.description : 'Pour aider l’ensemble de l’écosystème et ses prochains projets.';
  byId('supportIcon').textContent = (project?.name || 'CR3@TIX').charAt(0).toUpperCase();
  resetSupportForm();
  byId('supportDialog').showModal();
  track('support_click', id);
}

function resetSupportForm() {
  state.selectedAmount = 1000;
  byId('amountGrid').querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.amount === '1000'));
  byId('customAmountWrap').hidden = true;
  byId('customAmount').value = '';
  byId('anonymousInput').checked = true;
  byId('publicNameWrap').hidden = true;
  byId('publicName').value = '';
  byId('publicConsent').checked = false;
  byId('termsInput').checked = false;
  byId('supportError').hidden = true;
  updateCheckoutAmount();
}

function currentAmount() {
  if (state.selectedAmount === 'custom') return Math.round(Number(byId('customAmount').value || 0) * 100);
  return Number(state.selectedAmount);
}

function updateCheckoutAmount() { byId('checkoutAmount').textContent = euro(currentAmount()); }

async function submitSupport(event) {
  event.preventDefault();
  const error = byId('supportError');
  const button = byId('checkoutButton');
  error.hidden = true;
  const amountCents = currentAmount();
  if (amountCents < Number(config.minContributionCents || 200) || amountCents > Number(config.maxContributionCents || 20000)) {
    error.textContent = 'Choisis un montant compris entre 2 € et 200 €.'; error.hidden = false; return;
  }
  const anonymous = byId('anonymousInput').checked;
  const publicName = anonymous ? '' : byId('publicName').value.trim();
  const publicConsent = !anonymous && byId('publicConsent').checked;
  if (!anonymous && (publicName.length < 2 || !publicConsent)) { error.textContent = 'Renseigne un pseudo et confirme explicitement son affichage, ou reste anonyme.'; error.hidden = false; return; }
  if (!state.health?.payments_enabled) { error.textContent = state.health?.message || 'Le paiement est volontairement verrouillé. La version publique reste en mode démonstration.'; error.hidden = false; return; }
  const requestId = crypto.randomUUID();
  button.disabled = true;
  button.querySelector('span').textContent = 'Création de la session sécurisée…';
  try {
    const payload = await api('/v1/checkout', { method: 'POST', headers: { 'Idempotency-Key': requestId }, body: JSON.stringify({ requestId, projectId: byId('supportProjectId').value, amountCents, anonymous, publicName: publicName || null, publicConsent, termsAccepted: true }) });
    if (!payload.checkout_url || !safeHttpsCheckout(payload.checkout_url)) throw new Error('URL de paiement invalide.');
    track('checkout_start', byId('supportProjectId').value);
    location.assign(payload.checkout_url);
  } catch (cause) {
    error.textContent = cause.message || 'Impossible de joindre le paiement sécurisé.'; error.hidden = false;
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Continuer vers le paiement sécurisé';
  }
}

function safeHttpsCheckout(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname.endsWith('.stripe.com') || url.hostname === 'checkout.stripe.com'); } catch { return false; }
}

async function loadHealth() {
  try { state.health = await api('/v1/health'); }
  catch (error) { state.health = { ok: false, payments_enabled: false, payment_mode: 'disabled', message: error.message }; }
  renderTotals();
}

async function loadStats() {
  try { state.stats = await api('/v1/stats'); }
  catch { state.stats = null; }
  renderTotals();
  if (state.projects.length) renderProjects();
}

async function loadRegistry() {
  renderSkeletons();
  try {
    const registry = await loadProjects(config);
    state.projects = registry.projects;
    setRegistryStatus(registry.source === 'map-api' ? 'online' : '', registry.source === 'map-api' ? 'Synchronisé avec MAP' : 'Instantané MAP hors ligne');
  } catch (error) {
    state.projects = [];
    setRegistryStatus('offline', 'Registre indisponible');
    toast(error.message, 6000);
  }
  renderFilters(); renderProjects(); renderTotals();
}

async function handleReturnState() {
  const params = new URLSearchParams(location.search);
  if (params.get('payment') === 'cancelled') { toast('Paiement annulé : aucune contribution n’a été validée.', 6000); history.replaceState({}, '', location.pathname); return; }
  const sessionId = params.get('session_id');
  if (params.get('payment') !== 'success' || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId || '')) return;
  try {
    const result = await api(`/v1/session-status?id=${encodeURIComponent(sessionId)}`);
    if (result.status === 'paid') toast(`Merci ! Ta contribution de ${euro(result.amount_cents)} est confirmée.`, 8000);
    else toast('Paiement reçu par le prestataire, confirmation serveur en cours…', 7000);
    await loadStats();
  } catch { toast('Retour de paiement reçu. La confirmation sécurisée peut prendre quelques instants.', 7000); }
  history.replaceState({}, '', location.pathname);
}

function track(eventType, projectId = 'global') {
  const url = apiUrl('/v1/events');
  if (!url || !['project_view', 'support_click', 'checkout_start', 'support_view'].includes(eventType)) return;
  const body = JSON.stringify({ eventType, projectId, eventId: crypto.randomUUID() });
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

function bindEvents() {
  document.addEventListener('click', event => {
    const support = event.target.closest('[data-support-project]');
    if (support) { event.preventDefault(); openSupport(support.dataset.supportProject); return; }
    const details = event.target.closest('[data-details-project]');
    if (details) { event.preventDefault(); openProjectDetails(details.dataset.detailsProject); return; }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });
  [byId('projectDialog'), byId('supportDialog')].forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  ['searchInput', 'categoryFilter', 'sortSelect'].forEach(id => byId(id).addEventListener(id === 'searchInput' ? 'input' : 'change', renderProjects));
  byId('amountGrid').addEventListener('click', event => {
    const button = event.target.closest('button[data-amount]'); if (!button) return;
    state.selectedAmount = button.dataset.amount === 'custom' ? 'custom' : Number(button.dataset.amount);
    byId('amountGrid').querySelectorAll('button').forEach(item => item.classList.toggle('selected', item === button));
    byId('customAmountWrap').hidden = state.selectedAmount !== 'custom';
    if (state.selectedAmount === 'custom') setTimeout(() => byId('customAmount').focus(), 20);
    updateCheckoutAmount();
  });
  byId('customAmount').addEventListener('input', updateCheckoutAmount);
  byId('anonymousInput').addEventListener('change', () => { byId('publicNameWrap').hidden = byId('anonymousInput').checked; });
  byId('supportForm').addEventListener('submit', submitSupport);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.deferredPrompt = event; byId('installButton').hidden = false; });
  byId('installButton').addEventListener('click', async () => { if (!state.deferredPrompt) return; state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt = null; byId('installButton').hidden = true; });
}

async function init() {
  bindEvents();
  renderTotals();
  await Promise.all([loadRegistry(), loadHealth(), loadStats()]);
  await handleReturnState();
  track('support_view');
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}

init();
