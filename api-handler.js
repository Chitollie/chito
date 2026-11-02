
import Stripe from 'stripe';

const PRODUCTS = {
  'post-it': 'Don — Post-It',
  default: 'Don — Chitollie'
};

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/stripe-config') {
      return env.STRIPE_PUBLISHABLE_KEY
        ? json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY })
        : json({ error: 'Stripe configuration missing' }, 503);
    }

    if (path === '/api/haven-status') {
      try {
        const response = await fetch(
          'http://haven.arkya.app:30132/dynamic.json',
          { signal: AbortSignal.timeout(4000) }
        );

        if (response.ok) {
          const data = await response.json();

          return Response.json({
            online: true,
            players: Number(data.clients) || 0,
            maxPlayers: Number(data.sv_maxclients) || null
          }, {
            headers: {
              'Cache-Control': 'public, max-age=0, s-maxage=30'
            }
          });
        }
      } catch (error) {
        console.warn('Haven status unavailable:', error);
      }

      return json({ online: false });
    }

    if (path === '/api/create-checkout-session') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: 'Stripe configuration missing' }, 503);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const euros = Number(body.amount);

      if (!Number.isFinite(euros) || euros < 1 || euros > 500) {
        return json({ error: 'Montant invalide (entre 1 et 500 €)' }, 400);
      }

      const source = Object.hasOwn(PRODUCTS, body.source)
        ? body.source
        : 'default';

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);

        const session = await stripe.checkout.sessions.create({
          ui_mode: 'custom',
          mode: 'payment',
          billing_address_collection: 'auto',
          phone_number_collection: { enabled: false },
          automatic_tax: { enabled: false },
          line_items: [{
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(euros * 100),
              product_data: {
                name: PRODUCTS[source]
              }
            },
            quantity: 1
          }],
          metadata: { source },
          return_url: `${url.origin}/merci.html?session_id={CHECKOUT_SESSION_ID}`
        });

        return json({ client_secret: session.client_secret });
      } catch (error) {
        console.error('Stripe Checkout:', {
          message: error.message,
          type: error.type,
          code: error.code,
          param: error.param
        });

        return json({
          error: 'Unable to initialize payment',
          details: error.message
        }, 500);
      }
    }

    if (path === '/api/session-status') {
      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: 'Stripe configuration missing' }, 503);
      }

      const id = url.searchParams.get('session_id') || '';

      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
        return json({ error: 'Invalid session' }, 400);
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(id);

        return json({
          status: session.status,
          payment_status: session.payment_status
        });
      } catch (error) {
        console.error('Session status:', error);
        return json({ error: 'Unable to read session' }, 500);
      }
    }

    if (path === '/api/stripe-webhook') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
        return new Response('Webhook not configured', { status: 503 });
      }

      const stripe = new Stripe(env.STRIPE_SECRET_KEY);

      let event;

      try {
        event = await stripe.webhooks.constructEventAsync(
          await request.text(),
          request.headers.get('stripe-signature'),
          env.STRIPE_WEBHOOK_SECRET,
          undefined,
          Stripe.createSubtleCryptoProvider()
        );
      } catch (error) {
        console.error('Webhook signature invalid:', error);
        return new Response('Invalid signature', { status: 400 });
      }

      if (
        (
          event.type === 'checkout.session.completed' ||
          event.type === 'checkout.session.async_payment_succeeded'
        ) &&
        event.data.object.payment_status === 'paid'
      ) {
        const session = event.data.object;

        console.log(
          `Don reçu [${event.id}] ${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase()} - source: ${session.metadata?.source || 'default'}`
        );
      }

      return new Response('ok');
    }

    return new Response('Not found', { status: 404 });
  }
};
