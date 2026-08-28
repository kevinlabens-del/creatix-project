import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { processPayPalIpn } from '../src/index';

type Row = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  project_id: string;
  provider_transaction_id: string | null;
  provider_status: string | null;
  refunded_cents: number;
};
type RunResult = { meta: { changes: number } };

class FakeDatabase {
  row: Row = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    amount_cents: 1000,
    currency: 'eur',
    status: 'pending',
    project_id: 'snake',
    provider_transaction_id: null,
    provider_status: null,
    refunded_cents: 0
  };
  conversions = 0;
  webhookStatus = '';

  prepare(sql: string): FakeStatement { return new FakeStatement(this, sql); }
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private readonly database: FakeDatabase, private readonly sql: string) {}
  bind(...values: unknown[]): this { this.values = values; return this; }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM contributions WHERE id=? AND provider='paypal'")) {
      return (this.values[0] === this.database.row.id ? { ...this.database.row } : null) as T | null;
    }
    if (this.sql.includes('FROM contributions WHERE provider_transaction_id=? AND provider=?')) {
      return (this.values[0] === this.database.row.provider_transaction_id ? {
        id: this.database.row.id,
        amount_cents: this.database.row.amount_cents,
        refunded_cents: this.database.row.refunded_cents
      } : null) as T | null;
    }
    return null;
  }

  async run(): Promise<RunResult> {
    if (this.sql.includes("SET status='paid',provider_status=?")) {
      if (this.database.row.status !== 'pending' || this.database.row.provider_transaction_id !== null || this.values[4] !== this.database.row.id) return { meta: { changes: 0 } };
      this.database.row.status = 'paid';
      this.database.row.provider_status = String(this.values[0]);
      this.database.row.provider_transaction_id = String(this.values[1]);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("status='failed',provider_status='verification_mismatch'")) {
      if (this.database.row.status === 'pending' && this.values[2] === this.database.row.id) {
        this.database.row.status = 'failed';
        this.database.row.provider_status = 'verification_mismatch';
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("SET provider_status=?,updated_at=? WHERE id=? AND status='pending'")) {
      if (this.database.row.status === 'pending' && this.values[2] === this.database.row.id) {
        this.database.row.provider_status = String(this.values[0]);
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("SET status='failed',provider_status=?")) {
      if (this.database.row.status === 'pending' && this.values[3] === this.database.row.id) {
        this.database.row.status = 'failed';
        this.database.row.provider_status = String(this.values[0]);
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes('SET refunded_cents=?,status=?,provider_status=?')) {
      if (this.values[5] !== this.database.row.id) return { meta: { changes: 0 } };
      this.database.row.refunded_cents = Number(this.values[0]);
      this.database.row.status = String(this.values[1]);
      this.database.row.provider_status = String(this.values[2]);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("SET refunded_cents=0,status='paid'")) {
      if (this.values[2] !== this.database.row.provider_transaction_id || !['refunded', 'partially_refunded'].includes(this.database.row.status)) return { meta: { changes: 0 } };
      this.database.row.refunded_cents = 0;
      this.database.row.status = 'paid';
      this.database.row.provider_status = String(this.values[0]);
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes('INSERT INTO support_events')) {
      this.database.conversions += 1;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes('UPDATE webhook_events SET processing_status=')) {
      this.database.webhookStatus = String(this.values[0]);
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }
}

function environment(database: FakeDatabase): AppEnv {
  return { DB: database, PAYPAL_BUSINESS_ID: 'ABCDEF1234567', PAYPAL_RECEIVER_ID: 'ABCDEF1234567' } as unknown as AppEnv;
}

function completed(database: FakeDatabase, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    receiver_id: 'ABCDEF1234567',
    payment_status: 'Completed',
    txn_id: 'PAYPALTXN001',
    custom: database.row.id,
    invoice: `CR3ATIX-${database.row.id}`,
    item_number: database.row.project_id,
    mc_gross: '10.00',
    mc_currency: 'EUR',
    ...overrides
  };
}

describe('verified PayPal IPN state transitions', () => {
  it('confirms a matching transaction once and does not count a replay twice', async () => {
    const database = new FakeDatabase();
    const ipn = completed(database);
    await processPayPalIpn(environment(database), ipn, 'paypal:PAYPALTXN001:completed');
    expect(database.row.status).toBe('paid');
    expect(database.row.provider_transaction_id).toBe('PAYPALTXN001');
    expect(database.conversions).toBe(1);
    await processPayPalIpn(environment(database), ipn, 'paypal:PAYPALTXN001:completed');
    expect(database.conversions).toBe(1);
  });

  it('rejects a manipulated amount and never validates it', async () => {
    const database = new FakeDatabase();
    await processPayPalIpn(environment(database), completed(database, { mc_gross: '2.00' }), 'paypal:PAYPALTXN002:completed');
    expect(database.row.status).toBe('failed');
    expect(database.webhookStatus).toBe('rejected');
    expect(database.conversions).toBe(0);
  });

  it('rejects a transaction addressed to another receiver', async () => {
    const database = new FakeDatabase();
    await processPayPalIpn(environment(database), completed(database, { receiver_id: 'ATTACKER123' }), 'paypal:PAYPALTXN003:completed');
    expect(database.row.status).toBe('pending');
    expect(database.webhookStatus).toBe('rejected');
  });

  it('accepts Pending first and only confirms after Completed', async () => {
    const database = new FakeDatabase();
    await processPayPalIpn(environment(database), completed(database, { payment_status: 'Pending' }), 'paypal:PAYPALTXN001:pending');
    expect(database.row.status).toBe('pending');
    expect(database.row.provider_status).toBe('Pending');
    expect(database.conversions).toBe(0);
    await processPayPalIpn(environment(database), completed(database), 'paypal:PAYPALTXN001:completed');
    expect(database.row.status).toBe('paid');
    expect(database.conversions).toBe(1);
  });

  it('tracks partial and full refunds from verified provider events', async () => {
    const database = new FakeDatabase();
    await processPayPalIpn(environment(database), completed(database), 'paypal:PAYPALTXN001:completed');
    await processPayPalIpn(environment(database), completed(database, {
      payment_status: 'Refunded', txn_id: 'REFUNDTXN001', parent_txn_id: 'PAYPALTXN001', mc_gross: '-4.00'
    }), 'paypal:REFUNDTXN001:refunded');
    expect(database.row.status).toBe('partially_refunded');
    expect(database.row.refunded_cents).toBe(400);
    await processPayPalIpn(environment(database), completed(database, {
      payment_status: 'Refunded', txn_id: 'REFUNDTXN002', parent_txn_id: 'PAYPALTXN001', mc_gross: '-6.00'
    }), 'paypal:REFUNDTXN002:refunded');
    expect(database.row.status).toBe('refunded');
    expect(database.row.refunded_cents).toBe(1000);
  });
});
