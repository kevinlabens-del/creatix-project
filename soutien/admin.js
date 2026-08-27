const config = window.CR3ATIX_SOUTIEN_CONFIG || {};
const tokenKey = 'cr3atix-soutien-admin-session';
const byId = id => document.getElementById(id);
const euro = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((Number(cents) || 0) / 100);
const number = value => new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const state = { token: sessionStorage.getItem(tokenKey) || '', period: '30', cursor: null, transactions: [] };

function apiUrl(path) { const base = String(config.apiBase || '').replace(/\/$/, ''); return base ? `${base}${path}` : ''; }
async function api(path, options = {}) {
  const url = apiUrl(path); if (!url) throw new Error('Le backend Cloudflare n’est pas encore connecté.');
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) } });
  let payload = {}; try { payload = await response.json(); } catch {}
  if (!response.ok) { const error = new Error(payload.error || `Erreur ${response.status}`); error.status = response.status; throw error; }
  return payload;
}
function showError(id, message) { const box = byId(id); box.textContent = message; box.hidden = !message; }
function showLogin() { byId('dashboardView').hidden = true; byId('loginView').hidden = false; }
function showDashboard() { byId('loginView').hidden = true; byId('dashboardView').hidden = false; }

async function login(event) {
  event.preventDefault(); showError('loginError', '');
  const button = event.submitter; button.disabled = true;
  try {
    const result = await api('/v1/admin/login', { method: 'POST', body: JSON.stringify({ password: byId('adminPassword').value }) });
    state.token = result.token; sessionStorage.setItem(tokenKey, result.token); byId('adminPassword').value = ''; showDashboard(); await loadDashboard(true);
  } catch (error) { showError('loginError', error.message); }
  finally { button.disabled = false; }
}

async function logout() {
  try { await api('/v1/admin/logout', { method: 'POST' }); } catch {}
  state.token = ''; sessionStorage.removeItem(tokenKey); showLogin();
}

function renderDashboard(data) {
  const summary = data.summary || {};
  byId('adminMode').textContent = data.payment_mode === 'live' ? 'MODE RÉEL' : 'MODE TEST';
  byId('metricTotal').textContent = euro(summary.total_net_cents);
  byId('metricCount').textContent = number(summary.confirmed_count);
  byId('metricAverage').textContent = `Panier moyen ${euro(summary.average_cents)}`;
  byId('metricConversion').textContent = number(summary.webhook_conversions);
  byId('metricFailures').textContent = number((summary.failed_count || 0) + (summary.cancelled_count || 0));
  const max = Math.max(1, ...(data.by_project || []).map(row => Number(row.net_cents) || 0));
  byId('projectBreakdown').innerHTML = (data.by_project || []).length ? data.by_project.map(row => `<div class="breakdown-row"><b>${escapeHtml(row.project_name || row.project_id)}</b><progress class="breakdown-track" max="100" value="${Math.max(2, (Number(row.net_cents) || 0) * 100 / max)}" aria-label="Part de ${escapeHtml(row.project_name || row.project_id)}"></progress><strong>${escapeHtml(euro(row.net_cents))}</strong></div>`).join('') : '<div class="admin-empty">Aucune contribution confirmée.</div>';
  const funnel = data.funnel || {};
  byId('funnelView').innerHTML = [['Consultations', funnel.project_view], ['Clics soutenir', funnel.support_click], ['Checkouts ouverts', funnel.checkout_start], ['Confirmations', summary.webhook_conversions]].map(([label, value]) => `<div class="funnel-row"><span>${label}</span><b>${number(value)}</b></div>`).join('');
}

function statusLabel(status) { return ({ paid: 'Confirmée', pending: 'En attente', failed: 'Échouée', cancelled: 'Annulée', refunded: 'Remboursée', partially_refunded: 'Remb. partiel' })[status] || status; }
function renderTransactions() {
  byId('transactionRows').innerHTML = state.transactions.length ? state.transactions.map(row => `<tr><td>${escapeHtml(new Date(row.created_at).toLocaleString('fr-FR'))}</td><td>${escapeHtml(row.project_name_snapshot || row.project_id)}</td><td>${escapeHtml(euro((row.amount_cents || 0) - (row.refunded_cents || 0)))}</td><td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(statusLabel(row.status))}</span></td><td>${row.is_anonymous ? 'Anonyme' : escapeHtml(row.public_name || '—')}</td><td><code>${escapeHtml(String(row.id || '').slice(0, 12))}…</code></td></tr>`).join('') : '<tr><td colspan="6"><div class="admin-empty">Aucune transaction pour cette période.</div></td></tr>';
  byId('loadMore').hidden = !state.cursor;
}

async function loadTransactions(reset = false) {
  if (reset) { state.cursor = null; state.transactions = []; }
  const query = new URLSearchParams({ period: state.period, limit: '50' }); if (state.cursor) query.set('cursor', state.cursor);
  const result = await api(`/v1/admin/transactions?${query}`);
  state.transactions.push(...(result.transactions || [])); state.cursor = result.next_cursor || null; renderTransactions();
}

async function loadDashboard(resetTransactions = false) {
  showError('adminError', '');
  try {
    const data = await api(`/v1/admin/dashboard?period=${encodeURIComponent(state.period)}`); renderDashboard(data); await loadTransactions(resetTransactions);
  } catch (error) {
    if (error.status === 401) { state.token = ''; sessionStorage.removeItem(tokenKey); showLogin(); showError('loginError', 'Session expirée. Reconnecte-toi.'); }
    else showError('adminError', error.message);
  }
}

async function downloadExport(format) {
  try {
    const response = await fetch(apiUrl(`/v1/admin/export?format=${format}&period=${encodeURIComponent(state.period)}`), { headers: { authorization: `Bearer ${state.token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Export impossible.');
    const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `cr3atix-soutien-${new Date().toISOString().slice(0, 10)}.${format}`; link.click(); URL.revokeObjectURL(link.href);
  } catch (error) { showError('adminError', error.message); }
}

function bind() {
  byId('loginForm').addEventListener('submit', login); byId('logoutButton').addEventListener('click', logout); byId('refreshAdmin').addEventListener('click', () => loadDashboard(true)); byId('loadMore').addEventListener('click', () => loadTransactions(false)); byId('exportCsv').addEventListener('click', () => downloadExport('csv')); byId('exportJson').addEventListener('click', () => downloadExport('json'));
  document.querySelector('.period-filter').addEventListener('click', event => { const button = event.target.closest('[data-period]'); if (!button) return; state.period = button.dataset.period; document.querySelectorAll('[data-period]').forEach(item => item.classList.toggle('active', item === button)); loadDashboard(true); });
}

bind();
if (state.token) { showDashboard(); loadDashboard(true); } else showLogin();
