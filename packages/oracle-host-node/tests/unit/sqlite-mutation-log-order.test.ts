/**
 * `readSince(null)` on the SQLite log is the oracle's boot order: every
 * row of the scope by `hlc_key` then `mutation_id`, whatever order the
 * rows were appended in — a ticked batch replays in mint order, and
 * two envelopes under one HLC fall back to the id.
 */

import { type MutationEnvelope, type MutatorContext, mintBatch, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { ensureMutationLogSchema, SqliteMutationLog } from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

let db: Database.Database;
let log: SqliteMutationLog;

const env = (id: string, ms: number, logical = 0): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r1', path: 'name', value: id },
});

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  hlc: { physicalMs: 5_000, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
};

async function ids(): Promise<string[]> {
  const out: string[] = [];
  for await (const envelope of log.readSince(null)) out.push(envelope.mutationId);
  return out;
}

beforeEach(() => {
  db = openSqliteDatabase(':memory:');
  ensureMutationLogSchema(db);
  log = new SqliteMutationLog(db, 'ws-1');
});

afterEach(() => {
  db.close();
});

describe('SqliteMutationLog.readSince(null) order', () => {
  it('reads the whole scope by HLC, whatever the append order', async () => {
    await log.append(env('m3', 3_000));
    await log.append(env('m1', 1_000));
    await log.appendAll([env('m4', 4_000), env('m2', 2_000)]);
    expect(await ids()).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('replays a ticked batch in mint order', async () => {
    const batch = mintBatch(ctx, [
      { kind: 'create', type: RULE_ENTITY_TYPE, id: 'r1', payload: { name: 'first' } },
      { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r1', path: 'name', value: 'second' },
      { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r1', path: 'name', value: 'third' },
    ]);
    await log.appendAll([...batch.mutations].reverse());
    expect(await ids()).toEqual(batch.mutations.map((m) => m.mutationId));
  });

  it('breaks an HLC tie by mutation id', async () => {
    await log.appendAll([env('m-b', 1_000), env('m-a', 1_000)]);
    expect(await ids()).toEqual(['m-a', 'm-b']);
  });
});
