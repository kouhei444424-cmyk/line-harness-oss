export type ExportResource = 'pl' | 'staff-sales' | 'members' | 'contacts' | 'funnels';

export interface ExportQuery {
  resource: ExportResource;
  from: string;
  to: string;
  storeId?: string | null;
}

export async function getExportData(
  db: D1Database,
  query: ExportQuery,
): Promise<Record<string, unknown>[]> {
  switch (query.resource) {
    case 'pl':
      return getPlExportRows(db, query);
    case 'staff-sales':
      return getStaffSalesExportRows(db, query);
    case 'members':
      return getMemberExportRows(db, query);
    case 'contacts':
      return getContactsExportRows(db);
    case 'funnels':
      return getFunnelsExportRows(db, query);
  }
}

export async function markExported(
  db: D1Database,
  query: ExportQuery,
): Promise<void> {
  switch (query.resource) {
    case 'pl':
      await updateMonthlyPlSyncedAt(db, query);
      return;
    case 'staff-sales':
      await updateStaffSalesSyncedAt(db, query);
      return;
    case 'members':
      await updateMemberSnapshotsSyncedAt(db, query);
      return;
    case 'contacts':
      await db.prepare(`UPDATE friends SET synced_at = datetime('now')`).run();
      return;
    case 'funnels':
      await updateFunnelsSyncedAt(db, query);
      return;
  }
}

async function getPlExportRows(
  db: D1Database,
  query: ExportQuery,
): Promise<Record<string, unknown>[]> {
  const statements = [
    `SELECT`,
    `  store_id,`,
    `  year_month,`,
    `  sales,`,
    `  cost_rent,`,
    `  cost_labor,`,
    `  cost_ad,`,
    `  cost_other,`,
    `  sales - (cost_rent + cost_labor + cost_ad + cost_other) AS profit,`,
    `  memo,`,
    `  synced_at,`,
    `  export_tag`,
    `FROM monthly_pl`,
    `WHERE year_month >= ? AND year_month <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  statements.push(`ORDER BY year_month ASC, store_id ASC`);
  const result = await db.prepare(statements.join('\n')).bind(...bindings).all<Record<string, unknown>>();
  return result.results;
}

async function getStaffSalesExportRows(
  db: D1Database,
  query: ExportQuery,
): Promise<Record<string, unknown>[]> {
  const statements = [
    `SELECT`,
    `  sms.staff_id,`,
    `  st.store_id,`,
    `  st.name AS staff_name,`,
    `  st.role,`,
    `  sms.year_month,`,
    `  sms.sales,`,
    `  sms.sessions,`,
    `  st.target_monthly_sales,`,
    `  sms.synced_at,`,
    `  sms.export_tag`,
    `FROM staff_monthly_sales sms`,
    `INNER JOIN staff st ON st.id = sms.staff_id`,
    `WHERE sms.year_month >= ? AND sms.year_month <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND st.store_id = ?`);
    bindings.push(query.storeId);
  }
  statements.push(`ORDER BY sms.year_month ASC, st.store_id ASC, st.name ASC`);
  const result = await db.prepare(statements.join('\n')).bind(...bindings).all<Record<string, unknown>>();
  return result.results;
}

async function getMemberExportRows(
  db: D1Database,
  query: ExportQuery,
): Promise<Record<string, unknown>[]> {
  const statements = [
    `SELECT`,
    `  store_id,`,
    `  year_month,`,
    `  total,`,
    `  new_members,`,
    `  cancelled,`,
    `  synced_at,`,
    `  export_tag`,
    `FROM member_snapshots`,
    `WHERE year_month >= ? AND year_month <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  statements.push(`ORDER BY year_month ASC, store_id ASC`);
  const result = await db.prepare(statements.join('\n')).bind(...bindings).all<Record<string, unknown>>();
  return result.results;
}

async function getContactsExportRows(db: D1Database): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT
        f.id,
        f.line_user_id,
        f.display_name,
        f.picture_url,
        f.status_message,
        f.is_following,
        f.user_id,
        f.score,
        f.created_at,
        f.updated_at,
        f.synced_at,
        f.export_tag,
        COALESCE((
          SELECT json_group_array(t.name)
          FROM friend_tags ft
          INNER JOIN tags t ON t.id = ft.tag_id
          WHERE ft.friend_id = f.id
        ), '[]') AS tags_json
      FROM friends f
      ORDER BY f.created_at DESC`,
    )
    .all<Record<string, unknown>>();
  return result.results.map((row) => ({
    ...row,
    tags: JSON.parse(String(row.tags_json ?? '[]')),
  }));
}

async function getFunnelsExportRows(
  db: D1Database,
  query: ExportQuery,
): Promise<Record<string, unknown>[]> {
  const statements = [
    `SELECT`,
    `  id,`,
    `  store_id,`,
    `  name,`,
    `  template,`,
    `  steps_json,`,
    `  created_at,`,
    `  updated_at,`,
    `  synced_at,`,
    `  export_tag`,
    `FROM funnels`,
    `WHERE substr(created_at, 1, 7) >= ? AND substr(created_at, 1, 7) <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  statements.push(`ORDER BY created_at DESC`);
  const result = await db.prepare(statements.join('\n')).bind(...bindings).all<Record<string, unknown>>();
  return result.results;
}

async function updateMonthlyPlSyncedAt(db: D1Database, query: ExportQuery): Promise<void> {
  const statements = [`UPDATE monthly_pl SET synced_at = datetime('now') WHERE year_month >= ? AND year_month <= ?`];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  await db.prepare(statements.join(' ')).bind(...bindings).run();
}

async function updateStaffSalesSyncedAt(db: D1Database, query: ExportQuery): Promise<void> {
  const statements = [
    `UPDATE staff_monthly_sales`,
    `SET synced_at = datetime('now')`,
    `WHERE year_month >= ? AND year_month <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND staff_id IN (SELECT id FROM staff WHERE store_id = ?)`);
    bindings.push(query.storeId);
  }
  await db.prepare(statements.join(' ')).bind(...bindings).run();
}

async function updateMemberSnapshotsSyncedAt(db: D1Database, query: ExportQuery): Promise<void> {
  const statements = [`UPDATE member_snapshots SET synced_at = datetime('now') WHERE year_month >= ? AND year_month <= ?`];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  await db.prepare(statements.join(' ')).bind(...bindings).run();
}

async function updateFunnelsSyncedAt(db: D1Database, query: ExportQuery): Promise<void> {
  const statements = [
    `UPDATE funnels`,
    `SET synced_at = datetime('now')`,
    `WHERE substr(created_at, 1, 7) >= ? AND substr(created_at, 1, 7) <= ?`,
  ];
  const bindings: unknown[] = [query.from, query.to];
  if (query.storeId && query.storeId !== 'all') {
    statements.push(`AND store_id = ?`);
    bindings.push(query.storeId);
  }
  await db.prepare(statements.join(' ')).bind(...bindings).run();
}
