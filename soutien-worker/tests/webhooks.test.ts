import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import type { AppEnv } from '../src/env';
import { processStripeEvent } from '../src/index';

type Row = { id: string; amount_cents: number; currency: string; status: string; project_id: string; checkout_session_id: string; payment_intent_id: string | null; refunded_cents: number };
type RunResult = { meta: { changes: number } };

class FakeDatabase {
  row: Row = { id: '123e4567-e89b-42d3-a456-426614174000', amount_cents: 1000, currency: 'eur', status: 'pending', project_id: 'snake', checkout_session_id: 'cs_test_secure123', payment_intent_id: null, refunded_cents: 0 };
  conversions = 0;
  webhookStatus = '';

  prepare(sql: string): FakeStatement { return new FakeStatement(this, sql); }
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private readonly database: FakeDatabase, private readonly sql: string) {}
  bind(...values: unknown[]): this { this.values = values; return this; }
  async first<T>(): Promise<T | null> {
    if (!this.sql.includes('SELECT id,amount_cents,currency,status,project_id FROM contributions')) return null;
    const [id, sessionId] = this.values;
    return (id === this.database.row.id && sessionId === this.database.row.checkout_session_id ? { ...this.database.row } : null) as T | null;
  }
  async run(): Promise<RunResult> {
    if (this.sql.includes("SET status='paid'")) {
      if (this.database.row.status !== 'pending') return { meta: { changes: 0 } };
      this.database.row.status = 'paid';
      this.database.row.payment_intent_id = String(this.values[1] || '') || null;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("provider_status='verification_mismatch'")) {
      if (this.database.row.status === 'pending') { this.database.row.status = 'failed'; return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes('UPDATE contributions SET status=?,provider_status=?')) {
      if (this.database.row.status === 'pending' && this.values[4] === this.database.row.checkout_session_id) { this.database.row.status = String(this.values[0]); return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes('refunded_cents=?,status=CASE')) {
      if (this.values[4] === this.database.row.payment_intent_id) {
        this.database.row.refunded_cents = Number(this.values[0]);
        this.database.row.status = this.database.row.refunded_cents >= this.database.row.amount_cents ? 'refunded' : 'partially_refunded';
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes('INSERT INTO support_events')) { this.database.conversions += 1; return { meta: { changes: 1 } }; }
    if (this.sql.includes('UPDATE webhook_events SET processing_status=')) { this.database.webhookStatus = String(this.values[0]); return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
}

function environment(database: FakeDatabase): AppEnv { return { DB: database } as unknown as AppEnv; }
function checkoutEvent(database: FakeDatabase, overrides: Partial<Stripe.Checkout.Session> = {}, id = 'evt_checkout_1'): Stripe.Event {
  const session = {
    id: database.row.checkout_session_id,
    amount_total: database.row.amount_cents,
    currency: 'eur',
    payment_status: 'paid',
    payment_intent: 'pi_secure123',
    client_reference_id: database.row.id,
    metadata: { contribution_id: database.row.id, project_id: database.row.project_id },
    ...overrides
  } as Stripe.Checkout.Session;
  return { id, type: 'checkout.session.completed', data: { object: session } } as unknown as Stripe.Event;
}

describe('authenticated webhook state transitions', () => {
  it('confirms a matching session once and ignores a replay for conversion totals', async () => {
    const database = new FakeDatabase(), event = checkoutEvent(database);
    await processStripeEvent(environment(database), event);
    expect(database.row.status).toBe('paid');
    expect(database.row.payment_intent_id).toBe('pi_secure123');
    expect(database.conversions).toBe(1);
    await processStripeEvent(environment(database), event);
    expect(database.conversions).toBe(1);
  });

  it('rejects a manipulated amount instead of validating the contribution', async () => {
    const database = new FakeDatabase();
    await processStripeEvent(environment(database), checkoutEvent(database, { amount_total: 200 }));
    expect(database.row.status).toBe('failed');
    expect(database.webhookStatus).toBe('rejected');
    expect(database.conversions).toBe(0);
  });

  it('marks an expired checkout as cancelled', async () => {
    const database = new FakeDatabase();
    const event = { id: 'evt_expired_1', type: 'checkout.session.expired', data: { object: { id: database.row.checkout_session_id } } } as unknown as Stripe.Event;
    await processStripeEvent(environment(database), event);
    expect(database.row.status).toBe('cancelled');
  });

  it('tracks full and partial refunds from the provider event', async () => {
    const database = new FakeDatabase();
    await processStripeEvent(environment(database), checkoutEvent(database));
    const partial = { id: 'evt_refund_1', type: 'charge.refunded', data: { object: { payment_intent: 'pi_secure123', amount_refunded: 400 } } } as unknown as Stripe.Event;
    await processStripeEvent(environment(database), partial);
    expect(database.row.status).toBe('partially_refunded');
    const full = { id: 'evt_refund_2', type: 'charge.refunded', data: { object: { payment_intent: 'pi_secure123', amount_refunded: 1000 } } } as unknown as Stripe.Event;
    await processStripeEvent(environment(database), full);
    expect(database.row.status).toBe('refunded');
    expect(database.row.refunded_cents).toBe(1000);
  });
});
