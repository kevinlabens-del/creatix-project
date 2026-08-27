import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { paymentGate } from '../src/payments';

function environment(values: Partial<AppEnv>): AppEnv {
  return values as AppEnv;
}

describe('paymentGate', () => {
  it('keeps payments disabled by default', () => {
    expect(paymentGate(environment({ PAYMENT_MODE: 'disabled' }))).toEqual({
      enabled: false,
      mode: 'disabled',
      message: 'Aucun paiement réel n’est activé.'
    });
  });

  it('only enables test mode with both Stripe test secrets', () => {
    expect(paymentGate(environment({ PAYMENT_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_example' })).enabled).toBe(false);
    expect(paymentGate(environment({
      PAYMENT_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example'
    }))).toMatchObject({ enabled: true, mode: 'test' });
  });

  it('requires every independent legal and technical gate for live mode', () => {
    const base = {
      PAYMENT_MODE: 'live' as const,
      STRIPE_SECRET_KEY: 'sk_live_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example',
      ALLOW_LIVE_PAYMENTS: 'yes'
    };
    expect(paymentGate(environment(base)).enabled).toBe(false);
    expect(paymentGate(environment({ ...base, LEGAL_APPROVAL_ID: 'RESCRIT-2026-0001' }))).toMatchObject({ enabled: true, mode: 'live' });
  });

  it('refuses live mode with a test key', () => {
    expect(paymentGate(environment({
      PAYMENT_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example',
      ALLOW_LIVE_PAYMENTS: 'yes',
      LEGAL_APPROVAL_ID: 'RESCRIT-2026-0001'
    }))).toMatchObject({ enabled: false, mode: 'live' });
  });
});
