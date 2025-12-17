const rawBody = require('raw-body');
const fetch = require('node-fetch');
const db = require('../../lib/db');

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  let bodyBuf;
  try {
    bodyBuf = await rawBody(req);
  } catch (err) {
    console.error('raw-body error', err);
    res.statusCode = 400;
    res.end('Invalid request body');
    return;
  }

  const event = JSON.parse(bodyBuf.toString());

  try {
    const { token, base } = await getAccessToken();

    const verifyResp = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        auth_algo: req.headers['paypal-auth-algo'] || '',
        cert_url: req.headers['paypal-cert-url'] || '',
        transmission_id: req.headers['paypal-transmission-id'] || '',
        transmission_sig: req.headers['paypal-transmission-sig'] || '',
        transmission_time: req.headers['paypal-transmission-time'] || '',
        webhook_id: process.env.PAYPAL_WEBHOOK_ID || '',
        webhook_event: event,
      }),
    });

    const verifyData = await verifyResp.json();
    if (!verifyResp.ok || verifyData.verification_status !== 'SUCCESS') {
      console.warn('PayPal webhook verification failed', verifyData);
    }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource.id || (event.resource && event.resource.supplementary_data && event.resource.supplementary_data.related_ids && event.resource.supplementary_data.related_ids.order_id);
      if (orderId) {
        await db.query('UPDATE orders SET status=$1 WHERE provider_order_id=$2 AND provider=$3', ['COMPLETED', orderId, 'paypal']);
      }
    }
  } catch (err) {
    console.error('Webhook processing error', err);
  }

  res.statusCode = 200;
  res.end('OK');
}
