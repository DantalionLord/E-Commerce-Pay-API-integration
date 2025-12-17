const fetch = require('node-fetch');
const { json } = require('micro');
const db = require('../lib/db');

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const base = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  const resp = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error('Failed to get PayPal access token: ' + JSON.stringify(data));
  return { token: data.access_token, base };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const body = await json(req);
    const { amount, currency = 'USD', return_url, cancel_url, metadata = {} } = body;
    if (!amount || amount <= 0) {
      res.statusCode = 400;
      res.end('Invalid amount');
      return;
    }

    const { token, base } = await getAccessToken();

    const orderResp = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: currency, value: (amount / 100).toFixed(2) },
            custom_id: JSON.stringify(metadata),
          },
        ],
        application_context: {
          return_url: return_url || process.env.PAYPAL_RETURN_URL || 'https://example.com/success',
          cancel_url: cancel_url || process.env.PAYPAL_CANCEL_URL || 'https://example.com/cancel',
        },
      }),
    });

    const orderData = await orderResp.json();
    if (!orderResp.ok) {
      console.error('PayPal order error', orderData);
      res.statusCode = 500;
      res.end('PayPal order creation failed');
      return;
    }

    // Save to DB
    try {
      await db.query(
        'INSERT INTO orders (provider, provider_order_id, amount, currency, status, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
        ['paypal', orderData.id, amount, currency, orderData.status, JSON.stringify(metadata)]
      );
    } catch (dbErr) {
      console.error('DB insert error:', dbErr);
    }

    // Find approval link
    const approveLink = (orderData.links || []).find((l) => l.rel === 'approve');

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ orderID: orderData.id, approveUrl: approveLink ? approveLink.href : null }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
