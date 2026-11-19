CREATE TABLE IF NOT EXISTS site_state_parts (
  state_key TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (state_key, ordinal)
) WITHOUT ROWID;
