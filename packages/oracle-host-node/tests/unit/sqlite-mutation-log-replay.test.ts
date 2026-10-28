/**
 * The boot replay of a git-bound workspace (the workspace-list scope
 * audit §1.1, slice 10): the oracle's store applies every batch the
 * host commits, on whatever branch HEAD names at the time, so the
 * replay that rebuilds it is the whole scope (`readAll`), never the
 * wire's trunk-plus-active-branch view (`readSince`).
 *
 * One history, told the way a bound folder lives it: a rule created
 * before the binding (trunk), renamed on `main`, then a `feature`
 * branch forked from `main` where the rule is toggled and a second
 * rule is created. The branch-filtered replays are the control legs:
 * on `feature` they lose the `main` rename the feature tree was forked
 * with (the loss the audit's own fix would have left in place); on the
 * trunk they lose everything after the binding (the loss the audit
 * found).
 */

import { type MutationBatch, type MutatorContext, mintBatch, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { ensureMutationLogSchema, SqliteMutationLog } from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

const SCOPE = 'ws-bound';

let db: Database.Database;
let log: SqliteMutationLog;

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: SCOPE,
  hlc: { physicalMs, logical: 0, nodeId: 'node-host' },
  surfaceId: 'surface-test',
  deviceId: 'device-host',
});

const lock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

function makeOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: SCOPE,
    lock,
    log,
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

interface RuleShape {
  uid: string;
  name: string;
  enabled: boolean;
}

const rule = (oracle: EntityOracle, uid: string): RuleShape | null => {
  const materialized = oracle.materializeOne(RULE_ENTITY_TYPE, uid);
  if (!materialized) return null;
  const data = materialized.data as { uid: string; name: string; enabled: boolean };
  return { uid: data.uid, name: data.name, enabled: data.enabled };
};

const createRule = (ms: number, uid: string, name: string): MutationBatch =>
  mintBatch(ctx(ms), [
    { kind: 'create', type: RULE_ENTITY_TYPE, id: uid, payload: { uid, name, type: 'header', enabled: false } },
  ]);

const setRuleField = (ms: number, uid: string, path: string, value: unknown): MutationBatch =>
  mintBatch(ctx(ms), [{ kind: 'setField', type: RULE_ENTITY_TYPE, id: uid, path, value }]);

/**
 * The session: the trunk row before the binding, the rename on `main`,
 * the fork to `feature` with its toggle and second rule. Returns the
 * oracle whose store lived through it.
 */
async function liveSession(): Promise<EntityOracle> {
  const oracle = makeOracle();
  await oracle.apply(createRule(1_000, 'r-login', 'Login header'));
  log.setActiveBranch('main');
  await oracle.apply(setRuleField(2_000, 'r-login', 'name', 'Login header v2'));
  log.setActiveBranch('feature');
  await oracle.apply(setRuleField(3_000, 'r-login', 'enabled', true));
  await oracle.apply(createRule(4_000, 'r-second', 'Second rule'));
  return oracle;
}

beforeEach(() => {
  db = openSqliteDatabase(':memory:');
  ensureMutationLogSchema(db);
  log = new SqliteMutationLog(db, SCOPE);
});

afterEach(() => {
  db.close();
});

describe('boot replay of a git-bound workspace', () => {
  it('readAll rebuilds the store the session held, whatever branch the pointer names at boot', async () => {
    const live = await liveSession();
    const expectedLogin = rule(live, 'r-login');
    const expectedSecond = rule(live, 'r-second');
    expect(expectedLogin).toEqual({ uid: 'r-login', name: 'Login header v2', enabled: true });
    expect(expectedSecond).toEqual({ uid: 'r-second', name: 'Second rule', enabled: false });

    for (const pointerAtBoot of ['feature', 'main', '']) {
      log.setActiveBranch(pointerAtBoot);
      const booted = makeOracle();
      expect(await booted.hydrate(log.readAll())).toBe(4);
      expect(rule(booted, 'r-login')).toEqual(expectedLogin);
      expect(rule(booted, 'r-second')).toEqual(expectedSecond);
    }
  });

  it('control: the branch-filtered replay on feature loses the main rename the feature tree was forked with', async () => {
    await liveSession();
    log.setActiveBranch('feature');
    const booted = makeOracle();
    expect(await booted.hydrate(log.readSince(null))).toBe(3);
    expect(rule(booted, 'r-login')).toEqual({ uid: 'r-login', name: 'Login header', enabled: true });
    expect(rule(booted, 'r-second')).toEqual({ uid: 'r-second', name: 'Second rule', enabled: false });
  });

  it('control: the branch-filtered replay on the trunk loses every row appended after the binding', async () => {
    await liveSession();
    log.setActiveBranch('');
    const booted = makeOracle();
    expect(await booted.hydrate(log.readSince(null))).toBe(1);
    expect(rule(booted, 'r-login')).toEqual({ uid: 'r-login', name: 'Login header', enabled: false });
    expect(rule(booted, 'r-second')).toBeNull();
  });

  it('a write after the replay commits onto the active branch and the next replay carries it', async () => {
    await liveSession();
    log.setActiveBranch('feature');
    const booted = makeOracle();
    await booted.hydrate(log.readAll());
    await booted.apply(setRuleField(5_000, 'r-second', 'enabled', true));

    const stamps = db
      .prepare(`SELECT branch, count(*) AS n FROM mutation_log WHERE scope = ? GROUP BY branch ORDER BY branch`)
      .all(SCOPE) as Array<{ branch: string; n: number }>;
    expect(stamps).toEqual([
      { branch: '', n: 1 },
      { branch: 'feature', n: 3 },
      { branch: 'main', n: 1 },
    ]);

    const rebooted = makeOracle();
    expect(await rebooted.hydrate(log.readAll())).toBe(5);
    expect(rule(rebooted, 'r-second')).toEqual({ uid: 'r-second', name: 'Second rule', enabled: true });
  });
});
