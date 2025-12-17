const fetch = require('node-fetch');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
  const DATABASE_URL = process.env.DATABASE_URL;
  const DB_SSL = process.env.DB_SSL === 'true';
  const providerArg = (process.argv[2] || process.env.PROVIDER || 'stripe').toLowerCase();

  const providerMap = {
    stripe: { path: '/api/create_stripe_payment_intent', provider: 'stripe' },
    paypal: { path: '/api/create_paypal_order', provider: 'paypal' },
    tropipay: { path: '/api/create_tropipay_payment', provider: 'tropipay' },
  };

  if (!providerMap[providerArg]) {
    console.error('Unknown provider. Use "stripe", "paypal" or "tropipay".');
    return 2;
  }

  const endpoint = providerMap[providerArg].path;
  const provider = providerMap[providerArg].provider;

  if (!DATABASE_URL) {
    console.error('Please set DATABASE_URL in the environment');
    return 2;
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  });

  const idemKey = uuidv4();
  console.log('Using idempotency key:', idemKey);

  let exitCode = 0;
  try {
    // First request
    console.log(`Sending first request to ${endpoint}...`);
    const r1 = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ amount: 5000, currency: 'USD' }),
    });
    const j1 = await r1.text();
    console.log('First response status:', r1.status);
    console.log('First response body:', j1);

    // Second (retry) request
    console.log('Sending second request (retry)...');
    const r2 = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ amount: 5000, currency: 'USD' }),
    });
    const j2 = await r2.text();
    console.log('Second response status:', r2.status);
    console.log('Second response body:', j2);

    // Query DB to verify only one order created
    const res = await pool.query('SELECT COUNT(*)::int as cnt FROM orders WHERE provider=$1 AND idempotency_key=$2', [provider, idemKey]);
    const count = res.rows && res.rows[0] ? res.rows[0].cnt : 0;
    console.log(`Orders found in DB for provider='${provider}' and idempotency_key='${idemKey}':`, count);

    if (count === 1) {
      console.log('Idempotency validated: only one order created.');
      exitCode = 0;
    } else {
      console.error('Idempotency validation failed: expected 1 order but found', count);
      exitCode = 3;
    }
  } catch (err) {
    console.error('Error during idempotency test:', err);
    exitCode = 4;
  } finally {
    try {
      await pool.end();
    } catch (e) {
      console.error('Error closing DB pool', e);
    }
    return exitCode;
  }
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('Fatal error in idempotency test', err);
  process.exit(4);
});
