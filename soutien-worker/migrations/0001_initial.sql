PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  idempotency_key TEXT NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 80),
  project_id TEXT NOT NULL CHECK(length(project_id) BETWEEN 1 AND 80),
  project_name_snapshot TEXT NOT NULL CHECK(length(project_name_snapshot) BETWEEN 1 AND 120),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 200 AND 20000),
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_cents >= 0 AND refunded_cents <= amount_cents),
  currency TEXT NOT NULL DEFAULT 'eur' CHECK(currency = 'eur'),
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK(provider = 'stripe'),
  checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','cancelled','refunded','partially_refunded')),
  provider_status TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1 CHECK(is_anonymous IN (0,1)),
  public_name TEXT CHECK(public_name IS NULL OR length(public_name) BETWEEN 2 AND 32),
  public_consent INTEGER NOT NULL DEFAULT 0 CHECK(public_consent IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  failed_at TEXT,
  refunded_at TEXT,
  CHECK(is_anonymous = 1 OR (public_consent = 1 AND public_name IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS contributions_status_date_idx ON contributions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_project_status_idx ON contributions(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_payment_intent_idx ON contributions(payment_intent_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 8 AND 255),
  event_type TEXT NOT NULL CHECK(length(event_type) BETWEEN 3 AND 120),
  processing_status TEXT NOT NULL DEFAULT 'processing' CHECK(processing_status IN ('processing','processed','rejected')),
  received_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  client_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(client_hash, action, bucket)
);
CREATE INDEX IF NOT EXISTS rate_limits_bucket_idx ON rate_limits(bucket);

CREATE TABLE IF NOT EXISTS support_goals (
  project_id TEXT PRIMARY KEY CHECK(length(project_id) BETWEEN 1 AND 80),
  goal_cents INTEGER NOT NULL DEFAULT 0 CHECK(goal_cents BETWEEN 0 AND 100000000),
  purpose TEXT NOT NULL DEFAULT '' CHECK(length(purpose) <= 700),
  roadmap_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(roadmap_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_events (
  event_id TEXT PRIMARY KEY CHECK(length(event_id) = 36),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_events (
  day TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('support_view','project_view','support_click','checkout_start','conversion')),
  project_id TEXT NOT NULL CHECK(length(project_id) BETWEEN 1 AND 80),
  events INTEGER NOT NULL DEFAULT 0 CHECK(events >= 0),
  PRIMARY KEY(day, event_type, project_id)
);
CREATE INDEX IF NOT EXISTS support_events_day_idx ON support_events(day DESC);
