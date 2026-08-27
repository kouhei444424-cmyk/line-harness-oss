import { Hono } from 'hono';
import {
  getFriends,
  getFriendById,
  getFriendCount,
  addTagToFriend,
  removeTagFromFriend,
  getFriendTags,
  getScenarios,
  enrollFriendInScenario,
  jstNow,
} from '@line-crm/db';
import type { Friend as DbFriend, Tag as DbTag } from '@line-crm/db';
import { fireEvent } from '../services/event-bus.js';
import { buildMessage } from '../services/step-delivery.js';
import type { Env } from '../index.js';

const friends = new Hono<Env>();

/** Convert a D1 snake_case Friend row to the shared camelCase shape */
function serializeFriend(row: DbFriend) {
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    statusMessage: row.status_message,
    isFollowing: Boolean(row.is_following),
    metadata: JSON.parse(row.metadata || '{}'),
    refCode: (row as unknown as Record<string, unknown>).ref_code as string | null,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Convert a D1 snake_case Tag row to the shared camelCase shape */
function serializeTag(row: DbTag) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

type BatchTagRow = DbTag & { friend_id: string };
type ActivityRow = {
  friendId: string;
  lastIncomingAt: string | null;
  lastOutgoingAt: string | null;
  incomingCount: number;
  outgoingCount: number;
};

function activityFromRow(row: ActivityRow | undefined) {
  return {
    lastIncomingAt: row?.lastIncomingAt ?? null,
    lastOutgoingAt: row?.lastOutgoingAt ?? null,
    incomingCount: row?.incomingCount ?? 0,
    outgoingCount: row?.outgoingCount ?? 0,
  };
}

// GET /api/friends - list with pagination
friends.get('/api/friends', async (c) => {
  try {
    const limit = Number(c.req.query('limit') ?? '50');
    const offset = Number(c.req.query('offset') ?? '0');
    const tagId = c.req.query('tagId');
    const lineAccountId = c.req.query('lineAccountId');

    const db = c.env.DB;

    // Build WHERE conditions
    const conditions: string[] = [];
    const binds: unknown[] = [];
    if (tagId) {
      conditions.push('EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)');
      binds.push(tagId);
    }
    if (lineAccountId) {
      conditions.push('f.line_account_id = ?');
      binds.push(lineAccountId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM friends f ${where}`);
    const totalRow = await (binds.length > 0 ? countStmt.bind(...binds) : countStmt).first<{ count: number }>();
    const total = totalRow?.count ?? 0;

    const listStmt = db.prepare(
      `SELECT f.* FROM friends f ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    );
    const listBinds = [...binds, limit, offset];
    const listResult = await listStmt.bind(...listBinds).all<DbFriend>();
    const items = listResult.results;

    // Fetch tags for each friend in parallel so the list response includes tags
    const itemsWithTags = await Promise.all(
      items.map(async (friend) => {
        const tags = await getFriendTags(db, friend.id);
        return { ...serializeFriend(friend), tags: tags.map(serializeTag) };
      }),
    );

    return c.json({
      success: true,
      data: {
        items: itemsWithTags,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasNextPage: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('GET /api/friends error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/friends/count - friend count (must be before /:id)
friends.get('/api/friends/count', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId');
    let count: number;
    if (lineAccountId) {
      const row = await c.env.DB.prepare('SELECT COUNT(*) as count FROM friends WHERE is_following = 1 AND line_account_id = ?')
        .bind(lineAccountId).first<{ count: number }>();
      count = row?.count ?? 0;
    } else {
      count = await getFriendCount(c.env.DB);
    }
    return c.json({ success: true, data: { count } });
  } catch (err) {
    console.error('GET /api/friends/count error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/friends/ref-stats - ref code attribution stats
friends.get('/api/friends/ref-stats', async (c) => {
  try {
    const lineAccountId = c.req.query('lineAccountId');
    const where = lineAccountId ? 'WHERE line_account_id = ?' : 'WHERE ref_code IS NOT NULL';
    const binds = lineAccountId ? [lineAccountId] : [];
    const stmt = c.env.DB.prepare(
      `SELECT ref_code, COUNT(*) as count FROM friends ${where} AND ref_code IS NOT NULL GROUP BY ref_code ORDER BY count DESC`,
    );
    const result = await (binds.length > 0 ? stmt.bind(...binds) : stmt).all<{ ref_code: string; count: number }>();
    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM friends ${lineAccountId ? 'WHERE line_account_id = ?' : ''} ${lineAccountId ? 'AND' : 'WHERE'} ref_code IS NOT NULL`,
    ).bind(...(lineAccountId ? [lineAccountId] : [])).first<{ count: number }>();
    return c.json({
      success: true,
      data: {
        routes: result.results.map((r) => ({ refCode: r.ref_code, friendCount: r.count })),
        totalWithRef: total?.count ?? 0,
      },
    });
  } catch (err) {
    console.error('GET /api/friends/ref-stats error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/friends/batch-activity - friend metadata, tags and activity without message content
friends.post('/api/friends/batch-activity', async (c) => {
  let body: { friendIds?: unknown };
  try {
    body = await c.req.json<{ friendIds?: unknown }>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  if (!Array.isArray(body.friendIds)) {
    return c.json({ success: false, error: 'friendIds must be an array' }, 400);
  }

  if (body.friendIds.some((value) => typeof value !== 'string')) {
    return c.json({ success: false, error: 'friendIds must contain only strings' }, 400);
  }
  const normalizedIds = (body.friendIds as string[]).map((value) => value.trim());
  const friendIds = [...new Set(normalizedIds)];
  if (
    friendIds.length !== normalizedIds.length ||
    friendIds.some((id) => id.length === 0 || id.length > 128) ||
    friendIds.length > 100
  ) {
    return c.json({ success: false, error: 'friendIds must contain up to 100 unique valid ids' }, 400);
  }
  if (friendIds.length === 0) {
    return c.json({ success: true, data: { items: [] } });
  }

  try {
    const placeholders = friendIds.map(() => '?').join(', ');
    const db = c.env.DB;
    const [friendRows, tagRows, activityRows] = await Promise.all([
      db
        .prepare(`SELECT * FROM friends WHERE id IN (${placeholders})`)
        .bind(...friendIds)
        .all<DbFriend>(),
      db
        .prepare(
          `SELECT ft.friend_id, t.*
           FROM friend_tags ft
           INNER JOIN tags t ON t.id = ft.tag_id
           WHERE ft.friend_id IN (${placeholders})
           ORDER BY t.name ASC`,
        )
        .bind(...friendIds)
        .all<BatchTagRow>(),
      db
        .prepare(
          `SELECT friend_id as friendId,
                  MAX(CASE WHEN direction = 'incoming' THEN created_at END) as lastIncomingAt,
                  MAX(CASE WHEN direction = 'outgoing' THEN created_at END) as lastOutgoingAt,
                  SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incomingCount,
                  SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoingCount
           FROM messages_log
           WHERE friend_id IN (${placeholders})
           GROUP BY friend_id`,
        )
        .bind(...friendIds)
        .all<ActivityRow>(),
    ]);

    const friendsById = new Map(friendRows.results.map((row) => [row.id, row]));
    const tagsByFriendId = new Map<string, DbTag[]>();
    for (const row of tagRows.results) {
      const tags = tagsByFriendId.get(row.friend_id) ?? [];
      tags.push(row);
      tagsByFriendId.set(row.friend_id, tags);
    }
    const activityByFriendId = new Map(
      activityRows.results.map((row) => [row.friendId, row]),
    );

    return c.json({
      success: true,
      data: {
        items: friendIds.map((friendId) => {
          const friend = friendsById.get(friendId);
          return {
            friendId,
            friend: friend
              ? {
                  ...serializeFriend(friend),
                  tags: (tagsByFriendId.get(friendId) ?? []).map(serializeTag),
                }
              : null,
            activity: friend
              ? activityFromRow(activityByFriendId.get(friendId))
              : null,
          };
        }),
      },
    });
  } catch (err) {
    console.error('POST /api/friends/batch-activity error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/friends/:id - get single friend with tags
friends.get('/api/friends/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;

    const [friend, tags] = await Promise.all([
      getFriendById(db, id),
      getFriendTags(db, id),
    ]);

    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...serializeFriend(friend),
        tags: tags.map(serializeTag),
      },
    });
  } catch (err) {
    console.error('GET /api/friends/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/friends/:id/tags - add tag
friends.post('/api/friends/:id/tags', async (c) => {
  try {
    const friendId = c.req.param('id');
    const body = await c.req.json<{ tagId: string }>();

    if (!body.tagId) {
      return c.json({ success: false, error: 'tagId is required' }, 400);
    }

    const db = c.env.DB;
    await addTagToFriend(db, friendId, body.tagId);

    // Enroll in tag_added scenarios that match this tag
    const allScenarios = await getScenarios(db);
    for (const scenario of allScenarios) {
      if (scenario.trigger_type === 'tag_added' && scenario.is_active && scenario.trigger_tag_id === body.tagId) {
        const existing = await db
          .prepare(`SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?`)
          .bind(friendId, scenario.id)
          .first();
        if (!existing) {
          await enrollFriendInScenario(db, friendId, scenario.id);
        }
      }
    }

    // イベントバス発火: tag_change
    await fireEvent(db, 'tag_change', { friendId, eventData: { tagId: body.tagId, action: 'add' } });

    return c.json({ success: true, data: null }, 201);
  } catch (err) {
    console.error('POST /api/friends/:id/tags error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/friends/:id/tags/:tagId - remove tag
friends.delete('/api/friends/:id/tags/:tagId', async (c) => {
  try {
    const friendId = c.req.param('id');
    const tagId = c.req.param('tagId');

    await removeTagFromFriend(c.env.DB, friendId, tagId);

    // イベントバス発火: tag_change
    await fireEvent(c.env.DB, 'tag_change', { friendId, eventData: { tagId, action: 'remove' } });

    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/friends/:id/tags/:tagId error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/friends/:id/metadata - merge metadata fields
friends.put('/api/friends/:id/metadata', async (c) => {
  try {
    const friendId = c.req.param('id');
    const db = c.env.DB;

    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    const body = await c.req.json<Record<string, unknown>>();
    const existing = JSON.parse(friend.metadata || '{}');
    const merged = { ...existing, ...body };
    const now = jstNow();

    await db
      .prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(merged), now, friendId)
      .run();

    const updated = await getFriendById(db, friendId);
    const tags = await getFriendTags(db, friendId);

    return c.json({
      success: true,
      data: {
        ...serializeFriend(updated!),
        tags: tags.map(serializeTag),
      },
    });
  } catch (err) {
    console.error('PUT /api/friends/:id/metadata error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/friends/:id/messages - get message history
friends.get('/api/friends/:id/messages', async (c) => {
  try {
    const friendId = c.req.param('id');
    const result = await c.env.DB
      .prepare(
        `SELECT id, direction, message_type as messageType, content, created_at as createdAt
         FROM messages_log WHERE friend_id = ? ORDER BY created_at ASC LIMIT 200`,
      )
      .bind(friendId)
      .all<{ id: string; direction: string; messageType: string; content: string; createdAt: string }>();
    return c.json({ success: true, data: result.results });
  } catch (err) {
    console.error('GET /api/friends/:id/messages error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/friends/:id/activity - aggregated message activity (no message content)
friends.get('/api/friends/:id/activity', async (c) => {
  try {
    const friendId = c.req.param('id');
    const db = c.env.DB;

    const activity = await db
      .prepare(
        `SELECT f.id as friendId,
                MAX(CASE WHEN m.direction = 'incoming' THEN m.created_at END) as lastIncomingAt,
                MAX(CASE WHEN m.direction = 'outgoing' THEN m.created_at END) as lastOutgoingAt,
                SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END) as incomingCount,
                SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END) as outgoingCount
         FROM friends f
         LEFT JOIN messages_log m ON m.friend_id = f.id
         WHERE f.id = ?
         GROUP BY f.id`,
      )
      .bind(friendId)
      .first<ActivityRow>();

    if (!activity) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    return c.json({
      success: true,
      data: activityFromRow(activity),
    });
  } catch (err) {
    console.error('GET /api/friends/:id/activity error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/friends/:id/messages - send message to friend
friends.post('/api/friends/:id/messages', async (c) => {
  try {
    const friendId = c.req.param('id');
    const body = await c.req.json<{
      messageType?: string;
      content: string;
    }>();

    if (!body.content) {
      return c.json({ success: false, error: 'content is required' }, 400);
    }

    const db = c.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    const { LineClient } = await import('@line-crm/line-sdk');
    // Resolve access token from friend's account (multi-account support)
    let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if ((friend as unknown as Record<string, unknown>).line_account_id) {
      const { getLineAccountById } = await import('@line-crm/db');
      const account = await getLineAccountById(db, (friend as unknown as Record<string, unknown>).line_account_id as string);
      if (account) accessToken = account.channel_access_token;
    }
    const lineClient = new LineClient(accessToken);
    const messageType = body.messageType ?? 'text';

    // Auto-wrap URLs with tracking links (text with URLs → Flex with button)
    const { autoTrackContent } = await import('../services/auto-track.js');
    const tracked = await autoTrackContent(
      db, messageType, body.content,
      c.env.WORKER_URL || new URL(c.req.url).origin,
    );

    const message = buildMessage(tracked.messageType, tracked.content);
    await lineClient.pushMessage(friend.line_user_id, [message]);

    // Log outgoing message
    const logId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
         VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, ?)`,
      )
      .bind(logId, friend.id, messageType, body.content, jstNow())
      .run();

    return c.json({ success: true, data: { messageId: logId } });
  } catch (err) {
    console.error('POST /api/friends/:id/messages error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { friends };
