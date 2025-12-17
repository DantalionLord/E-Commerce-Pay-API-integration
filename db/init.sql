-- Simple orders table to track payments
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  provider_order_id VARCHAR(128) NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(8) NOT NULL,
  status VARCHAR(64) DEFAULT 'created',
  metadata JSONB,
  idempotency_key VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique index to enforce idempotency per provider when a key is provided
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_idempotency_idx ON orders(provider, idempotency_key) WHERE idempotency_key IS NOT NULL;
