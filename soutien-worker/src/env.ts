export type SecretBindings = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD_PEPPER?: string;
  SESSION_SECRET?: string;
  RATE_LIMIT_SALT?: string;
  TURNSTILE_SECRET_KEY?: string;
  ALLOW_LIVE_PAYMENTS?: string;
  LEGAL_APPROVAL_ID?: string;
};

type RuntimeBindings = {
  DB: D1Database;
  ENVIRONMENT: string;
  FRONTEND_ORIGIN: string;
  FRONTEND_BASE_URL: string;
  MAP_API_URL: string;
  PAYMENT_MODE: 'disabled' | 'test' | 'live';
  MIN_CONTRIBUTION_CENTS: string;
  MAX_CONTRIBUTION_CENTS: string;
};

export type AppEnv = RuntimeBindings & SecretBindings;
