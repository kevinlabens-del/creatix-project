export type SecretBindings = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
  RATE_LIMIT_SALT?: string;
  TURNSTILE_SECRET_KEY?: string;
  ALLOW_LIVE_PAYMENTS?: string;
  LEGAL_APPROVAL_ID?: string;
};

type MutableConfiguration = {
  PAYMENT_MODE: 'disabled' | 'test' | 'live';
};

export type AppEnv = Omit<Env, keyof MutableConfiguration> & MutableConfiguration & SecretBindings;
