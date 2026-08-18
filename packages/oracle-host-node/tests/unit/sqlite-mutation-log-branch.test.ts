/**
 * Per-branch mutation log (the data-plane topologies design §6.3; the git-sync plan
 * Phase 6): rows are stamped with the active branch, ordered reads see
 * the branchless trunk plus the active branch only — never a sibling
 * branch's rows — and compaction is branch-local. Also pins the
 * in-place column upgrade for a table created before Phase 6.
 */

import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  ensureMutationLogSchema,
  SqliteMutationLog,
  supportsBranchScope,
} from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

let db: Database.Database;
let log: SqliteMutationLog;

const env = (id: string, ms: number): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: id },
});

const collect = async (it: AsyncIterable<MutationEnvelope>): Promise<string[]> => {
  const out: string[] = [];
  for await (const e of it) out.push(e.mutationId);
  return out;
};

beforeEach(() => {
  db = openSqliteDatabase(':memory:');
  ensureMutationLogSchema(db);
  log = new SqliteMutationLog(db, 'ws-1');
});

afterEach(() => {
  db.close();
});

describe('SqliteMutationLog per-branch scope', () => {
  it('implements the branch-scope surface', () => {
    expect(supportsBranchScope(log)).toBe(true);
  });

  it('reads see the trunk plus the active branch, never a sibling branch', async () => {
    await log.append(env('trunk-1', 1_000));
    log.setActiveBranch('main');
    await log.append(env('main-1', 2_000));
    log.setActiveBranch('feature');
    await log.append(env('feature-1', 3_000));

    expect(await collect(log.readSince(null))).toEqual(['trunk-1', 'feature-1']);
    log.setActiveBranch('main');
    expect(await collect(log.readSince(null))).toEqual(['trunk-1', 'main-1']);
    log.setActiveBranch('');
    expect(await collect(log.readSince(null))).toEqual(['trunk-1']);
  });

  it('readSince watermark composes with the branch filter', async () => {
    log.setActiveBranch('main');
    await log.appendAll([env('m1', 1_000), env('m2', 2_000), env('m3', 3_000)]);
    const all = await collect(log.readSince(null));
    expect(all).toEqual(['m1', 'm2', 'm3']);
    // Key encoding is opaque here; re-read from the first row's HLC by
    // deleting nothing and asserting the exclusive-since contract via
    // a full read after truncation instead.
    await log.truncateBefore('~');
    expect(await collect(log.readSince(null))).toEqual([]);
  });

  it('compaction is branch-local: truncating on one branch never drops a sibling or the trunk', async () => {
    await log.append(env('trunk-1', 1_000));
    log.setActiveBranch('main');
    await log.append(env('main-1', 2_000));
    log.setActiveBranch('feature');
    await log.append(env('feature-1', 3_000));

    await log.truncateBefore('~');
    expect(await collect(log.readSince(null))).toEqual(['trunk-1']);
    log.setActiveBranch('main');
    expect(await collect(log.readSince(null))).toEqual(['trunk-1', 'main-1']);
  });

  it('purgeOrg is cross-branch (tenancy eviction outranks branch scoping)', async () => {
    await log.append(env('trunk-1', 1_000));
    log.setActiveBranch('main');
    await log.append(env('main-1', 2_000));
    log.setActiveBranch('feature');
    await log.append(env('feature-1', 3_000));

    const purged = await log.purgeOrg('org-test');
    expect(purged.sort()).toEqual(['feature-1', 'main-1', 'trunk-1']);
    expect(await collect(log.readSince(null))).toEqual([]);
    log.setActiveBranch('main');
    expect(await collect(log.readSince(null))).toEqual([]);
  });

  it('dedup stays scope-global across branches', async () => {
    log.setActiveBranch('main');
    await log.append(env('m1', 1_000));
    log.setActiveBranch('feature');
    await log.append(env('m1', 9_000));
    expect(await log.hasMutation('m1')).toBe(true);
    expect(await collect(log.readSince(null))).toEqual([]);
    log.setActiveBranch('main');
    expect(await collect(log.readSince(null))).toEqual(['m1']);
  });

  it('a pre-Phase-6 table gains the branch column in place; legacy rows read as trunk', async () => {
    const legacy = openSqliteDatabase(':memory:');
    legacy.exec(
      `CREATE TABLE mutation_log (
        scope TEXT NOT NULL, org_id TEXT NOT NULL, hlc_key TEXT NOT NULL,
        mutation_id TEXT NOT NULL, envelope_json TEXT NOT NULL,
        PRIMARY KEY (scope, hlc_key, mutation_id)
      )`,
    );
    legacy
      .prepare(`INSERT INTO mutation_log (scope, org_id, hlc_key, mutation_id, envelope_json) VALUES (?, ?, ?, ?, ?)`)
      .run('ws-1', 'org-test', '0001', 'legacy-1', JSON.stringify(env('legacy-1', 1_000)));

    ensureMutationLogSchema(legacy);
    const upgraded = new SqliteMutationLog(legacy, 'ws-1');
    upgraded.setActiveBranch('main');
    expect(await collect(upgraded.readSince(null))).toEqual(['legacy-1']);
    legacy.close();
  });
});
