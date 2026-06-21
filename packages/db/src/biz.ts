export interface StoreRow {
  id: string;
  name: string;
  target_monthly_revenue: number;
  created_at: string;
}

export interface MonthlyPlRow {
  id: number;
  store_id: string;
  year_month: string;
  sales: number;
  cost_rent: number;
  cost_labor: number;
  cost_ad: number;
  cost_other: number;
  memo: string | null;
  updated_at: string;
}

export interface StaffBizRow {
  id: number;
  store_id: string;
  name: string;
  role: 'trainer' | 'manager';
  target_monthly_sales: number;
  is_active: number;
  created_at: string;
}

export interface StaffMonthlySalesRow {
  id: number;
  staff_id: number;
  year_month: string;
  sales: number;
  sessions: number;
  updated_at: string;
}

export interface MemberSnapshotRow {
  id: number;
  store_id: string;
  year_month: string;
  total: number;
  new_members: number;
  cancelled: number;
  updated_at: string;
}

export interface SummaryStoreRow {
  store_id: string;
  name: string;
  target: number;
  sales: number;
  cost_rent: number;
  cost_labor: number;
  cost_ad: number;
  cost_other: number;
  memo: string | null;
  members_total: number;
  members_new: number;
  members_cancelled: number;
}

export async function getStores(db: D1Database): Promise<StoreRow[]> {
  const result = await db
    .prepare('SELECT * FROM stores ORDER BY created_at ASC, name ASC')
    .all<StoreRow>();
  return result.results;
}

export async function getBizSummary(
  db: D1Database,
  params: { yearMonth: string; storeId?: string | null },
): Promise<SummaryStoreRow[]> {
  const statements = [
    `SELECT`,
    `  s.id AS store_id,`,
    `  s.name AS name,`,
    `  s.target_monthly_revenue AS target,`,
    `  COALESCE(pl.sales, 0) AS sales,`,
    `  COALESCE(pl.cost_rent, 0) AS cost_rent,`,
    `  COALESCE(pl.cost_labor, 0) AS cost_labor,`,
    `  COALESCE(pl.cost_ad, 0) AS cost_ad,`,
    `  COALESCE(pl.cost_other, 0) AS cost_other,`,
    `  pl.memo AS memo,`,
    `  COALESCE(ms.total, 0) AS members_total,`,
    `  COALESCE(ms.new_members, 0) AS members_new,`,
    `  COALESCE(ms.cancelled, 0) AS members_cancelled`,
    `FROM stores s`,
    `LEFT JOIN monthly_pl pl`,
    `  ON pl.store_id = s.id AND pl.year_month = ?`,
    `LEFT JOIN member_snapshots ms`,
    `  ON ms.store_id = s.id AND ms.year_month = ?`,
  ];

  const bindings: unknown[] = [params.yearMonth, params.yearMonth];

  if (params.storeId && params.storeId !== 'all') {
    statements.push('WHERE s.id = ?');
    bindings.push(params.storeId);
  }

  statements.push('ORDER BY s.created_at ASC, s.name ASC');

  const result = await db
    .prepare(statements.join('\n'))
    .bind(...bindings)
    .all<SummaryStoreRow>();

  return result.results;
}

export async function upsertMonthlyPl(
  db: D1Database,
  input: {
    storeId: string;
    yearMonth: string;
    sales: number;
    costRent: number;
    costLabor: number;
    costAd: number;
    costOther: number;
    memo?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO monthly_pl (
        store_id, year_month, sales, cost_rent, cost_labor, cost_ad, cost_other, memo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(store_id, year_month) DO UPDATE SET
        sales = excluded.sales,
        cost_rent = excluded.cost_rent,
        cost_labor = excluded.cost_labor,
        cost_ad = excluded.cost_ad,
        cost_other = excluded.cost_other,
        memo = excluded.memo,
        updated_at = datetime('now')`,
    )
    .bind(
      input.storeId,
      input.yearMonth,
      input.sales,
      input.costRent,
      input.costLabor,
      input.costAd,
      input.costOther,
      input.memo ?? null,
    )
    .run();
}

export interface StaffSalesListRow {
  id: number;
  store_id: string;
  store_name: string;
  name: string;
  role: 'trainer' | 'manager';
  target_monthly_sales: number;
  sales: number;
  sessions: number;
}

export async function getStaffSales(
  db: D1Database,
  params: { yearMonth: string; storeId?: string | null },
): Promise<StaffSalesListRow[]> {
  const statements = [
    `SELECT`,
    `  st.id AS id,`,
    `  st.store_id AS store_id,`,
    `  stores.name AS store_name,`,
    `  st.name AS name,`,
    `  st.role AS role,`,
    `  st.target_monthly_sales AS target_monthly_sales,`,
    `  COALESCE(sms.sales, 0) AS sales,`,
    `  COALESCE(sms.sessions, 0) AS sessions`,
    `FROM staff st`,
    `INNER JOIN stores ON stores.id = st.store_id`,
    `LEFT JOIN staff_monthly_sales sms`,
    `  ON sms.staff_id = st.id AND sms.year_month = ?`,
    `WHERE st.is_active = 1`,
  ];

  const bindings: unknown[] = [params.yearMonth];

  if (params.storeId && params.storeId !== 'all') {
    statements.push('AND st.store_id = ?');
    bindings.push(params.storeId);
  }

  statements.push('ORDER BY stores.created_at ASC, st.store_id ASC, st.role DESC, st.name ASC');

  const result = await db
    .prepare(statements.join('\n'))
    .bind(...bindings)
    .all<StaffSalesListRow>();

  return result.results;
}

export async function upsertStaffMonthlySales(
  db: D1Database,
  input: {
    staffId: number;
    yearMonth: string;
    sales: number;
    sessions: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO staff_monthly_sales (
        staff_id, year_month, sales, sessions, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(staff_id, year_month) DO UPDATE SET
        sales = excluded.sales,
        sessions = excluded.sessions,
        updated_at = datetime('now')`,
    )
    .bind(input.staffId, input.yearMonth, input.sales, input.sessions)
    .run();
}

export async function upsertMemberSnapshot(
  db: D1Database,
  input: {
    storeId: string;
    yearMonth: string;
    total: number;
    newMembers: number;
    cancelled: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO member_snapshots (
        store_id, year_month, total, new_members, cancelled, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(store_id, year_month) DO UPDATE SET
        total = excluded.total,
        new_members = excluded.new_members,
        cancelled = excluded.cancelled,
        updated_at = datetime('now')`,
    )
    .bind(input.storeId, input.yearMonth, input.total, input.newMembers, input.cancelled)
    .run();
}
