ALTER TABLE friends ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE friends ADD COLUMN export_tag TEXT DEFAULT NULL;

ALTER TABLE stores ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE stores ADD COLUMN export_tag TEXT DEFAULT NULL;

ALTER TABLE monthly_pl ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE monthly_pl ADD COLUMN export_tag TEXT DEFAULT NULL;

ALTER TABLE staff ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE staff ADD COLUMN export_tag TEXT DEFAULT NULL;

ALTER TABLE staff_monthly_sales ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE staff_monthly_sales ADD COLUMN export_tag TEXT DEFAULT NULL;

ALTER TABLE member_snapshots ADD COLUMN synced_at TEXT DEFAULT NULL;
ALTER TABLE member_snapshots ADD COLUMN export_tag TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS funnels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  template TEXT DEFAULT 'custom',
  steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT DEFAULT NULL,
  export_tag TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret_token TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_fired_at TEXT DEFAULT NULL
);
