CREATE TABLE IF NOT EXISTS site_state (
  id INTEGER PRIMARY KEY NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS support_payments (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_url TEXT,
  checkout_query TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS support_receipts (
  charge_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  paid_at INTEGER NOT NULL,
  refunded_at INTEGER
);
