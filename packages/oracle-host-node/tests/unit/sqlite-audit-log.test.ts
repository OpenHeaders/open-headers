/**
 * Phase 5 slice 4 — SQLite-backed audit log.
 *
 * Exercises the {@link AuditLog} contract (gapless per-Org seq,
 * newest-first list, prune) plus the report-surface query/prune
 * functions and the retention scheduler, each on a fresh `:memory:`
 * handle.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger as consoleLogger } from '@openheaders/core/utils';
import type { AuditLogAppendInput } from '@openheaders/oracle/sync/audit-log';
import {
  ensureAuditLogSchema,
  pruneAuditEntriesBefore,
  queryAuditEntries,
  SqliteAuditLog,
} from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAuditPruneScheduler } from '../../src/daemon/audit-prune-scheduler';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

const ORG_A = '0193a8ff-c000-7000-8000-00000000000a';
const ORG_B = '0193a8ff-c000-7000-8000-00000000000b';
const WS = '0193a8ff-c000-7000-8000-000000000001';

let db: Database.Database;
let log: SqliteAuditLog;

function makeInput(overrides: Partial<AuditLogAppendInput> = {}): AuditLogAppendInput {
  return {
    orgId: ORG_A,
    actorUserId: 'user-alice',
    capability: 'workspace.write',
    workspaceId: WS,
    decision: { allow: true },
    occurredAt: '2026-07-10T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  db = openSqliteDatabase(':memory:');
  ensureAuditLogSchema(db);
  log = new SqliteAuditLog(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteAuditLog', () => {
  it('append mints gapless per-Org sequences with content-addressed ids', async () => {
    const first = await log.append(makeInput());
    const second = await log.append(makeInput());
    const other = await log.append(makeInput({ orgId: ORG_B }));
    expect([first.seq, second.seq]).toEqual([1, 2]);
    expect(first.id).toBe(`${ORG_A}:1`);
    expect(second.id).toBe(`${ORG_A}:2`);
    expect(other.seq).toBe(1);
    expect(other.id).toBe(`${ORG_B}:1`);
  });

  it('round-trips deny decisions and the optional workspace binding', async () => {
    await log.append(
      makeInput({ decision: { allow: false, reason: 'insufficient-workspace-role' }, actorUserId: 'user-bob' }),
    );
    const denyRowInput = makeInput({
      decision: { allow: false, reason: 'not-daemon-admin' },
      capability: 'daemon.admin',
    });
    const { workspaceId: _dropped, ...noWorkspace } = denyRowInput;
    await log.append(noWorkspace);
    const rows = await log.list(ORG_A);
    expect(rows[0]?.decision).toEqual({ allow: false, reason: 'not-daemon-admin' });
    expect(rows[0]?.workspaceId).toBeUndefined();
    expect(rows[1]?.decision).toEqual({ allow: false, reason: 'insufficient-workspace-role' });
    expect(rows[1]?.workspaceId).toBe(WS);
  });

  it('list returns newest-first with limit and sinceSeq cursors', async () => {
    for (let i = 0; i < 5; i++) await log.append(makeInput());
    const all = await log.list(ORG_A);
    expect(all.map((r) => r.seq)).toEqual([5, 4, 3, 2, 1]);
    const limited = await log.list(ORG_A, { limit: 2 });
    expect(limited.map((r) => r.seq)).toEqual([5, 4]);
    const since = await log.list(ORG_A, { sinceSeq: 3 });
    expect(since.map((r) => r.seq)).toEqual([5, 4]);
  });

  it('prune drops rows strictly before the cutoff, per Org', async () => {
    await log.append(makeInput({ occurredAt: '2026-04-01T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-01T00:00:00.000Z' }));
    await log.append(makeInput({ orgId: ORG_B, occurredAt: '2026-04-01T00:00:00.000Z' }));
    const removed = await log.prune(ORG_A, '2026-07-01T00:00:00.000Z');
    expect(removed).toBe(1);
    expect((await log.list(ORG_A)).map((r) => r.occurredAt)).toEqual(['2026-07-01T00:00:00.000Z']);
    expect(await log.list(ORG_B)).toHaveLength(1);
  });

  it('pruned sequences do not restart — the counter survives the sweep', async () => {
    await log.append(makeInput({ occurredAt: '2026-04-01T00:00:00.000Z' }));
    await log.prune(ORG_A, '2026-07-01T00:00:00.000Z');
    const next = await log.append(makeInput());
    expect(next.seq).toBe(2);
  });
});

describe('queryAuditEntries', () => {
  it('returns empty on a database without the audit tables', () => {
    const bare = openSqliteDatabase(':memory:');
    expect(queryAuditEntries(bare)).toEqual([]);
    bare.close();
  });

  it('filters by actor, capability, decision and workspace', async () => {
    await log.append(makeInput({ actorUserId: 'user-alice', capability: 'workspace.write' }));
    await log.append(
      makeInput({
        actorUserId: 'user-bob',
        capability: 'workspace.read',
        decision: { allow: false, reason: 'no-workspace-role-assignment' },
      }),
    );
    await log.append(makeInput({ actorUserId: 'user-bob', capability: 'daemon.admin' }));
    expect(queryAuditEntries(db, { actorUserId: 'user-bob' })).toHaveLength(2);
    expect(queryAuditEntries(db, { capability: 'workspace.write' })[0]?.actorUserId).toBe('user-alice');
    expect(queryAuditEntries(db, { allow: false })[0]?.capability).toBe('workspace.read');
    expect(queryAuditEntries(db, { workspaceId: WS })).toHaveLength(3);
    expect(queryAuditEntries(db, { workspaceId: 'other' })).toHaveLength(0);
  });

  it('applies inclusive since / exclusive until bounds and the row cap', async () => {
    await log.append(makeInput({ occurredAt: '2026-07-01T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-02T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-03T00:00:00.000Z' }));
    const bounded = queryAuditEntries(db, {
      sinceIso: '2026-07-02T00:00:00.000Z',
      untilIso: '2026-07-03T00:00:00.000Z',
    });
    expect(bounded.map((r) => r.occurredAt)).toEqual(['2026-07-02T00:00:00.000Z']);
    expect(queryAuditEntries(db, { limit: 2 })).toHaveLength(2);
  });

  it('spans Orgs and orders by occurredAt in both directions', async () => {
    await log.append(makeInput({ occurredAt: '2026-07-02T00:00:00.000Z' }));
    await log.append(makeInput({ orgId: ORG_B, occurredAt: '2026-07-01T00:00:00.000Z' }));
    const newestFirst = queryAuditEntries(db);
    expect(newestFirst.map((r) => r.orgId)).toEqual([ORG_A, ORG_B]);
    const oldestFirst = queryAuditEntries(db, { order: 'asc' });
    expect(oldestFirst.map((r) => r.orgId)).toEqual([ORG_B, ORG_A]);
  });

  it('keyset cursor pages without loss or repeats across rows sharing a timestamp', async () => {
    // Five rows, three of them on the SAME occurredAt — the case a bare
    // untilIso window would drop or duplicate at the page boundary.
    await log.append(makeInput({ occurredAt: '2026-07-01T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-02T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-02T00:00:00.000Z' }));
    await log.append(makeInput({ orgId: ORG_B, occurredAt: '2026-07-02T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-03T00:00:00.000Z' }));
    const full = queryAuditEntries(db);
    expect(full).toHaveLength(5);

    const paged: string[] = [];
    let after: { occurredAt: string; orgId: string; seq: number } | undefined;
    for (;;) {
      const page = queryAuditEntries(db, { limit: 2, ...(after ? { after } : {}) });
      if (page.length === 0) break;
      paged.push(...page.map((r) => r.id));
      const last = page[page.length - 1]!;
      after = { occurredAt: last.occurredAt, orgId: last.orgId, seq: last.seq };
    }
    expect(paged).toEqual(full.map((r) => r.id));

    // Ascending walks the same set in reverse.
    const ascFull = queryAuditEntries(db, { order: 'asc' });
    expect(ascFull.map((r) => r.id)).toEqual([...full.map((r) => r.id)].reverse());
    const ascFirst = queryAuditEntries(db, { order: 'asc', limit: 1 })[0]!;
    const ascRest = queryAuditEntries(db, {
      order: 'asc',
      after: { occurredAt: ascFirst.occurredAt, orgId: ascFirst.orgId, seq: ascFirst.seq },
    });
    expect([ascFirst.id, ...ascRest.map((r) => r.id)]).toEqual(ascFull.map((r) => r.id));
  });
});

describe('audit retention', () => {
  it('pruneAuditEntriesBefore sweeps every Org in one pass', async () => {
    await log.append(makeInput({ occurredAt: '2026-01-01T00:00:00.000Z' }));
    await log.append(makeInput({ orgId: ORG_B, occurredAt: '2026-01-01T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-01T00:00:00.000Z' }));
    expect(pruneAuditEntriesBefore(db, '2026-06-01T00:00:00.000Z')).toBe(2);
    expect(queryAuditEntries(db)).toHaveLength(1);
  });

  it('the scheduler prunes rows older than the retention window each tick', async () => {
    vi.useFakeTimers();
    const nowMs = Date.parse('2026-07-10T00:00:00.000Z');
    await log.append(makeInput({ occurredAt: '2026-03-01T00:00:00.000Z' }));
    await log.append(makeInput({ occurredAt: '2026-07-01T00:00:00.000Z' }));
    const stop = installAuditPruneScheduler({ db, retentionDays: 90, periodMs: 1_000, now: () => nowMs });
    vi.advanceTimersByTime(1_000);
    expect(queryAuditEntries(db).map((r) => r.occurredAt)).toEqual(['2026-07-01T00:00:00.000Z']);
    stop();
    vi.useRealTimers();
  });
});
