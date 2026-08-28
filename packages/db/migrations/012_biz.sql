CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_monthly_revenue INTEGER NOT NULL DEFAULT 2100000,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monthly_pl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL REFERENCES stores(id),
  year_month TEXT NOT NULL,
  sales INTEGER NOT NULL DEFAULT 0,
  cost_rent INTEGER NOT NULL DEFAULT 0,
  cost_labor INTEGER NOT NULL DEFAULT 0,
  cost_ad INTEGER NOT NULL DEFAULT 0,
  cost_other INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(store_id, year_month)
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  role TEXT DEFAULT 'trainer',
  target_monthly_sales INTEGER DEFAULT 700000,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_monthly_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  year_month TEXT NOT NULL,
  sales INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(staff_id, year_month)
);

CREATE TABLE IF NOT EXISTS member_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL REFERENCES stores(id),
  year_month TEXT NOT NULL,
  total INTEGER DEFAULT 0,
  new_members INTEGER DEFAULT 0,
  cancelled INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(store_id, year_month)
);

INSERT OR IGNORE INTO stores (id, name, target_monthly_revenue, created_at) VALUES ('ogaki', '大垣店', 2100000, datetime('now'));
INSERT OR IGNORE INTO stores (id, name, target_monthly_revenue, created_at) VALUES ('gifu', '岐阜店', 2100000, datetime('now'));
INSERT OR IGNORE INTO stores (id, name, target_monthly_revenue, created_at) VALUES ('ginan', '岐南店', 2100000, datetime('now'));
