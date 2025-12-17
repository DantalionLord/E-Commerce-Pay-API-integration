const fetch = require('node-fetch');
const db = require('../../lib/db');

// NOTE: Confirm TropiPay API endpoints and authentication method. This handler
// implements a generic POST to the configured `TROPIPAY_BASE_URL` and expects
// an API key in `TROPIPAY_API_KEY`.

async function createTropipayPayment(baseUrl, apiKey, body, idemKey) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (idemKey) headers['Idempotency-Key'] = idemKey;

  // Default endpoint - may need adjustment to TropiPay actual endpoint
  const url = `${baseUrl.replace(/\/$/, '')}/payments`;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(`TropiPay create failed: ${JSON.stringify(data)}`);
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const { amount, currency = 'USD', metadata = {}, idempotency_key } = req.body || {};
    const idemKey = idempotency_key || req.headers['idempotency-key'] || null;

    if (!amount || amount <= 0) {
      res.statusCode = 400;
      res.end('Invalid amount');
      return;
    }

    const base = process.env.TROPIPAY_BASE_URL || process.env.TROPIPAY_API_BASE || 'https://api.tropipay.com';
    const apiKey = process.env.TROPIPAY_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.end('TropiPay API key not configured');
      return;
    }

    // If idempotency key provided, check DB for existing order
    if (idemKey) {
      try {
        const { rows } = await db.query('SELECT * FROM orders WHERE provider=$1 AND idempotency_key=$2 LIMIT 1', ['tropipay', idemKey]);
        if (rows && rows.length > 0) {
          const existing = rows[0];
          let existingMeta = existing.metadata;
          try {
            existingMeta = JSON.parse(existingMeta);
          } catch (e) {
            // leave as-is if not JSON
          }
          res.setHeader('Content-Type', 'application/json');
          res.status(200).json({ paymentID: existing.provider_order_id, data: existingMeta });
          return;
        }
      } catch (dbErr) {
        console.error('DB select error:', dbErr);
      }
    }

    // Build TropiPay request body -- this is a generic shape and may need adapting
    const tpBody = {
      amount: (amount / 100).toFixed(2),
      currency,
      metadata,
      // additional fields might be required by TropiPay e.g. return_url, customer info, etc.
    };

    const tpResp = await createTropipayPayment(base, apiKey, tpBody, idemKey);

    // Attempt to get an ID and/or approval link from response
    const providerId = tpResp.id || tpResp.payment_id || tpResp.paymentId || null;
    const approveUrl = tpResp.approval_url || tpResp.approve_url || tpResp.redirect_url || null;

    try {
      await db.query(
        'INSERT INTO orders (provider, provider_order_id, amount, currency, status, metadata, idempotency_key, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
        ['tropipay', providerId || JSON.stringify(tpResp), amount, currency, tpResp.status || 'created', JSON.stringify(tpResp), idemKey]
      );
    } catch (dbErr) {
      console.error('DB insert error:', dbErr);
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ paymentID: providerId, approveUrl, raw: tpResp });
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
