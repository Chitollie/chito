export default async () => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) return Response.json({ error: 'Stripe configuration missing' }, { status: 503 });
  return Response.json({ publishableKey: key }, { headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/stripe-config' };
