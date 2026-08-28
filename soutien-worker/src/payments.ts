import type { AppEnv } from './env';
import { HttpError } from './http';

export type PaymentGate = { enabled: boolean; mode: 'disabled' | 'test' | 'live'; provider: 'paypal'; message: string };
export type PayPalCheckout = {
  actionUrl: string;
  fields: Record<string, string>;
};

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
const PAYER_ID = /^[A-Z0-9]{8,64}$/i;

function configuredRecipient(env: AppEnv): boolean {
  const business = env.PAYPAL_BUSINESS_ID?.trim() || '';
  const receiverId = env.PAYPAL_RECEIVER_ID?.trim() || '';
  const receiverEmail = env.PAYPAL_RECEIVER_EMAIL?.trim() || '';
  if (!business || (!EMAIL.test(business) && !PAYER_ID.test(business))) return false;
  return PAYER_ID.test(receiverId) || EMAIL.test(receiverEmail) || PAYER_ID.test(business) || EMAIL.test(business);
}

export function paymentGate(env: AppEnv): PaymentGate {
  const mode = env.PAYMENT_MODE;
  const recipientReady = configuredRecipient(env);
  if (mode === 'test') {
    return {
      enabled: recipientReady,
      mode: 'test',
      provider: 'paypal',
      message: recipientReady ? 'PayPal SANDBOX opérationnel : aucun débit réel.' : 'PayPal TEST attend l’identifiant du compte Sandbox.'
    };
  }
  if (mode === 'live') {
    const enabled = recipientReady && env.ALLOW_LIVE_PAYMENTS === 'yes';
    return {
      enabled,
      mode: 'live',
      provider: 'paypal',
      message: enabled ? 'Soutiens réels activés via PayPal.' : 'Paiement réel verrouillé : configuration PayPal ou confirmation d’activation manquante.'
    };
  }
  return { enabled: false, mode: 'disabled', provider: 'paypal', message: 'Aucun paiement réel n’est activé.' };
}

function paymentHost(env: AppEnv): string {
  return env.PAYMENT_MODE === 'test' ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
}

export function paypalVerificationUrl(env: AppEnv): string {
  return env.PAYMENT_MODE === 'test'
    ? 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
    : 'https://ipnpb.paypal.com/cgi-bin/webscr';
}

export function buildPayPalCheckout(env: AppEnv, input: {
  contributionId: string;
  projectId: string;
  projectName: string;
  amountCents: number;
}): PayPalCheckout {
  const gate = paymentGate(env);
  if (!gate.enabled || !env.PAYPAL_BUSINESS_ID) throw new HttpError(503, 'paypal_not_configured');
  const workerBase = String(env.WORKER_BASE_URL || '').replace(/\/$/, '');
  const frontendBase = String(env.FRONTEND_BASE_URL || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(workerBase) || !/^https:\/\//.test(frontendBase)) throw new HttpError(503, 'payment_urls_not_configured');

  return {
    actionUrl: `${paymentHost(env)}/cgi-bin/webscr`,
    fields: {
      cmd: '_donations',
      business: env.PAYPAL_BUSINESS_ID.trim(),
      amount: (input.amountCents / 100).toFixed(2),
      currency_code: 'EUR',
      item_name: `Soutien volontaire — ${input.projectName}`.slice(0, 127),
      item_number: input.projectId,
      custom: input.contributionId,
      invoice: `CR3ATIX-${input.contributionId}`,
      notify_url: `${workerBase}/v1/webhooks/paypal`,
      return: `${frontendBase}/?payment=success&contribution_id=${encodeURIComponent(input.contributionId)}`,
      cancel_return: `${frontendBase}/?payment=cancelled&contribution_id=${encodeURIComponent(input.contributionId)}`,
      no_shipping: '1',
      no_note: '0',
      lc: 'FR',
      charset: 'utf-8',
      bn: 'CR3ATIX_Donate_WPS_FR'
    }
  };
}

export function parseMoneyCents(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?)(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const whole = Number(match[2]);
  const fraction = Number((match[3] || '').padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  return match[1] ? -cents : cents;
}

const UNIQUE_SECURITY_FIELDS = new Set([
  'txn_id', 'parent_txn_id', 'payment_status', 'custom', 'invoice', 'receiver_id', 'receiver_email',
  'business', 'mc_gross', 'mc_currency', 'item_number', 'ipn_track_id'
]);

export function parsePayPalIpn(rawBody: string): Record<string, string> {
  const values = new URLSearchParams(rawBody);
  const result: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [key, value] of values) {
    if (UNIQUE_SECURITY_FIELDS.has(key) && seen.has(key)) throw new HttpError(400, 'duplicate_ipn_field');
    seen.add(key);
    result[key] = value;
  }
  return result;
}

export async function verifyPayPalIpn(env: AppEnv, rawBody: string, fetcher: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(paypalVerificationUrl(env), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
        'user-agent': 'CR3ATIX-SOUTIEN-IPN/1.1'
      },
      body: `cmd=_notify-validate&${rawBody}`,
      redirect: 'error'
    });
  } catch {
    throw new HttpError(502, 'paypal_verification_unavailable');
  }
  const verdict = (await response.text()).trim();
  if (!response.ok || verdict !== 'VERIFIED') throw new HttpError(400, 'invalid_paypal_ipn');
}

export function paypalReceiverMatches(env: AppEnv, ipn: Record<string, string>): boolean {
  const expectedId = (env.PAYPAL_RECEIVER_ID || (PAYER_ID.test(env.PAYPAL_BUSINESS_ID || '') ? env.PAYPAL_BUSINESS_ID : '') || '').trim().toUpperCase();
  const expectedEmail = (env.PAYPAL_RECEIVER_EMAIL || (EMAIL.test(env.PAYPAL_BUSINESS_ID || '') ? env.PAYPAL_BUSINESS_ID : '') || '').trim().toLowerCase();
  if (!expectedId && !expectedEmail) return false;
  if (expectedId && (ipn.receiver_id || '').trim().toUpperCase() !== expectedId) return false;
  if (expectedEmail && (ipn.receiver_email || '').trim().toLowerCase() !== expectedEmail) return false;
  return true;
}

export function paypalEventIdentity(ipn: Record<string, string>): { id: string; type: string } | null {
  const transaction = ipn.txn_id || ipn.ipn_track_id;
  const status = ipn.payment_status;
  if (!transaction || !status || !/^[A-Za-z0-9_-]{6,100}$/.test(transaction) || !/^[A-Za-z_ -]{3,40}$/.test(status)) return null;
  return { id: `paypal:${transaction}:${status.replace(/\s+/g, '_').toLowerCase()}`, type: `paypal.${status.replace(/\s+/g, '_').toLowerCase()}` };
}
