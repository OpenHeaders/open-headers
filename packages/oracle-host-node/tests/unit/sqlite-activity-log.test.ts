/**
 * Phase C F1 — SQLite-backed activity log.
 *
 * Exercises the same {@link ActivityLog} contract as the in-memory
 * reference against an in-memory SQLite database. Schema-create is
 * idempotent so each test runs on a fresh `:memory:` handle.
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { activityEntryId, type ActivityEntry, type ActivityEntryKind } from '@openheaders/core/sync';
import { SqliteActivityLog, ensureActivityLogSchema } from '@openheaders/oracle-host-node/sync/sqlite-activity-log';

const WS = '0193a8ff-c000-7000-8000-000000000001';

let db: Database.Database;
let log: SqliteActivityLog;

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  const base: ActivityEntry = {
    id: '',
    workspaceId: WS,
    mutationId: 'mut-001',
    hlc: { physicalMs: 1_700_000_000_000, logical: 0, nodeId: 'desktop' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'workbench', deviceId: 'device-A' },
    observedAt: 1_700_000_000_123,
    read: false,
    ...overrides,
  };
  return { ...base, id: activityEntryId(base) };
}

beforeEach(() => {
  db = new Database(':memory:');
  ensureActivityLogSchema(db);
  log = new SqliteActivityLog(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteActivityLog', () => {
  it('append + list returns newest first by HLC', async () => {
    await log.append(
      makeEntry({ mutationId: 'm1', hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n' } }),
    );
    await log.append(
      makeEntry({ mutationId: 'm3', hlc: { physicalMs: 3_000, logical: 0, nodeId: 'n' } }),
    );
    await log.append(
      makeEntry({ mutationId: 'm2', hlc: { physicalMs: 2_000, logical: 0, nodeId: 'n' } }),
    );
    const rows = await log.list(WS);
    expect(rows.map((r) => r.mutationId)).toEqual(['m3', 'm2', 'm1']);
  });

  it('append is idempotent on (workspaceId, mutationId, kind)', async () => {
    const e = makeEntry({ mutationId: 'm1' });
    await log.append(e);
    await log.append(e);
    expect((await log.list(WS)).length).toBe(1);
  });

  it('allows one row per kind from the same envelope', async () => {
    const base = { mutationId: 'm1', hlc: { physicalMs: 1, logical: 0, nodeId: 'n' } };
    await log.append(makeEntry({ ...base, kind: 'edit-entity' }));
    await log.append(makeEntry({ ...base, kind: 'sensitive-field-rotation' }));
    const rows = await log.list(WS);
    expect(rows.map((r) => r.kind).sort()).toEqual(['edit-entity', 'sensitive-field-rotation']);
  });

  it('list respects workspace scope', async () => {
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'm1' }));
    await log.append(makeEntry({ workspaceId: 'other', mutationId: 'm2' }));
    expect((await log.list(WS)).map((r) => r.mutationId)).toEqual(['m1']);
  });

  it('list respects limit, sinceHlcKey, and unreadOnly', async () => {
    const e1 = makeEntry({ mutationId: 'm1', hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n' } });
    const e2 = makeEntry({ mutationId: 'm2', hlc: { physicalMs: 2_000, logical: 0, nodeId: 'n' } });
    const e3 = makeEntry({
      mutationId: 'm3',
      hlc: { physicalMs: 3_000, logical: 0, nodeId: 'n' },
      read: true,
    });
    await log.append(e1);
    await log.append(e2);
    await log.append(e3);

    expect((await log.list(WS, { limit: 2 })).map((r) => r.mutationId)).toEqual(['m3', 'm2']);
    expect((await log.list(WS, { sinceHlcKey: e1.id.split('|')[0] })).map((r) => r.mutationId)).toEqual([
      'm3',
      'm2',
    ]);
    expect((await log.list(WS, { unreadOnly: true })).map((r) => r.mutationId)).toEqual(['m2', 'm1']);
  });

  it('markRead flips read and persists across re-list', async () => {
    const a = makeEntry({ mutationId: 'm1' });
    await log.append(a);
    await log.markRead(WS, [a.id]);
    const rows = await log.list(WS);
    expect(rows[0].read).toBe(true);
    expect(await log.countUnread(WS)).toBe(0);
  });

  it('prune deletes rows older than cutoff and returns the count', async () => {
    await log.append(makeEntry({ mutationId: 'old', observedAt: 100 }));
    await log.append(makeEntry({ mutationId: 'new', observedAt: 500 }));
    const removed = await log.prune(WS, 300);
    expect(removed).toBe(1);
    expect((await log.list(WS)).map((r) => r.mutationId)).toEqual(['new']);
  });

  it('has identifies a specific (mutationId, kind) pair', async () => {
    await log.append(makeEntry({ mutationId: 'm1', kind: 'edit-entity' }));
    expect(await log.has(WS, 'm1', 'edit-entity')).toBe(true);
    expect(await log.has(WS, 'm1', 'delete-entity' as ActivityEntryKind)).toBe(false);
    expect(await log.has(WS, 'm2', 'edit-entity')).toBe(false);
  });
});
