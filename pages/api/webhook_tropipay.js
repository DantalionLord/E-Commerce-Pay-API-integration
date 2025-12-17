const rawBody = require('raw-body');
const db = require('../../lib/db');

export const config = {
  api: {
    bodyParser: false,
  },
};

// NOTE: TropiPay webhook verification steps depend on TropiPay docs. This
// handler parses the raw body and attempts to update the DB based on event
// contents. You should add signature verification according to TropiPay docs.

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

  let event;
  try {
    event = JSON.parse(bodyBuf.toString());
  } catch (err) {
    console.error('Invalid JSON in webhook', err);
    res.statusCode = 400;
    res.end('Invalid JSON');
    return;
  }

  try {
    // Simple example: if event contains payment id and status
    const paymentId = event.id || event.payment_id || (event.data && event.data.id);
    const status = event.status || event.payment_status || (event.data && event.data.status);
    if (paymentId && status) {
      await db.query('UPDATE orders SET status=$1 WHERE provider_order_id=$2 AND provider=$3', [status, paymentId, 'tropipay']);
    }
  } catch (err) {
    console.error('Error handling TropiPay webhook', err);
  }

  res.statusCode = 200;
  res.end('OK');
}
