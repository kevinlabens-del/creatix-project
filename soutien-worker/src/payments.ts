import Stripe from 'stripe';
import type { AppEnv } from './env';
import { HttpError } from './http';
import type { RegistryProject } from './registry';

export type PaymentGate = { enabled: boolean; mode: 'disabled' | 'test' | 'live'; message: string };

export function paymentGate(env: AppEnv): PaymentGate {
  const requested = env.PAYMENT_MODE;
  if (requested === 'test') {
    const enabled = !!env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && !!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_');
    return { enabled, mode: 'test', message: enabled ? 'Stripe TEST opérationnel : aucun débit réel.' : 'Stripe TEST attend ses secrets serveur.' };
  }
  if (requested === 'live') {
    const enabled = !!env.STRIPE_SECRET_KEY?.startsWith('sk_live_') && !!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') && env.ALLOW_LIVE_PAYMENTS === 'yes' && (env.LEGAL_APPROVAL_ID?.length || 0) >= 8;
    return { enabled, mode: 'live', message: enabled ? 'Paiements réels activés après validation documentée.' : 'Paiement réel verrouillé : validation juridique ou configuration manquante.' };
  }
  return { enabled: false, mode: 'disabled', message: 'Aucun paiement réel n’est activé.' };
}

export function stripeClient(env: AppEnv): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'stripe_not_configured');
  return new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2, timeout: 12_000 });
}

export async function createStripeCheckout(env: AppEnv, input: {
  contributionId: string;
  idempotencyKey: string;
  project: RegistryProject;
  amountCents: number;
}): Promise<Stripe.Checkout.Session> {
  const stripe = stripeClient(env);
  return stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    submit_type: 'donate',
    payment_method_types: ['card'],
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: input.amountCents, product_data: { name: `Soutien volontaire — ${input.project.name}`, description: 'Sans contrepartie commerciale, sans investissement et sans déduction fiscale.' } } }],
    success_url: `${env.FRONTEND_BASE_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_BASE_URL}?payment=cancelled`,
    client_reference_id: input.contributionId,
    metadata: { contribution_id: input.contributionId, project_id: input.project.id, source: 'cr3atix-soutien' },
    payment_intent_data: { metadata: { contribution_id: input.contributionId, project_id: input.project.id, source: 'cr3atix-soutien' } },
    custom_text: { submit: { message: 'Soutien volontaire sans contrepartie. Aucun reçu fiscal ne sera délivré.' } },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60
  }, { idempotencyKey: `cr3atix_${input.idempotencyKey}` });
}

export async function verifyStripeEvent(env: AppEnv, payload: Uint8Array, signature: string): Promise<Stripe.Event> {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, 'webhook_not_configured');
  try {
    return await stripeClient(env).webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    throw new HttpError(400, 'invalid_webhook_signature');
  }
}
