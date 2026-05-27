/**
 * Phase C F6.b — SQLite-backed activity mute store.
 *
 * Exercises the same {@link ActivityMuteStore} contract as the
 * in-memory reference against an in-memory SQLite database.
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SqliteActivityMuteStore,
  ensureActivityMuteSchema,
} from '@openheaders/oracle/sync/sqlite-activity-mute-store';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const WS2 = '0193a8ff-c000-7000-8000-000000000002';

let db: Database.Database;
let store: SqliteActivityMuteStore;

beforeEach(() => {
  db = new Database(':memory:');
  ensureActivityMuteSchema(db);
  store = new SqliteActivityMuteStore(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteActivityMuteStore', () => {
  it('put + has reflects insertion', async () => {
    expect(await store.has(WS, 'rule', 'r1')).toBe(false);
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 100 });
    expect(await store.has(WS, 'rule', 'r1')).toBe(true);
  });

  it('put refreshes mutedAt on re-mute (INSERT OR REPLACE)', async () => {
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 100 });
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 250 });
    const rows = await store.list(WS);
    expect(rows).toHaveLength(1);
    expect(rows[0].mutedAt).toBe(250);
  });

  it('remove is idempotent', async () => {
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 100 });
    await store.remove(WS, 'rule', 'r1');
    expect(await store.has(WS, 'rule', 'r1')).toBe(false);
    await store.remove(WS, 'rule', 'r1');
    await store.remove(WS, 'rule', 'never-existed');
  });

  it('list is workspace-scoped + ordered by mutedAt ASC', async () => {
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r2', mutedAt: 200 });
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 100 });
    await store.put({ workspaceId: WS2, entityType: 'rule', entityId: 'r3', mutedAt: 50 });
    const wsRows = await store.list(WS);
    expect(wsRows.map((r) => r.entityId)).toEqual(['r1', 'r2']);
    const ws2Rows = await store.list(WS2);
    expect(ws2Rows.map((r) => r.entityId)).toEqual(['r3']);
  });

  it('list of an empty workspace returns an empty array', async () => {
    expect(await store.list('unknown')).toEqual([]);
  });

  it('different entityTypes coexist on the same entityId', async () => {
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'shared', mutedAt: 100 });
    await store.put({ workspaceId: WS, entityType: 'request', entityId: 'shared', mutedAt: 200 });
    expect(await store.has(WS, 'rule', 'shared')).toBe(true);
    expect(await store.has(WS, 'request', 'shared')).toBe(true);
    const rows = await store.list(WS);
    expect(rows).toHaveLength(2);
  });
});
