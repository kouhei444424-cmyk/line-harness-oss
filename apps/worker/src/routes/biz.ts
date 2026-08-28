import { Hono } from 'hono';
import {
  getBizSummary,
  getStaffSales,
  getStores,
  upsertMemberSnapshot,
  upsertMonthlyPl,
  upsertStaffMonthlySales,
} from '@line-crm/db';
import { requireRole } from '../middleware/role-guard.js';
import { fireEvent } from '../services/event-bus.js';
import type { Env } from '../index.js';

const biz = new Hono<Env>();

const STORE_IDS = new Set(['ogaki', 'gifu', 'ginan']);

function isValidYearMonth(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function isValidStoreId(value: string | undefined | null): value is 'all' | 'ogaki' | 'gifu' | 'ginan' {
  return value === 'all' || (typeof value === 'string' && STORE_IDS.has(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function calcMarginPct(profit: number, sales: number): number {
  if (sales <= 0) return 0;
  return Math.round((profit / sales) * 100);
}

function calcAchievementPct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 100);
}

biz.get('/api/biz/summary', requireRole('owner'), async (c) => {
  try {
    const yearMonth = c.req.query('year_month');
    const storeId = c.req.query('store_id') ?? 'all';

    if (!isValidYearMonth(yearMonth)) {
      return c.json({ success: false, error: 'year_month must be YYYY-MM' }, 400);
    }
    if (!isValidStoreId(storeId)) {
      return c.json({ success: false, error: 'store_id must be all, ogaki, gifu, or ginan' }, 400);
    }

    const rows = await getBizSummary(c.env.DB, { yearMonth, storeId });
    const stores = rows.map((row) => {
      const costTotal = row.cost_rent + row.cost_labor + row.cost_ad + row.cost_other;
      const profit = row.sales - costTotal;
      return {
        store_id: row.store_id,
        name: row.name,
        sales: row.sales,
        cost_rent: row.cost_rent,
        cost_labor: row.cost_labor,
        cost_ad: row.cost_ad,
        cost_other: row.cost_other,
        cost_total: costTotal,
        profit,
        margin_pct: calcMarginPct(profit, row.sales),
        target: row.target,
        achievement_pct: calcAchievementPct(row.sales, row.target),
        memo: row.memo,
        members: {
          total: row.members_total,
          new: row.members_new,
          cancelled: row.members_cancelled,
        },
      };
    });

    const total = stores.reduce(
      (acc, store) => {
        acc.sales += store.sales;
        acc.cost_rent += store.cost_rent;
        acc.cost_labor += store.cost_labor;
        acc.cost_ad += store.cost_ad;
        acc.cost_other += store.cost_other;
        acc.cost_total += store.cost_total;
        acc.profit += store.profit;
        acc.target += store.target;
        acc.members.total += store.members.total;
        acc.members.new += store.members.new;
        acc.members.cancelled += store.members.cancelled;
        return acc;
      },
      {
        sales: 0,
        cost_rent: 0,
        cost_labor: 0,
        cost_ad: 0,
        cost_other: 0,
        cost_total: 0,
        profit: 0,
        target: 0,
        members: { total: 0, new: 0, cancelled: 0 },
      },
    );

    return c.json({
      success: true,
      data: {
        year_month: yearMonth,
        stores,
        total: {
          ...total,
          margin_pct: calcMarginPct(total.profit, total.sales),
          achievement_pct: calcAchievementPct(total.sales, total.target),
        },
      },
    });
  } catch (err) {
    console.error('GET /api/biz/summary error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

biz.post('/api/biz/pl', requireRole('owner'), async (c) => {
  try {
    const body = await c.req.json<{
      store_id: string;
      year_month: string;
      sales: number;
      cost_rent: number;
      cost_labor: number;
      cost_ad: number;
      cost_other: number;
      memo?: string | null;
    }>();

    if (!isValidStoreId(body.store_id) || body.store_id === 'all') {
      return c.json({ success: false, error: 'store_id must be ogaki, gifu, or ginan' }, 400);
    }
    if (!isValidYearMonth(body.year_month)) {
      return c.json({ success: false, error: 'year_month must be YYYY-MM' }, 400);
    }

    const amounts = [body.sales, body.cost_rent, body.cost_labor, body.cost_ad, body.cost_other];
    if (!amounts.every(isNonNegativeInteger)) {
      return c.json({ success: false, error: 'sales and costs must be non-negative integers' }, 400);
    }

    await upsertMonthlyPl(c.env.DB, {
      storeId: body.store_id,
      yearMonth: body.year_month,
      sales: body.sales,
      costRent: body.cost_rent,
      costLabor: body.cost_labor,
      costAd: body.cost_ad,
      costOther: body.cost_other,
      memo: body.memo ?? null,
    });

    try {
      await fireEvent(c.env.DB, 'pl.monthly.closed', {
        eventData: { store_id: body.store_id, year_month: body.year_month, sales: body.sales },
      });
    } catch (e) {
      console.error('Webhook fireEvent failed:', e);
    }

    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('POST /api/biz/pl error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

biz.get('/api/biz/staff-sales', requireRole('owner'), async (c) => {
  try {
    const yearMonth = c.req.query('year_month');
    const storeId = c.req.query('store_id') ?? 'all';

    if (!isValidYearMonth(yearMonth)) {
      return c.json({ success: false, error: 'year_month must be YYYY-MM' }, 400);
    }
    if (!isValidStoreId(storeId)) {
      return c.json({ success: false, error: 'store_id must be all, ogaki, gifu, or ginan' }, 400);
    }

    const rows = await getStaffSales(c.env.DB, { yearMonth, storeId });
    return c.json({
      success: true,
      data: {
        year_month: yearMonth,
        store_id: storeId,
        staff: rows.map((row) => ({
          id: row.id,
          store_id: row.store_id,
          store_name: row.store_name,
          name: row.name,
          role: row.role,
          sales: row.sales,
          sessions: row.sessions,
          target: row.target_monthly_sales,
          achieved: row.sales >= row.target_monthly_sales,
          achievement_pct: calcAchievementPct(row.sales, row.target_monthly_sales),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/biz/staff-sales error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

biz.post('/api/biz/staff-sales', requireRole('owner'), async (c) => {
  try {
    const body = await c.req.json<{
      staff_id: number;
      year_month: string;
      sales: number;
      sessions: number;
    }>();

    if (!isNonNegativeInteger(body.staff_id) || body.staff_id <= 0) {
      return c.json({ success: false, error: 'staff_id must be a positive integer' }, 400);
    }
    if (!isValidYearMonth(body.year_month)) {
      return c.json({ success: false, error: 'year_month must be YYYY-MM' }, 400);
    }
    if (!isNonNegativeInteger(body.sales) || !isNonNegativeInteger(body.sessions)) {
      return c.json({ success: false, error: 'sales and sessions must be non-negative integers' }, 400);
    }

    await upsertStaffMonthlySales(c.env.DB, {
      staffId: body.staff_id,
      yearMonth: body.year_month,
      sales: body.sales,
      sessions: body.sessions,
    });

    try {
      await fireEvent(c.env.DB, 'staff.sales.updated', {
        eventData: { staff_id: body.staff_id, year_month: body.year_month, sales: body.sales },
      });
    } catch (e) {
      console.error('Webhook fireEvent failed:', e);
    }

    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('POST /api/biz/staff-sales error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

biz.post('/api/biz/members', requireRole('owner'), async (c) => {
  try {
    const body = await c.req.json<{
      store_id: string;
      year_month: string;
      total: number;
      new_members: number;
      cancelled: number;
    }>();

    if (!isValidStoreId(body.store_id) || body.store_id === 'all') {
      return c.json({ success: false, error: 'store_id must be ogaki, gifu, or ginan' }, 400);
    }
    if (!isValidYearMonth(body.year_month)) {
      return c.json({ success: false, error: 'year_month must be YYYY-MM' }, 400);
    }
    if (![body.total, body.new_members, body.cancelled].every(isNonNegativeInteger)) {
      return c.json({ success: false, error: 'member counts must be non-negative integers' }, 400);
    }

    await upsertMemberSnapshot(c.env.DB, {
      storeId: body.store_id,
      yearMonth: body.year_month,
      total: body.total,
      newMembers: body.new_members,
      cancelled: body.cancelled,
    });

    try {
      await fireEvent(c.env.DB, 'member.snapshot.updated', {
        eventData: { store_id: body.store_id, year_month: body.year_month, total: body.total },
      });
    } catch (e) {
      console.error('Webhook fireEvent failed:', e);
    }

    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('POST /api/biz/members error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

biz.get('/api/biz/stores', requireRole('owner'), async (c) => {
  try {
    const stores = await getStores(c.env.DB);
    return c.json({
      success: true,
      data: stores.map((store) => ({
        id: store.id,
        name: store.name,
        targetMonthlyRevenue: store.target_monthly_revenue,
      })),
    });
  } catch (err) {
    console.error('GET /api/biz/stores error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { biz };
