import type { AppEnv } from './env';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

const BASE_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-resource-policy': 'same-site',
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};

export function requestId(request: Request): string {
  return request.headers.get('cf-ray')?.slice(0, 40) || crypto.randomUUID();
}

export function allowedOrigin(request: Request, env: AppEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  if (origin === env.FRONTEND_ORIGIN) return origin;
  if (env.ENVIRONMENT !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

export function requireAllowedOrigin(request: Request, env: AppEnv): string {
  const origin = allowedOrigin(request, env);
  if (!origin) throw new HttpError(403, 'origin_not_allowed');
  return origin;
}

export function corsHeaders(request: Request, env: AppEnv): Record<string, string> {
  const origin = allowedOrigin(request, env);
  return origin ? {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key',
    'access-control-max-age': '600',
    'vary': 'Origin'
  } : { 'vary': 'Origin' };
}

export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...Object.fromEntries(new Headers(extra)) } });
}

export function apiResponse(request: Request, env: AppEnv, data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return json(data, status, { ...corsHeaders(request, env), ...Object.fromEntries(new Headers(extra)) });
}

export function emptyResponse(request: Request, env: AppEnv, status = 204): Response {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...corsHeaders(request, env) } });
}

export async function readBytesLimited(stream: ReadableStream<Uint8Array> | null, maximumBytes: number): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) throw new HttpError(413, 'payload_too_large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return combined;
}

export async function readJsonLimited(request: Request, maximumBytes = 16_384): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maximumBytes) throw new HttpError(413, 'payload_too_large');
  const bytes = await readBytesLimited(request.body, maximumBytes);
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('not_object');
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function errorResponse(request: Request, env: AppEnv, error: unknown, id: string): Response {
  if (error instanceof HttpError) return apiResponse(request, env, { error: error.message, request_id: id }, error.status);
  console.error(JSON.stringify({ level: 'error', request_id: id, error: error instanceof Error ? error.name : 'unknown' }));
  return apiResponse(request, env, { error: 'internal_error', request_id: id }, 500);
}
