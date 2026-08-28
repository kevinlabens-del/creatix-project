import type { AppEnv } from './env';
import { apiResponse, emptyResponse, errorResponse, HttpError, readBytesLimited, readJsonLimited, requestId, requireAllowedOrigin } from './http';
import { createAdminSession, csvCell, deleteAdminSession, enforceRateLimit, isUuid, requireAdmin, sanitizePublicName, validateTurnstile, verifyPassword } from './security';
import { fetchRegistry, resolveProject } from './registry';
import { buildPayPalCheckout, parseMoneyCents, parsePayPalIpn, paymentGate, paypalEventIdentity, paypalReceiverMatches, verifyPayPalIpn } from './payments';

type ContributionRow = {
  id: string; project_id: string; project_name_snapshot: string; amount_cents: number; refunded_cents: number; status: string;
  provider_reference_id: string | null; provider_checkout_url: string | null; provider_transaction_id: string | null; is_anonymous: number;
  public_name: string | null; public_consent: number; created_at: string; updated_at: string; confirmed_at: string | null;
};
type GoalRow = { project_id: string; goal_cents: number; purpose: string; roadmap_json: string; active: number; updated_at: string };

function integer(value: unknown): number | null { const result = Number(value); return Number.isInteger(result) ? result : null; }
function projectId(value: unknown): string | null { return typeof value === 'string' && /^[A-Za-z0-9_.@-]{1,80}$/.test(value) ? value : null; }
function nowIso(): string { return new Date().toISOString(); }
function dateOnly(value = new Date()): string { return value.toISOString().slice(0, 10); }

async function publicStats(request: Request, env: AppEnv): Promise<Response> {
  const [summary, contributions, goals, supporters] = await Promise.all([
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN amount_cents-refunded_cents ELSE 0 END),0) AS total_net_cents,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN 1 ELSE 0 END),0) AS confirmed_count
      FROM contributions`).first<{ total_net_cents: number; confirmed_count: number }>(),
    env.DB.prepare(`SELECT project_id,MAX(project_name_snapshot) AS project_name,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN amount_cents-refunded_cents ELSE 0 END),0) AS net_cents,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN 1 ELSE 0 END),0) AS confirmed_count
      FROM contributions GROUP BY project_id`).all<{ project_id: string; project_name: string; net_cents: number; confirmed_count: number }>(),
    env.DB.prepare('SELECT project_id,goal_cents,purpose,roadmap_json,active,updated_at FROM support_goals WHERE active=1').all<GoalRow>(),
    env.DB.prepare(`SELECT public_name,project_id,confirmed_at FROM contributions WHERE status='paid' AND is_anonymous=0 AND public_consent=1 AND public_name IS NOT NULL ORDER BY confirmed_at DESC LIMIT 12`).all<{ public_name: string; project_id: string; confirmed_at: string }>()
  ]);
  const rows = new Map<string, Record<string, unknown>>();
  for (const row of contributions.results) rows.set(row.project_id, { ...row, goal_cents: 0, purpose: '', roadmap: [] });
  for (const goal of goals.results) {
    const row = rows.get(goal.project_id) || { project_id: goal.project_id, project_name: goal.project_id, net_cents: 0, confirmed_count: 0 };
    rows.set(goal.project_id, { ...row, goal_cents: goal.goal_cents, purpose: goal.purpose, roadmap: parseRoadmap(goal.roadmap_json) });
  }
  return apiResponse(request, env, { total_net_cents: summary?.total_net_cents || 0, confirmed_count: summary?.confirmed_count || 0, by_project: [...rows.values()], recent_supporters: supporters.results, generated_at: nowIso() }, 200, { 'cache-control': 'public, max-age=30, stale-while-revalidate=120' });
}

function parseRoadmap(value: string): string[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').slice(0, 8) : []; } catch { return []; } }

async function sessionStatus(request: Request, env: AppEnv, url: URL): Promise<Response> {
  const id = url.searchParams.get('id');
  if (!isUuid(id)) throw new HttpError(400, 'invalid_contribution_id');
  await enforceRateLimit(request, env, 'session_status', 30);
  const row = await env.DB.prepare('SELECT status,amount_cents,project_id,confirmed_at,provider_status FROM contributions WHERE id=?').bind(id).first<{ status: string; amount_cents: number; project_id: string; confirmed_at: string | null; provider_status: string | null }>();
  if (!row) throw new HttpError(404, 'session_not_found');
  return apiResponse(request, env, row);
}

async function recordClientEvent(request: Request, env: AppEnv): Promise<Response> {
  requireAllowedOrigin(request, env); await enforceRateLimit(request, env, 'events', 60);
  const body = await readJsonLimited(request, 4096), eventId = body.eventId, eventType = body.eventType, sourceProjectId = projectId(body.projectId);
  if (!isUuid(eventId) || typeof eventType !== 'string' || !['support_view','project_view','support_click','checkout_start'].includes(eventType) || !sourceProjectId) throw new HttpError(400, 'invalid_event');
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO client_events(event_id,created_at) VALUES(?,?)').bind(eventId, nowIso()).run();
  if ((inserted.meta.changes || 0) > 0) await env.DB.prepare(`INSERT INTO support_events(day,event_type,project_id,events) VALUES(?,?,?,1)
    ON CONFLICT(day,event_type,project_id) DO UPDATE SET events=events+1`).bind(dateOnly(), eventType, sourceProjectId).run();
  return apiResponse(request, env, { ok: true }, 202);
}

async function createCheckout(request: Request, env: AppEnv): Promise<Response> {
  requireAllowedOrigin(request, env);
  const gate = paymentGate(env); if (!gate.enabled) throw new HttpError(503, gate.message);
  await enforceRateLimit(request, env, 'checkout', 6);
  const body = await readJsonLimited(request), idempotencyKey = request.headers.get('idempotency-key') || '';
  if (!isUuid(body.requestId) || body.requestId !== idempotencyKey) throw new HttpError(400, 'invalid_idempotency_key');
  const targetProjectId = projectId(body.projectId), amountCents = integer(body.amountCents), anonymous = body.anonymous === true;
  if (!targetProjectId || amountCents === null || amountCents < Number(env.MIN_CONTRIBUTION_CENTS) || amountCents > Number(env.MAX_CONTRIBUTION_CENTS) || body.termsAccepted !== true) throw new HttpError(400, 'invalid_contribution');
  const publicName = anonymous ? null : sanitizePublicName(body.publicName), publicConsent = !anonymous && body.publicConsent === true;
  if (!anonymous && (!publicName || !publicConsent)) throw new HttpError(400, 'public_consent_required');
  await validateTurnstile(request, env, body.turnstileToken, idempotencyKey);

  const existing = await env.DB.prepare('SELECT id,status,project_id,project_name_snapshot,amount_cents FROM contributions WHERE idempotency_key=?').bind(idempotencyKey).first<{ id: string; status: string; project_id: string; project_name_snapshot: string; amount_cents: number }>();
  if (existing) {
    if (existing.status === 'pending') {
      const checkout = buildPayPalCheckout(env, { contributionId: existing.id, projectId: existing.project_id, projectName: existing.project_name_snapshot, amountCents: existing.amount_cents });
      return apiResponse(request, env, { contribution_id: existing.id, provider: 'paypal', payment: { method: 'POST', action_url: checkout.actionUrl, fields: checkout.fields }, reused: true });
    }
    throw new HttpError(409, 'request_already_processed');
  }

  const project = await resolveProject(env, targetProjectId), contributionId = crypto.randomUUID(), createdAt = nowIso();
  const checkout = buildPayPalCheckout(env, { contributionId, projectId: project.id, projectName: project.name, amountCents });
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO contributions(id,idempotency_key,project_id,project_name_snapshot,amount_cents,is_anonymous,public_name,public_consent,created_at,updated_at,provider,provider_reference_id,provider_checkout_url,provider_status)
    VALUES(?,?,?,?,?,?,?,?,?,?,'paypal',?,?,?)`).bind(contributionId, idempotencyKey, project.id, project.name, amountCents, anonymous ? 1 : 0, publicName, publicConsent ? 1 : 0, createdAt, createdAt, contributionId, checkout.actionUrl, 'created').run();
  if ((inserted.meta.changes || 0) !== 1) throw new HttpError(409, 'request_already_processed');
  return apiResponse(request, env, { contribution_id: contributionId, provider: 'paypal', payment: { method: 'POST', action_url: checkout.actionUrl, fields: checkout.fields } }, 201);
}

async function beginWebhookEvent(env: AppEnv, eventId: string, eventType: string): Promise<boolean> {
  const receivedAt = nowIso(), staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const claimed = await env.DB.prepare(`INSERT INTO webhook_events(event_id,event_type,processing_status,received_at) VALUES(?,?,'processing',?)
    ON CONFLICT(event_id) DO UPDATE SET processing_status='processing',received_at=excluded.received_at,processed_at=NULL
    WHERE webhook_events.processing_status='processing' AND webhook_events.received_at<? RETURNING event_id`).bind(eventId, eventType, receivedAt, staleBefore).first<{ event_id: string }>();
  return !!claimed;
}
async function finishWebhookEvent(env: AppEnv, eventId: string, status: 'processed' | 'rejected' = 'processed'): Promise<void> {
  await env.DB.prepare('UPDATE webhook_events SET processing_status=?,processed_at=? WHERE event_id=?').bind(status, nowIso(), eventId).run();
}

type PayPalContribution = {
  id: string; amount_cents: number; currency: string; status: string; project_id: string;
  provider_transaction_id: string | null; refunded_cents: number;
};

async function rejectPayPalContribution(env: AppEnv, eventId: string, contributionId?: string): Promise<void> {
  if (contributionId && isUuid(contributionId)) {
    await env.DB.prepare("UPDATE contributions SET status='failed',provider_status='verification_mismatch',failed_at=?,updated_at=? WHERE id=? AND status='pending'").bind(nowIso(), nowIso(), contributionId).run();
  }
  await finishWebhookEvent(env, eventId, 'rejected');
}

export async function processPayPalIpn(env: AppEnv, ipn: Record<string, string>, eventId: string): Promise<void> {
  if (!paypalReceiverMatches(env, ipn)) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
  const status = (ipn.payment_status || '').toLowerCase();
  const currency = (ipn.mc_currency || '').toLowerCase();
  const amountCents = parseMoneyCents(ipn.mc_gross);

  if (status === 'refunded' || status === 'reversed') {
    const originalId = ipn.parent_txn_id;
    if (!originalId || currency !== 'eur' || amountCents === null || amountCents >= 0) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
    const row = await env.DB.prepare('SELECT id,amount_cents,refunded_cents FROM contributions WHERE provider_transaction_id=? AND provider=?').bind(originalId, 'paypal').first<{ id: string; amount_cents: number; refunded_cents: number }>();
    if (!row) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
    const refunded = Math.min(row.amount_cents, row.refunded_cents + Math.abs(amountCents));
    await env.DB.prepare(`UPDATE contributions SET refunded_cents=?,status=?,provider_status=?,refunded_at=?,updated_at=? WHERE id=?`).bind(refunded, refunded >= row.amount_cents ? 'refunded' : 'partially_refunded', ipn.payment_status, nowIso(), nowIso(), row.id).run();
    await finishWebhookEvent(env, eventId); return;
  }

  if (status === 'canceled_reversal') {
    const originalId = ipn.parent_txn_id;
    if (!originalId) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
    const restored = await env.DB.prepare("UPDATE contributions SET refunded_cents=0,status='paid',provider_status=?,refunded_at=NULL,updated_at=? WHERE provider_transaction_id=? AND provider='paypal' AND status IN ('refunded','partially_refunded')").bind(ipn.payment_status, nowIso(), originalId).run();
    await finishWebhookEvent(env, eventId, (restored.meta.changes || 0) > 0 ? 'processed' : 'rejected'); return;
  }

  const contributionId = ipn.custom;
  if (!isUuid(contributionId)) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
  const row = await env.DB.prepare("SELECT id,amount_cents,currency,status,project_id,provider_transaction_id,refunded_cents FROM contributions WHERE id=? AND provider='paypal'").bind(contributionId).first<PayPalContribution>();
  if (!row) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
  const invariantMatch = ipn.invoice === `CR3ATIX-${row.id}` && ipn.item_number === row.project_id && currency === row.currency;
  if (!invariantMatch) { await rejectPayPalContribution(env, eventId, row.id); return; }

  if (status === 'completed') {
    const transactionId = ipn.txn_id;
    if (!transactionId || amountCents !== row.amount_cents) { await rejectPayPalContribution(env, eventId, row.id); return; }
    if (row.status === 'paid') { await finishWebhookEvent(env, eventId, row.provider_transaction_id === transactionId ? 'processed' : 'rejected'); return; }
    const updated = await env.DB.prepare(`UPDATE contributions SET status='paid',provider_status=?,provider_transaction_id=?,confirmed_at=COALESCE(confirmed_at,?),updated_at=? WHERE id=? AND status='pending' AND provider_transaction_id IS NULL`).bind(ipn.payment_status, transactionId, nowIso(), nowIso(), row.id).run();
    if ((updated.meta.changes || 0) === 1) {
      await env.DB.prepare(`INSERT INTO support_events(day,event_type,project_id,events) VALUES(?,'conversion',?,1)
        ON CONFLICT(day,event_type,project_id) DO UPDATE SET events=events+1`).bind(dateOnly(), row.project_id).run();
      await finishWebhookEvent(env, eventId); return;
    }
    await finishWebhookEvent(env, eventId, 'rejected'); return;
  }

  if (status === 'pending') {
    await env.DB.prepare("UPDATE contributions SET provider_status=?,updated_at=? WHERE id=? AND status='pending'").bind(ipn.payment_status, nowIso(), row.id).run();
    await finishWebhookEvent(env, eventId); return;
  }

  if (['denied','failed','expired','voided'].includes(status)) {
    await env.DB.prepare("UPDATE contributions SET status='failed',provider_status=?,failed_at=?,updated_at=? WHERE id=? AND status='pending'").bind(ipn.payment_status, nowIso(), nowIso(), row.id).run();
    await finishWebhookEvent(env, eventId); return;
  }

  await finishWebhookEvent(env, eventId);
}

async function paypalWebhook(request: Request, env: AppEnv): Promise<Response> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 65_536) throw new HttpError(413, 'payload_too_large');
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) throw new HttpError(415, 'invalid_webhook_content_type');
  const payload = await readBytesLimited(request.body, 65_536);
  const rawBody = new TextDecoder().decode(payload);
  if (!rawBody) throw new HttpError(400, 'empty_webhook');
  await verifyPayPalIpn(env, rawBody);
  const ipn = parsePayPalIpn(rawBody);
  const identity = paypalEventIdentity(ipn);
  if (!identity) throw new HttpError(400, 'invalid_paypal_event');
  if (!await beginWebhookEvent(env, identity.id, identity.type)) return apiResponse(request, env, { received: true, duplicate: true });
  try {
    await processPayPalIpn(env, ipn, identity.id);
    return apiResponse(request, env, { received: true });
  } catch (error) {
    await env.DB.prepare('DELETE FROM webhook_events WHERE event_id=? AND processing_status=?').bind(identity.id, 'processing').run();
    throw error;
  }
}

async function adminLogin(request: Request, env: AppEnv): Promise<Response> {
  requireAllowedOrigin(request, env); await enforceRateLimit(request, env, 'admin_login', 5);
  const body = await readJsonLimited(request, 2048), password = typeof body.password === 'string' ? body.password : '';
  if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_PEPPER) throw new HttpError(503, 'admin_not_configured');
  if (password.length < 14 || !await verifyPassword(password, env.ADMIN_PASSWORD_HASH, env.ADMIN_PASSWORD_PEPPER)) throw new HttpError(401, 'invalid_credentials');
  const session = await createAdminSession(env); return apiResponse(request, env, session, 201);
}

function periodSince(value: string | null): { period: string; since: string } {
  if (value === 'all') return { period: 'all', since: '1970-01-01T00:00:00.000Z' };
  const days = ['7','30','90'].includes(value || '') ? Number(value) : 30;
  return { period: String(days), since: new Date(Date.now() - days * 86_400_000).toISOString() };
}

async function adminDashboard(request: Request, env: AppEnv, url: URL): Promise<Response> {
  await requireAdmin(request, env); const { period, since } = periodSince(url.searchParams.get('period'));
  const [summary, projects, funnel] = await Promise.all([
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN amount_cents-refunded_cents ELSE 0 END),0) AS total_net_cents,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN 1 ELSE 0 END),0) AS confirmed_count,
      COALESCE(AVG(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN amount_cents-refunded_cents END),0) AS average_cents,
      COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) AS failed_count,
      COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled_count
      FROM contributions WHERE created_at>=?`).bind(since).first<Record<string, number>>(),
    env.DB.prepare(`SELECT project_id,MAX(project_name_snapshot) AS project_name,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN amount_cents-refunded_cents ELSE 0 END),0) AS net_cents,
      COALESCE(SUM(CASE WHEN status IN ('paid','partially_refunded','refunded') THEN 1 ELSE 0 END),0) AS confirmed_count
      FROM contributions WHERE created_at>=? GROUP BY project_id ORDER BY net_cents DESC`).bind(since).all<Record<string, unknown>>(),
    env.DB.prepare('SELECT event_type,COALESCE(SUM(events),0) AS events FROM support_events WHERE day>=? GROUP BY event_type').bind(since.slice(0, 10)).all<{ event_type: string; events: number }>()
  ]);
  const funnelObject = Object.fromEntries(funnel.results.map(row => [row.event_type, row.events]));
  return apiResponse(request, env, { payment_mode: paymentGate(env).mode, period, summary: { ...summary, webhook_conversions: summary?.confirmed_count || 0 }, by_project: projects.results, funnel: funnelObject, generated_at: nowIso() });
}

async function adminTransactions(request: Request, env: AppEnv, url: URL): Promise<Response> {
  await requireAdmin(request, env); const { since } = periodSince(url.searchParams.get('period'));
  const limit = Math.max(1, Math.min(100, integer(url.searchParams.get('limit')) || 50)), cursor = url.searchParams.get('cursor');
  if (cursor && Number.isNaN(Date.parse(cursor))) throw new HttpError(400, 'invalid_cursor');
  const result = await env.DB.prepare(`SELECT id,project_id,project_name_snapshot,amount_cents,refunded_cents,status,is_anonymous,public_name,created_at,confirmed_at
    FROM contributions WHERE created_at>=? AND (? IS NULL OR created_at<?) ORDER BY created_at DESC LIMIT ?`).bind(since, cursor, cursor, limit + 1).all<ContributionRow>();
  const hasMore = result.results.length > limit, rows = result.results.slice(0, limit);
  return apiResponse(request, env, { transactions: rows, next_cursor: hasMore ? rows.at(-1)?.created_at || null : null });
}

async function adminExport(request: Request, env: AppEnv, url: URL): Promise<Response> {
  await requireAdmin(request, env); const { since } = periodSince(url.searchParams.get('period')), format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const result = await env.DB.prepare(`SELECT id,project_id,project_name_snapshot,amount_cents,refunded_cents,currency,status,is_anonymous,public_name,public_consent,provider_reference_id,provider_transaction_id,created_at,confirmed_at,refunded_at
    FROM contributions WHERE created_at>=? ORDER BY created_at DESC LIMIT 5000`).bind(since).all<Record<string, unknown>>();
  const headers = { ...Object.fromEntries(new Headers({ 'cache-control': 'no-store', 'content-disposition': `attachment; filename="cr3atix-soutien-${dateOnly()}.${format}"`, 'x-content-type-options': 'nosniff' })), ...Object.fromEntries(new Headers({ 'access-control-allow-origin': env.FRONTEND_ORIGIN, vary: 'Origin' })) };
  if (format === 'json') return new Response(JSON.stringify({ exported_at: nowIso(), transactions: result.results }, null, 2), { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
  const keys = ['id','project_id','project_name_snapshot','amount_cents','refunded_cents','currency','status','is_anonymous','public_name','created_at','confirmed_at','refunded_at'];
  const csv = [keys.map(csvCell).join(','), ...result.results.map(row => keys.map(key => csvCell(row[key])).join(','))].join('\r\n');
  return new Response(`\uFEFF${csv}`, { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8' } });
}

async function adminGoals(request: Request, env: AppEnv): Promise<Response> {
  await requireAdmin(request, env);
  if (request.method === 'GET') { const goals = await env.DB.prepare('SELECT project_id,goal_cents,purpose,roadmap_json,active,updated_at FROM support_goals ORDER BY project_id').all<GoalRow>(); return apiResponse(request, env, { goals: goals.results.map(goal => ({ ...goal, roadmap: parseRoadmap(goal.roadmap_json) })) }); }
  const body = await readJsonLimited(request), targetProjectId = projectId(body.projectId), goalCents = integer(body.goalCents), purpose = typeof body.purpose === 'string' ? body.purpose.trim().slice(0, 700) : '', roadmap = Array.isArray(body.roadmap) ? body.roadmap.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 180)).filter(Boolean).slice(0, 8) : [];
  if (!targetProjectId || goalCents === null || goalCents < 0 || goalCents > 100_000_000) throw new HttpError(400, 'invalid_goal');
  await resolveProject(env, targetProjectId);
  await env.DB.prepare(`INSERT INTO support_goals(project_id,goal_cents,purpose,roadmap_json,active,updated_at) VALUES(?,?,?,?,1,?)
    ON CONFLICT(project_id) DO UPDATE SET goal_cents=excluded.goal_cents,purpose=excluded.purpose,roadmap_json=excluded.roadmap_json,active=1,updated_at=excluded.updated_at`).bind(targetProjectId, goalCents, purpose, JSON.stringify(roadmap), nowIso()).run();
  return apiResponse(request, env, { ok: true });
}

async function route(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, '') || '/';
  if (request.method === 'OPTIONS') { requireAllowedOrigin(request, env); return emptyResponse(request, env); }
  if (request.method === 'GET' && path === '/v1/health') { const gate = paymentGate(env); return apiResponse(request, env, { ok: true, payments_enabled: gate.enabled, payment_mode: gate.mode, payment_provider: gate.provider, message: gate.message, registry: 'CR3@TIX MAP', version: '1.1.0' }); }
  if (request.method === 'GET' && path === '/v1/projects') { const projects = await fetchRegistry(env); return apiResponse(request, env, { projects, source: 'CR3@TIX MAP', fetched_at: nowIso() }, 200, { 'cache-control': 'public, max-age=30' }); }
  if (request.method === 'GET' && path === '/v1/stats') return publicStats(request, env);
  if (request.method === 'GET' && path === '/v1/session-status') return sessionStatus(request, env, url);
  if (request.method === 'POST' && path === '/v1/events') return recordClientEvent(request, env);
  if (request.method === 'POST' && path === '/v1/checkout') return createCheckout(request, env);
  if (request.method === 'POST' && path === '/v1/webhooks/paypal') return paypalWebhook(request, env);
  if (request.method === 'POST' && path === '/v1/admin/login') return adminLogin(request, env);
  if (request.method === 'POST' && path === '/v1/admin/logout') { requireAllowedOrigin(request, env); const hash = await requireAdmin(request, env); await deleteAdminSession(env, hash); return apiResponse(request, env, { ok: true }); }
  if (request.method === 'GET' && path === '/v1/admin/dashboard') return adminDashboard(request, env, url);
  if (request.method === 'GET' && path === '/v1/admin/transactions') return adminTransactions(request, env, url);
  if (request.method === 'GET' && path === '/v1/admin/export') return adminExport(request, env, url);
  if ((request.method === 'GET' || request.method === 'PUT') && path === '/v1/admin/goals') return adminGoals(request, env);
  throw new HttpError(404, 'not_found');
}

async function cleanup(env: AppEnv): Promise<void> {
  const now = nowIso(), twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString(), sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE contributions SET status='cancelled',provider_status='expired_cleanup',failed_at=?,updated_at=? WHERE status='pending' AND created_at<?").bind(now, now, twoDaysAgo),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM client_events WHERE created_at<?').bind(twoDaysAgo),
    env.DB.prepare('DELETE FROM rate_limits WHERE bucket<?').bind(twoDaysAgo),
    env.DB.prepare("DELETE FROM webhook_events WHERE received_at<? AND processing_status!='processing'").bind(sevenDaysAgo)
  ]);
}

export default {
  async fetch(request: Request, env: AppEnv, _ctx: ExecutionContext): Promise<Response> {
    const id = requestId(request), started = Date.now();
    try {
      const response = await route(request, env);
      console.log(JSON.stringify({ level: 'info', request_id: id, method: request.method, path: new URL(request.url).pathname, status: response.status, duration_ms: Date.now() - started }));
      return response;
    } catch (error) {
      const response = errorResponse(request, env, error, id);
      console.log(JSON.stringify({ level: response.status >= 500 ? 'error' : 'warn', request_id: id, method: request.method, path: new URL(request.url).pathname, status: response.status, duration_ms: Date.now() - started }));
      return response;
    }
  },
  async scheduled(_event: ScheduledController, env: AppEnv, ctx: ExecutionContext): Promise<void> { ctx.waitUntil(cleanup(env)); }
} satisfies ExportedHandler<AppEnv>;
