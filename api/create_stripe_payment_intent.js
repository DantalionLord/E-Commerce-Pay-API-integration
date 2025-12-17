const Stripe = require('stripe');
const { json } = require('micro');
const db = require('../lib/db');

// Vercel serverless style: export default function(req, res)
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const body = await json(req);
    const { amount, currency = 'USD', metadata = {} } = body;

    if (!process.env.STRIPE_SECRET_KEY) {
      res.statusCode = 500;
      res.end('Stripe secret key not configured');
      return;
    }

    if (!amount || amount <= 0) {
      res.statusCode = 400;
      res.end('Invalid amount');
      return;
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      metadata,
    });

    // Save to DB (orders table)
    try {
      await db.query(
        'INSERT INTO orders (provider, provider_order_id, amount, currency, status, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
        ['stripe', paymentIntent.id, paymentIntent.amount, paymentIntent.currency, paymentIntent.status, JSON.stringify(metadata)]
      );
    } catch (dbErr) {
      // Log but don't fail the whole request
      console.error('DB insert error:', dbErr);
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
