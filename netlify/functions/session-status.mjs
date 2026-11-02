import Stripe from 'stripe';

export default async (request) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe configuration missing' }, { status: 503 });
  }
  const id = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return Response.json({ error: 'Invalid session' }, { status: 400 });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
    const s = await stripe.checkout.sessions.retrieve(id);
    // On ne renvoie que le strict nécessaire (jamais l'email ni l'adresse)
    return Response.json({ status: s.status, payment_status: s.payment_status },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Session status:', error);
    return Response.json({ error: 'Unable to read session' }, { status: 500 });
  }
};

export const config = { path: '/api/session-status' };
