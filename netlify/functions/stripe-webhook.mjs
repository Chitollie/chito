import Stripe from 'stripe';

// À déclarer dans Stripe : Développeurs > Webhooks > https://TON-SITE/api/stripe-webhook
// Événements : checkout.session.completed (et checkout.session.async_payment_succeeded)
export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();   // le corps BRUT est indispensable pour vérifier la signature

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (error) {
    console.error('Webhook signature invalide:', error.message);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (s.payment_status === 'paid') {
      // Pour un don, la trace dans les logs + le dashboard Stripe suffit. L'id d'événement rend le traitement idempotent.
      console.log(`Don reçu [${event.id}] ${(s.amount_total / 100).toFixed(2)} ${s.currency?.toUpperCase()} — source: ${s.metadata?.source || 'default'}`);
    }
  }
  return new Response('ok', { status: 200 });
};

export const config = { path: '/api/stripe-webhook' };
