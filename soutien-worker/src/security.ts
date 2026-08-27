import type { AppEnv } from './env';
import { HttpError } from './http';

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string { return [...bytes].map(value => value.toString(16).padStart(2, '0')).join(''); }
function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0; for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, hashText] = encodedHash.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations < 210000 || !saltText || !hashText || password.length > 512) return false;
  let salt: Uint8Array, expected: Uint8Array;
  try { salt = fromBase64Url(saltText); expected = fromBase64Url(hashText); } catch { return false; }
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations }, key, expected.length * 8));
  return constantTimeEqual(actual, expected);
}

export function randomToken(): string { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return toBase64Url(bytes); }
export async function sessionTokenHash(token: string, secret: string): Promise<string> { return sha256Hex(`${secret}\u0000${token}`); }

export async function clientHash(request: Request, env: AppEnv): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const salt = env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 24) throw new HttpError(503, 'security_not_configured');
  return sha256Hex(`${salt}\u0000${ip}`);
}

export async function enforceRateLimit(request: Request, env: AppEnv, action: string, limit: number): Promise<void> {
  const hash = await clientHash(request, env);
  const now = new Date(); now.setUTCSeconds(0, 0); const bucket = now.toISOString();
  const row = await env.DB.prepare(`INSERT INTO rate_limits(client_hash,action,bucket,count) VALUES(?,?,?,1)
    ON CONFLICT(client_hash,action,bucket) DO UPDATE SET count=count+1 RETURNING count`).bind(hash, action, bucket).first<{ count: number }>();
  if (!row || row.count > limit) throw new HttpError(429, 'rate_limited');
}

export function sanitizePublicName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 32 || !/^[\p{L}\p{N} ._'@-]+$/u.test(value)) return null;
  return value;
}

export function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export async function createAdminSession(env: AppEnv): Promise<{ token: string; expiresAt: string }> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503, 'admin_not_configured');
  const token = randomToken(), tokenHash = await sessionTokenHash(token, env.SESSION_SECRET);
  const now = new Date(), expires = new Date(now.getTime() + 30 * 60_000);
  await env.DB.prepare('INSERT INTO admin_sessions(token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?)').bind(tokenHash, now.toISOString(), expires.toISOString(), now.toISOString()).run();
  return { token, expiresAt: expires.toISOString() };
}

export async function requireAdmin(request: Request, env: AppEnv): Promise<string> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503, 'admin_not_configured');
  const match = /^Bearer ([A-Za-z0-9_-]{40,120})$/.exec(request.headers.get('authorization') || '');
  if (!match?.[1]) throw new HttpError(401, 'unauthorized');
  const tokenHash = await sessionTokenHash(match[1], env.SESSION_SECRET);
  const session = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?').bind(tokenHash).first<{ expires_at: string }>();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) { await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(tokenHash).run(); throw new HttpError(401, 'session_expired'); }
  await env.DB.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE token_hash=?').bind(new Date().toISOString(), tokenHash).run();
  return tokenHash;
}

export async function deleteAdminSession(env: AppEnv, tokenHash: string): Promise<void> { await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(tokenHash).run(); }

export async function validateTurnstile(request: Request, env: AppEnv, token: unknown, idempotencyKey: string): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (typeof token !== 'string' || token.length < 10 || token.length > 2100) throw new HttpError(400, 'turnstile_required');
  const body = new FormData(); body.set('secret', env.TURNSTILE_SECRET_KEY); body.set('response', token); body.set('idempotency_key', idempotencyKey);
  const ip = request.headers.get('cf-connecting-ip'); if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const result = await response.json<{ success?: boolean }>();
  if (!response.ok || result.success !== true) throw new HttpError(403, 'turnstile_failed');
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
