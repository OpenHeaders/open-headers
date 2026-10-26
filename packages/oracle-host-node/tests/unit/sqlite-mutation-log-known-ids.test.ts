/**
 * `knownMutationIds` on the SQLite log: the oracle's commit-point
 * novelty check asks the durable log which of a batch's ids it already
 * holds — scope-bound, across branches, in one statement whatever the
 * batch size.
 */

import type { MutationEnvelope } from '@openheaders/core/sync';
import { ensureMutationLogSchema, SqliteMutationLog } from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

let db: Database.Database;
let log: SqliteMutationLog;

const env = (id: string, ms: number, workspaceId = 'ws-1'): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId,
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: id },
});

beforeEach(() => {
  db = openSqliteDatabase(':memory:');
  ensureMutationLogSchema(db);
  log = new SqliteMutationLog(db, 'ws-1');
});

afterEach(() => {
  db.close();
});

describe('SqliteMutationLog.knownMutationIds', () => {
  it('returns exactly the queried ids the scope holds', async () => {
    await log.appendAll([env('m1', 1_000), env('m2', 2_000)]);
    expect([...(await log.knownMutationIds(['m2', 'm9', 'm1']))].sort()).toEqual(['m1', 'm2']);
  });

  it('an empty query reads nothing', async () => {
    await log.append(env('m1', 1_000));
    expect((await log.knownMutationIds([])).size).toBe(0);
  });

  it("is scope-bound: another workspace's row under the same id is not known here", async () => {
    const other = new SqliteMutationLog(db, 'ws-2');
    await other.append(env('m1', 1_000, 'ws-2'));
    expect((await log.knownMutationIds(['m1'])).size).toBe(0);
    expect([...(await other.knownMutationIds(['m1']))]).toEqual(['m1']);
  });

  it('spans branches: an id on any branch of the scope is known', async () => {
    log.setActiveBranch('main');
    await log.append(env('m1', 1_000));
    log.setActiveBranch('feature');
    expect([...(await log.knownMutationIds(['m1']))]).toEqual(['m1']);
  });

  it('a query wider than the bind-parameter limit rides one statement', async () => {
    const ids = Array.from({ length: 2_000 }, (_, i) => `m${i}`);
    await log.appendAll(ids.slice(0, 1_000).map((id, i) => env(id, 1_000 + i)));
    const known = await log.knownMutationIds(ids);
    expect(known.size).toBe(1_000);
    expect(known.has('m0')).toBe(true);
    expect(known.has('m999')).toBe(true);
    expect(known.has('m1000')).toBe(false);
  });
});
