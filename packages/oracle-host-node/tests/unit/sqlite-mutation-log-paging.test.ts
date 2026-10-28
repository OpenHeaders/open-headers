/**
 * The SQLite log's ordered reads page by keyset (the workspace-list
 * scope epic, slice 14): each page is one synchronous `all()` and no
 * statement is open across a `yield`, so a write on the shared handle
 * that lands while a consumer is suspended mid-walk is accepted
 * instead of refused with "This database connection is busy executing
 * a query".
 *
 * The scope is seeded past one page so every read shape crosses a
 * boundary, with two rows tied on `hlc_key` straddling it: a cursor on
 * `hlc_key` alone would skip or repeat one of them.
 */

import { hlcToString, type MutationEnvelope, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  ensureMutationLogSchema,
  MUTATION_LOG_PAGE_SIZE,
  SqliteMutationLog,
} from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

const SCOPE = 'ws-paged';
/** One full page, a tie across its boundary, and a tail. */
const ROWS = MUTATION_LOG_PAGE_SIZE + 7;

let db: Database.Database;
let log: SqliteMutationLog;

const env = (i: number, physicalMs: number): MutationEnvelope => ({
  mutationId: `m${String(i).padStart(5, '0')}`,
  hlc: { physicalMs, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: SCOPE,
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r1', path: 'name', value: String(i) },
});

/** Row i sits at 1000 + i ms, except the two straddling the page boundary, which share one HLC. */
const seed = (): MutationEnvelope[] =>
  Array.from({ length: ROWS }, (_, i) => {
    const boundary = MUTATION_LOG_PAGE_SIZE - 1;
    const ms = i === boundary + 1 ? 1_000 + boundary : 1_000 + i;
    return env(i, ms);
  });

const collect = async (it: AsyncIterable<MutationEnvelope>): Promise<string[]> => {
  const out: string[] = [];
  for await (const e of it) out.push(e.mutationId);
  return out;
};

beforeEach(async () => {
  db = openSqliteDatabase(':memory:');
  ensureMutationLogSchema(db);
  log = new SqliteMutationLog(db, SCOPE);
  await log.appendAll(seed());
});

afterEach(() => {
  db.close();
});

describe('SqliteMutationLog keyset paging', () => {
  it('readSince(null) and readAll read every row in order across the page boundary', async () => {
    const expected = seed().map((e) => e.mutationId);
    expect(await collect(log.readSince(null))).toEqual(expected);
    expect(await collect(log.readAll())).toEqual(expected);
  });

  it('readSince(key) resumes strictly above the key, through the boundary', async () => {
    const rows = seed();
    const sinceIndex = 3;
    const since = hlcToString(rows[sinceIndex].hlc);
    expect(await collect(log.readSince(since))).toEqual(rows.slice(sinceIndex + 1).map((e) => e.mutationId));
    const boundary = MUTATION_LOG_PAGE_SIZE - 1;
    const atTie = hlcToString(rows[boundary].hlc);
    expect(await collect(log.readSince(atTie))).toEqual(rows.slice(boundary + 2).map((e) => e.mutationId));
  });

  it('a write landing while a consumer is suspended mid-walk is accepted, and the walk streams it', async () => {
    const late = env(ROWS, 1_000 + ROWS);
    const seen: string[] = [];
    let written = false;
    for await (const e of log.readSince(null)) {
      seen.push(e.mutationId);
      if (!written) {
        written = true;
        await log.append(late);
        expect(await log.hasMutation(late.mutationId)).toBe(true);
      }
    }
    expect(seen).toHaveLength(ROWS + 1);
    expect(seen[seen.length - 1]).toBe(late.mutationId);
  });

  it('CONTROL: the same write against an open statement iterator is refused', async () => {
    const stmt = db.prepare(`SELECT envelope_json FROM mutation_log WHERE scope = ? ORDER BY hlc_key, mutation_id`);
    const iter = stmt.iterate(SCOPE) as IterableIterator<{ envelope_json: string }>;
    iter.next();
    await expect(log.append(env(ROWS, 1_000 + ROWS))).rejects.toThrow(/busy executing a query/);
    iter.return?.();
    await expect(log.append(env(ROWS, 1_000 + ROWS))).resolves.toBeUndefined();
  });
});
