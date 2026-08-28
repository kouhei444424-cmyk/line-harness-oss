import { describe, expect, it } from 'vitest';
import worker from '../src/index.js';

type FriendRow = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  status_message: string | null;
  is_following: number;
  metadata: string;
  ref_code: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  friendId: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  content: string;
};

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly database: FakeD1,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    return this.database.first(this.sql, this.values) as T | null;
  }

  async all<T>() {
    return {
      success: true,
      results: this.database.all(this.sql, this.values) as T[],
      meta: {},
    };
  }
}

class FakeD1 {
  readonly friends: FriendRow[] = [
    {
      id: 'friend-1',
      line_user_id: 'U1',
      display_name: '相談者A',
      picture_url: null,
      status_message: null,
      is_following: 1,
      metadata: '{}',
      ref_code: null,
      user_id: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-02T00:00:00.000Z',
    },
    {
      id: 'friend-2',
      line_user_id: 'U2',
      display_name: '相談者B',
      picture_url: null,
      status_message: null,
      is_following: 1,
      metadata: '{}',
      ref_code: null,
      user_id: null,
      created_at: '2026-08-03T00:00:00.000Z',
      updated_at: '2026-08-03T00:00:00.000Z',
    },
  ];
  readonly tags = [
    {
      friend_id: 'friend-1',
      id: 'tag-1',
      name: '契約中',
      color: '#fff',
      created_at: '2026-08-01T00:00:00.000Z',
    },
  ];
  readonly messages: MessageRow[] = [
    {
      friendId: 'friend-1',
      direction: 'incoming',
      createdAt: '2026-08-20T00:00:00.000Z',
      content: 'response must not expose this consultation',
    },
    {
      friendId: 'friend-1',
      direction: 'incoming',
      createdAt: '2026-08-21T00:00:00.000Z',
      content: 'or this one',
    },
    {
      friendId: 'friend-1',
      direction: 'outgoing',
      createdAt: '2026-08-22T00:00:00.000Z',
      content: 'staff reply',
    },
  ];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM staff_members')) return null;
    if (sql.includes('FROM friends f') && sql.includes('LEFT JOIN messages_log')) {
      const friendId = String(values[0] ?? '');
      if (!this.friends.some((friend) => friend.id === friendId)) return null;
      return this.activity(friendId);
    }
    throw new Error(`Unexpected first query: ${sql}`);
  }

  all(sql: string, values: unknown[]) {
    const ids = values.map(String);
    if (sql.includes('SELECT * FROM friends WHERE id IN')) {
      return this.friends.filter((friend) => ids.includes(friend.id));
    }
    if (sql.includes('FROM friend_tags ft')) {
      return this.tags.filter((tag) => ids.includes(tag.friend_id));
    }
    if (sql.includes('FROM messages_log') && sql.includes('GROUP BY friend_id')) {
      return ids
        .filter((id) => this.messages.some((message) => message.friendId === id))
        .map((id) => this.activity(id));
    }
    throw new Error(`Unexpected all query: ${sql}`);
  }

  private activity(friendId: string) {
    const messages = this.messages.filter((message) => message.friendId === friendId);
    const incoming = messages.filter((message) => message.direction === 'incoming');
    const outgoing = messages.filter((message) => message.direction === 'outgoing');
    return {
      friendId,
      lastIncomingAt: incoming.at(-1)?.createdAt ?? null,
      lastOutgoingAt: outgoing.at(-1)?.createdAt ?? null,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
    };
  }
}

function createEnv(database = new FakeD1()) {
  return {
    DB: database as unknown as D1Database,
    API_KEY: 'test-api-key',
    LINE_CHANNEL_SECRET: '',
    LINE_CHANNEL_ACCESS_TOKEN: '',
    LIFF_URL: '',
    LINE_CHANNEL_ID: '',
    LINE_LOGIN_CHANNEL_ID: '',
    LINE_LOGIN_CHANNEL_SECRET: '',
    WORKER_URL: 'https://worker.test',
  };
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

async function request(path: string, init?: RequestInit, database = new FakeD1()) {
  return worker.fetch(
    new Request(`https://worker.test${path}`, init),
    createEnv(database),
    executionContext,
  );
}

describe('friend activity endpoints', () => {
  it('requires bearer authentication', async () => {
    const response = await request('/api/friends/batch-activity', {
      method: 'POST',
      body: JSON.stringify({ friendIds: ['friend-1'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(401);
  });

  it('returns friend metadata, tags and aggregate activity without message content', async () => {
    const response = await request('/api/friends/batch-activity', {
      method: 'POST',
      body: JSON.stringify({ friendIds: ['friend-1', 'friend-2', 'missing'] }),
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: { items: Array<Record<string, unknown>> };
    };

    expect(body.data.items).toHaveLength(3);
    expect(body.data.items[0]).toMatchObject({
      friendId: 'friend-1',
      friend: { displayName: '相談者A', tags: [{ name: '契約中' }] },
      activity: {
        lastIncomingAt: '2026-08-21T00:00:00.000Z',
        lastOutgoingAt: '2026-08-22T00:00:00.000Z',
        incomingCount: 2,
        outgoingCount: 1,
      },
    });
    expect(body.data.items[1]).toMatchObject({
      friendId: 'friend-2',
      activity: { incomingCount: 0, outgoingCount: 0 },
    });
    expect(body.data.items[2]).toEqual({
      friendId: 'missing',
      friend: null,
      activity: null,
    });
    expect(JSON.stringify(body)).not.toContain('response must not expose');
  });

  it('rejects duplicate or oversized batches', async () => {
    const headers = {
      Authorization: 'Bearer test-api-key',
      'Content-Type': 'application/json',
    };
    const duplicate = await request('/api/friends/batch-activity', {
      method: 'POST',
      headers,
      body: JSON.stringify({ friendIds: ['friend-1', 'friend-1'] }),
    });
    expect(duplicate.status).toBe(400);

    const oversized = await request('/api/friends/batch-activity', {
      method: 'POST',
      headers,
      body: JSON.stringify({ friendIds: Array.from({ length: 101 }, (_, i) => `friend-${i}`) }),
    });
    expect(oversized.status).toBe(400);

    const empty = await request('/api/friends/batch-activity', {
      method: 'POST',
      headers,
      body: JSON.stringify({ friendIds: [] }),
    });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ data: { items: [] } });
  });

  it('returns 404 for a missing friend and aggregates mixed directions', async () => {
    const headers = { Authorization: 'Bearer test-api-key' };
    const missing = await request('/api/friends/missing/activity', { headers });
    expect(missing.status).toBe(404);

    const existing = await request('/api/friends/friend-1/activity', { headers });
    expect(existing.status).toBe(200);
    expect(await existing.json()).toMatchObject({
      data: { incomingCount: 2, outgoingCount: 1 },
    });
  });
});
