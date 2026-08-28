import type Stripe from 'stripe';
import type { AppEnv } from './env';
import { apiResponse, emptyResponse, errorResponse, HttpError, readBytesLimited, readJsonLimited, requestId, requireAllowedOrigin } from './http';
import { createAdminSession, csvCell, deleteAdminSession, enforceRateLimit, isUuid, requireAdmin, sanitizePublicName, validateTurnstile, verifyPassword } from './security';
import { fetchRegistry, resolveProject } from './registry';
import { createStripeCheckout, paymentGate, verifyStripeEvent } from './payments';

type ContributionRow = {
  id: string; project_id: string; project_name_snapshot: string; amount_cents: number; refunded_cents: number; status: string;
  checkout_session_id: string | null; checkout_url: string | null; payment_intent_id: string | null; is_anonymous: number;
  public_name: string | null; public_consent: number; created_at: string; updated_at: string; confirmed_at: string | null;
};
type GoalRow = { project_id: string; goal_cents: number; purpose: string; roadmap_json: string; active: number; updated_at: string };

function integer(value: unknown): number | null { const result = Number(value); return Number.isInteger(result) ? result : null; }
function projectId(value: unknown): string | null { return typeof value === 'string' && /^[A-Za-z0-9_.@-]{1,80}$/.test(value) ? value : null; }
function nowIso(): string { return new Date().toISOString(); }
function dateOnly(value = new Date()): string { return value.toISOString().slice(0, 10); }
function paymentIntentId(value: string | Stripe.PaymentIntent | null): string | null { return typeof value === 'string' ? value : value?.id || null; }

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
  if (!id || !/^cs_(test_|live_)?[A-Za-z0-9]{8,255}$/.test(id)) throw new HttpError(400, 'invalid_session_id');
  await enforceRateLimit(request, env, 'session_status', 30);
  const row = await env.DB.prepare('SELECT status,amount_cents,project_id,confirmed_at FROM contributions WHERE checkout_session_id=?').bind(id).first<{ status: string; amount_cents: number; project_id: string; confirmed_at: string | null }>();
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

  const existing = await env.DB.prepare('SELECT id,status,checkout_url FROM contributions WHERE idempotency_key=?').bind(idempotencyKey).first<{ id: string; status: string; checkout_url: string | null }>();
  if (existing) {
    if (existing.checkout_url && ['pending','paid'].includes(existing.status)) return apiResponse(request, env, { contribution_id: existing.id, checkout_url: existing.checkout_url, reused: true });
    throw new HttpError(409, 'request_already_processed');
  }

  const project = await resolveProject(env, targetProjectId), contributionId = crypto.randomUUID(), createdAt = nowIso();
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO contributions(id,idempotency_key,project_id,project_name_snapshot,amount_cents,is_anonymous,public_name,public_consent,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(contributionId, idempotencyKey, project.id, project.name, amountCents, anonymous ? 1 : 0, publicName, publicConsent ? 1 : 0, createdAt, createdAt).run();
  if ((inserted.meta.changes || 0) !== 1) throw new HttpError(409, 'request_already_processed');
  try {
    const session = await createStripeCheckout(env, { contributionId, idempotencyKey, project, amountCents });
    if (!session.url) throw new Error('missing_checkout_url');
    await env.DB.prepare('UPDATE contributions SET checkout_session_id=?,checkout_url=?,provider_status=?,updated_at=? WHERE id=?').bind(session.id, session.url, session.status || 'open', nowIso(), contributionId).run();
    return apiResponse(request, env, { contribution_id: contributionId, checkout_url: session.url, expires_at: session.expires_at }, 201);
  } catch (error) {
    await env.DB.prepare("UPDATE contributions SET status='failed',provider_status='session_creation_failed',failed_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), contributionId).run();
    console.error(JSON.stringify({ level: 'error', operation: 'stripe_session_create', contribution_id: contributionId, error: error instanceof Error ? error.name : 'unknown' }));
    throw new HttpError(502, 'payment_provider_unavailable');
  }
}

async function beginWebhookEvent(env: AppEnv, event: Stripe.Event): Promise<boolean> {
  const receivedAt = nowIso(), staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const claimed = await env.DB.prepare(`INSERT INTO webhook_events(event_id,event_type,processing_status,received_at) VALUES(?,?,'processing',?)
    ON CONFLICT(event_id) DO UPDATE SET processing_status='processing',received_at=excluded.received_at,processed_at=NULL
    WHERE webhook_events.processing_status='processing' AND webhook_events.received_at<? RETURNING event_id`).bind(event.id, event.type, receivedAt, staleBefore).first<{ event_id: string }>();
  return !!claimed;
}
async function finishWebhookEvent(env: AppEnv, eventId: string, status: 'processed' | 'rejected' = 'processed'): Promise<void> {
  await env.DB.prepare('UPDATE webhook_events SET processing_status=?,processed_at=? WHERE event_id=?').bind(status, nowIso(), eventId).run();
}

async function processCheckoutPaid(env: AppEnv, session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  const contributionId = session.metadata?.contribution_id || session.client_reference_id;
  if (!contributionId || !isUuid(contributionId)) { await finishWebhookEvent(env, eventId, 'rejected'); return; }
  const row = await env.DB.prepare('SELECT id,amount_cents,currency,status,project_id FROM contributions WHERE id=? AND checkout_session_id=?').bind(contributionId, session.id).first<{ id: string; amount_cents: number; currency: string; status: string; project_id: string }>();
  if (!row || session.amount_total !== row.amount_cents || session.currency !== row.currency || session.payment_status !== 'paid') {
    if (row) await env.DB.prepare("UPDATE contributions SET status='failed',provider_status='verification_mismatch',failed_at=?,updated_at=? WHERE id=? AND status='pending'").bind(nowIso(), nowIso(), row.id).run();
    await finishWebhookEvent(env, eventId, 'rejected'); return;
  }
  const updated = await env.DB.prepare(`UPDATE contributions SET status='paid',provider_status=?,payment_intent_id=?,confirmed_at=COALESCE(confirmed_at,?),updated_at=? WHERE id=? AND status='pending'`).bind(session.payment_status, paymentIntentId(session.payment_intent), nowIso(), nowIso(), row.id).run();
  if ((updated.meta.changes || 0) === 1) await env.DB.prepare(`INSERT INTO support_events(day,event_type,project_id,events) VALUES(?,'conversion',?,1)
    ON CONFLICT(day,event_type,project_id) DO UPDATE SET events=events+1`).bind(dateOnly(), row.project_id).run();
  await finishWebhookEvent(env, eventId);
}

async function processStripeEvent(env: AppEnv, event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await processCheckoutPaid(env, event.data.object as Stripe.Checkout.Session, event.id); return;
  }
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await env.DB.prepare(`UPDATE contributions SET status=?,provider_status=?,failed_at=?,updated_at=? WHERE checkout_session_id=? AND status='pending'`).bind(event.type.endsWith('expired') ? 'cancelled' : 'failed', event.type, nowIso(), nowIso(), session.id).run();
    await finishWebhookEvent(env, event.id); return;
  }
  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    await env.DB.prepare("UPDATE contributions SET status='failed',provider_status='payment_failed',failed_at=?,updated_at=? WHERE payment_intent_id=? AND status='pending'").bind(nowIso(), nowIso(), intent.id).run();
    await finishWebhookEvent(env, event.id); return;
  }
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge, intentId = paymentIntentId(charge.payment_intent);
    if (intentId) await env.DB.prepare(`UPDATE contributions SET refunded_cents=?,status=CASE WHEN ? >= amount_cents THEN 'refunded' ELSE 'partially_refunded' END,provider_status='refunded',refunded_at=?,updated_at=? WHERE payment_intent_id=? AND status IN ('paid','partially_refunded','refunded')`).bind(charge.amount_refunded, charge.amount_refunded, nowIso(), nowIso(), intentId).run();
    await finishWebhookEvent(env, event.id); return;
  }
  await finishWebhookEvent(env, event.id);
}

async function stripeWebhook(request: Request, env: AppEnv): Promise<Response> {
  const declared = Number(request.headers.get('content-length') || 0); if (declared > 524288) throw new HttpError(413, 'payload_too_large');
  const signature = request.headers.get('stripe-signature'); if (!signature) throw new HttpError(400, 'missing_webhook_signature');
  const payload = await readBytesLimited(request.body, 524288), event = await verifyStripeEvent(env, payload, signature);
  if (!await beginWebhookEvent(env, event)) return apiResponse(request, env, { received: true, duplicate: true });
  try { await processStripeEvent(env, event); return apiResponse(request, env, { received: true }); }
  catch (error) { await env.DB.prepare('DELETE FROM webhook_events WHERE event_id=? AND processing_status=?').bind(event.id, 'processing').run(); throw error; }
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
  const result = await env.DB.prepare(`SELECT id,project_id,project_name_snapshot,amount_cents,refunded_cents,currency,status,is_anonymous,public_name,public_consent,checkout_session_id,payment_intent_id,created_at,confirmed_at,refunded_at
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
  if (request.method === 'GET' && path === '/v1/health') { const gate = paymentGate(env); return apiResponse(request, env, { ok: true, payments_enabled: gate.enabled, payment_mode: gate.mode, message: gate.message, registry: 'CR3@TIX MAP', version: '1.0.0' }); }
  if (request.method === 'GET' && path === '/v1/projects') { const projects = await fetchRegistry(env); return apiResponse(request, env, { projects, source: 'CR3@TIX MAP', fetched_at: nowIso() }, 200, { 'cache-control': 'public, max-age=30' }); }
  if (request.method === 'GET' && path === '/v1/stats') return publicStats(request, env);
  if (request.method === 'GET' && path === '/v1/session-status') return sessionStatus(request, env, url);
  if (request.method === 'POST' && path === '/v1/events') return recordClientEvent(request, env);
  if (request.method === 'POST' && path === '/v1/checkout') return createCheckout(request, env);
  if (request.method === 'POST' && path === '/v1/webhooks/stripe') return stripeWebhook(request, env);
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

export { processStripeEvent };
