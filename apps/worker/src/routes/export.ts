import { Hono } from 'hono';
import { getExportData, markExported } from '@line-crm/db';
import { requireRole } from '../middleware/role-guard.js';
import type { Env } from '../index.js';

const exportRoutes = new Hono<Env>();

const RESOURCES = new Set(['pl', 'staff-sales', 'members', 'contacts', 'funnels']);
const STORES = new Set(['all', 'ogaki', 'gifu', 'ginan']);

function isValidYearMonth(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function isValidResource(value: string): value is 'pl' | 'staff-sales' | 'members' | 'contacts' | 'funnels' {
  return RESOURCES.has(value);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ];
  return lines.join('\n');
}

exportRoutes.get('/api/export/:resource', requireRole('owner'), async (c) => {
  try {
    const rawResource = c.req.param('resource');
    const format = c.req.query('format') ?? 'json';
    const from = c.req.query('from');
    const to = c.req.query('to');
    const storeId = c.req.query('store_id') ?? 'all';

    if (!rawResource || !isValidResource(rawResource)) {
      return c.json({ success: false, error: 'resource must be pl, staff-sales, members, contacts, or funnels' }, 400);
    }
    const resource = rawResource;
    if (format !== 'json' && format !== 'csv') {
      return c.json({ success: false, error: 'format must be json or csv' }, 400);
    }
    if (!isValidYearMonth(from) || !isValidYearMonth(to)) {
      return c.json({ success: false, error: 'from and to must be YYYY-MM' }, 400);
    }
    if (!STORES.has(storeId)) {
      return c.json({ success: false, error: 'store_id must be all, ogaki, gifu, or ginan' }, 400);
    }

    const data = await getExportData(c.env.DB, { resource, from, to, storeId });
    await markExported(c.env.DB, { resource, from, to, storeId });

    const exportedAt = new Date().toISOString();
    const filename = `ageru_${resource}_${from}_${to}.${format}`;

    c.header('X-Export-Count', String(data.length));
    c.header('X-Exported-At', exportedAt);
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'csv') {
      c.header('Content-Type', 'text/csv; charset=utf-8');
      return c.body(toCsv(data));
    }

    c.header('Content-Type', 'application/json; charset=utf-8');
    return c.json({
      resource,
      exported_at: exportedAt,
      from,
      to,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('GET /api/export/:resource error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { exportRoutes };
