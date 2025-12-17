const fetch = require('node-fetch');
const db = require('../../lib/db');

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const { amount, currency = 'USD', return_url, cancel_url, metadata = {}, idempotency_key } = req.body || {};
    const idemKey = idempotency_key || req.headers['idempotency-key'] || req.headers['paypal-request-id'] || null;
    if (!amount || amount <= 0) {
      res.statusCode = 400;
      res.end('Invalid amount');
      return;
    }

    const { token, base } = await getAccessToken();

    // If idempotency key provided, check DB for existing order
    if (idemKey) {
      try {
        const { rows } = await db.query('SELECT * FROM orders WHERE provider=$1 AND idempotency_key=$2 LIMIT 1', ['paypal', idemKey]);
        if (rows && rows.length > 0) {
          const existing = rows[0];
          try {
            const getResp = await fetch(`${base}/v2/checkout/orders/${existing.provider_order_id}`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });
            const orderInfo = await getResp.json();
            const approveLink = (orderInfo.links || []).find((l) => l.rel === 'approve');
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json({ orderID: existing.provider_order_id, approveUrl: approveLink ? approveLink.href : null });
            return;
          } catch (err) {
            console.warn('Failed to retrieve existing PayPal order, creating new one', err);
          }
        }
      } catch (dbErr) {
        console.error('DB select error:', dbErr);
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (idemKey) headers['PayPal-Request-Id'] = idemKey;

    const orderResp = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers,
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

    try {
      await db.query(
        'INSERT INTO orders (provider, provider_order_id, amount, currency, status, metadata, idempotency_key, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
        ['paypal', orderData.id, amount, currency, orderData.status, JSON.stringify(metadata), idemKey]
      );
    } catch (dbErr) {
      console.error('DB insert error:', dbErr);
    }

    const approveLink = (orderData.links || []).find((l) => l.rel === 'approve');

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ orderID: orderData.id, approveUrl: approveLink ? approveLink.href : null });
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
