CREATE TABLE IF NOT EXISTS telegram_web_logins (
 id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, code TEXT NOT NULL,
 expires INTEGER NOT NULL, actor TEXT, profile TEXT, status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS telegram_web_logins_expiry ON telegram_web_logins(expires);
