import Stripe from 'stripe';

// Montants autorisés (en euros). Le serveur re-vérifie TOUJOURS : ne jamais faire confiance au navigateur.
const MIN_EUR = 1;
const MAX_EUR = 500;

// Applications reconnues : le paramètre ?app=... de la page de don
const PRODUCTS = {
  'post-it': 'Don — Post-It',
  default: 'Don — Chitollie'
};

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe configuration missing' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  // Montant en euros -> centimes (entier obligatoire pour Stripe)
  const euros = Number(body.amount);
  if (!Number.isFinite(euros) || euros < MIN_EUR || euros > MAX_EUR) {
    return Response.json({ error: `Montant invalide (entre ${MIN_EUR} et ${MAX_EUR} €)` }, { status: 400 });
  }
  const unitAmount = Math.round(euros * 100);

  const source = Object.hasOwn(PRODUCTS, body.source) ? body.source : 'default';
  const origin = new URL(request.url).origin;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'form',
      mode: 'payment',
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      submit_type: 'donate',
      integration_identifier: 'embedded_web_0001',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: unitAmount,
          product_data: { name: PRODUCTS[source] }
        },
        quantity: 1
      }],
      metadata: { source },
      // {CHECKOUT_SESSION_ID} est remplacé par Stripe lui-même au moment de la redirection
      return_url: `${origin}/merci.html?session_id={CHECKOUT_SESSION_ID}`
    });
    return Response.json({ client_secret: session.client_secret }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Stripe Checkout:', error);
    return Response.json({ error: 'Unable to initialize payment' }, { status: 500 });
  }
};

export const config = { path: '/api/create-checkout-session' };
