PRAGMA foreign_keys = OFF;

CREATE TABLE contributions_paypal (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  idempotency_key TEXT NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 80),
  project_id TEXT NOT NULL CHECK(length(project_id) BETWEEN 1 AND 80),
  project_name_snapshot TEXT NOT NULL CHECK(length(project_name_snapshot) BETWEEN 1 AND 120),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 200 AND 20000),
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_cents >= 0 AND refunded_cents <= amount_cents),
  currency TEXT NOT NULL DEFAULT 'eur' CHECK(currency = 'eur'),
  provider TEXT NOT NULL DEFAULT 'paypal' CHECK(provider IN ('paypal','stripe')),
  provider_reference_id TEXT UNIQUE,
  provider_checkout_url TEXT,
  provider_transaction_id TEXT UNIQUE,
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

INSERT INTO contributions_paypal (
  id,idempotency_key,project_id,project_name_snapshot,amount_cents,refunded_cents,currency,provider,
  provider_reference_id,provider_checkout_url,provider_transaction_id,status,provider_status,is_anonymous,public_name,
  public_consent,created_at,updated_at,confirmed_at,failed_at,refunded_at
)
SELECT
  id,idempotency_key,project_id,project_name_snapshot,amount_cents,refunded_cents,currency,provider,
  checkout_session_id,checkout_url,payment_intent_id,status,provider_status,is_anonymous,public_name,
  public_consent,created_at,updated_at,confirmed_at,failed_at,refunded_at
FROM contributions;

DROP TABLE contributions;
ALTER TABLE contributions_paypal RENAME TO contributions;

CREATE INDEX contributions_status_date_idx ON contributions(status, created_at DESC);
CREATE INDEX contributions_project_status_idx ON contributions(project_id, status, created_at DESC);
CREATE INDEX contributions_provider_transaction_idx ON contributions(provider_transaction_id);

PRAGMA foreign_keys = ON;
