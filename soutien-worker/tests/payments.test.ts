import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/env';
import { buildPayPalCheckout, parseMoneyCents, parsePayPalIpn, paymentGate, paypalEventIdentity, paypalReceiverMatches, verifyPayPalIpn } from '../src/payments';

function environment(values: Partial<AppEnv>): AppEnv {
  return values as AppEnv;
}

const base = {
  PAYMENT_MODE: 'test' as const,
  PAYPAL_BUSINESS_ID: 'ABCDEF1234567',
  PAYPAL_RECEIVER_ID: 'ABCDEF1234567',
  WORKER_BASE_URL: 'https://cr3atix-soutien-api.example.workers.dev',
  FRONTEND_BASE_URL: 'https://example.github.io/app/soutien/'
};

describe('paymentGate', () => {
  it('keeps payments disabled by default', () => {
    expect(paymentGate(environment({ PAYMENT_MODE: 'disabled' }))).toEqual({
      enabled: false,
      mode: 'disabled',
      provider: 'paypal',
      message: 'Aucun paiement réel n’est activé.'
    });
  });

  it('requires a valid PayPal beneficiary in Sandbox mode', () => {
    expect(paymentGate(environment({ PAYMENT_MODE: 'test' })).enabled).toBe(false);
    expect(paymentGate(environment(base))).toMatchObject({ enabled: true, mode: 'test', provider: 'paypal' });
  });

  it('keeps live mode locked without explicit activation', () => {
    const live = { ...base, PAYMENT_MODE: 'live' as const };
    expect(paymentGate(environment(live)).enabled).toBe(false);
    expect(paymentGate(environment({ ...live, ALLOW_LIVE_PAYMENTS: 'yes' }))).toMatchObject({ enabled: true, mode: 'live' });
  });
});

describe('PayPal checkout', () => {
  it('creates a direct POST form with immutable project and amount metadata', () => {
    const contributionId = '123e4567-e89b-42d3-a456-426614174000';
    const checkout = buildPayPalCheckout(environment(base), {
      contributionId,
      projectId: 'snake-2.0',
      projectName: 'Snake 2.0',
      amountCents: 1050
    });
    expect(checkout.actionUrl).toBe('https://www.sandbox.paypal.com/cgi-bin/webscr');
    expect(checkout.fields).toMatchObject({
      cmd: '_donations',
      business: base.PAYPAL_BUSINESS_ID,
      amount: '10.50',
      currency_code: 'EUR',
      item_number: 'snake-2.0',
      custom: contributionId,
      invoice: `CR3ATIX-${contributionId}`,
      notify_url: `${base.WORKER_BASE_URL}/v1/webhooks/paypal`,
      return: `${base.FRONTEND_BASE_URL}?payment=success&contribution_id=${contributionId}`
    });
  });

  it('parses exact decimal cents without floating-point rounding', () => {
    expect(parseMoneyCents('10.50')).toBe(1050);
    expect(parseMoneyCents('-4.00')).toBe(-400);
    expect(parseMoneyCents('2')).toBe(200);
    expect(parseMoneyCents('2.999')).toBeNull();
    expect(parseMoneyCents('1e3')).toBeNull();
  });
});

describe('PayPal IPN authentication', () => {
  it('posts the untouched payload to the official Sandbox verification endpoint', async () => {
    const fetcher = vi.fn(async () => new Response('VERIFIED', { status: 200 }));
    const raw = 'payment_status=Completed&txn_id=PAYPAL123&mc_gross=10.00';
    await verifyPayPalIpn(environment(base), raw, fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith('https://ipnpb.sandbox.paypal.com/cgi-bin/webscr', expect.objectContaining({
      method: 'POST', body: `cmd=_notify-validate&${raw}`, redirect: 'error'
    }));
  });

  it('rejects an INVALID verdict and duplicate security fields', async () => {
    const fetcher = vi.fn(async () => new Response('INVALID', { status: 200 }));
    await expect(verifyPayPalIpn(environment(base), 'txn_id=PAYPAL123', fetcher as typeof fetch)).rejects.toThrow('invalid_paypal_ipn');
    expect(() => parsePayPalIpn('txn_id=PAYPAL123&txn_id=PAYPAL456&payment_status=Completed')).toThrow('duplicate_ipn_field');
  });

  it('matches the expected receiver and derives a replay-safe event identity', () => {
    const ipn = { receiver_id: base.PAYPAL_RECEIVER_ID, txn_id: 'PAYPAL123', payment_status: 'Completed' };
    expect(paypalReceiverMatches(environment(base), ipn)).toBe(true);
    expect(paypalReceiverMatches(environment(base), { ...ipn, receiver_id: 'ATTACKER123' })).toBe(false);
    expect(paypalEventIdentity(ipn)).toEqual({ id: 'paypal:PAYPAL123:completed', type: 'paypal.completed' });
  });
});
