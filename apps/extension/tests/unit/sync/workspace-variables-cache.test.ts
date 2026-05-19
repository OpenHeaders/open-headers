/**
 * Phase B — workspace-variables cache subscribes to broadcast,
 * re-projects to WorkspaceVariables, persists to
 * chrome.storage.local. Mirrors collection-cache.test.ts.
 */

import { setWorkspaceVar } from '@openheaders/core/sync';
import type { Variable, WorkspaceVariables } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createWorkspaceVariablesCache } from '@openheaders/oracle/sync/workspace-variables-cache';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeWorkspaceVars = (vars: Variable[]): WorkspaceVariables => ({
  schemaVersion: 5,
  variables: vars,
});

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

afterEach(() => {
  // No global state to reset.
});

describe('WorkspaceVariablesCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createWorkspaceVariablesCache('ws-1', oracle, broadcast, ctxFactory);
    const snap = cache.getWorkspaceVariables();
    expect(snap.variables).toEqual([]);
    cache.dispose();
  });

  it('seeds the oracle from a persisted singleton and projects it back', async () => {
    const cache = createWorkspaceVariablesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedWorkspaceVariables(
      makeWorkspaceVars([
        { uid: 'c129d2e8', name: 'API_BASE', value: 'https://openheaders.io', type: 'default' },
        { uid: 'e8c4cbf0', name: 'TOKEN', value: 't', type: 'secret' },
      ]),
    );
    const snap = cache.getWorkspaceVariables();
    expect(snap.variables.map((v) => v.name).sort()).toEqual(['API_BASE', 'TOKEN']);
    cache.dispose();
  });

  it('updates the cache when a new var is set via the catalog', async () => {
    const cache = createWorkspaceVariablesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedWorkspaceVariables(
      makeWorkspaceVars([{ uid: '0956e8ce', name: 'A', value: '1', type: 'default' }]),
    );
    const intent = setWorkspaceVar(ctxFactory(), { variable: { uid: 'vrwsvarb2', name: 'B', value: '2', type: 'default' } });
    await oracle.apply(intent.batch, []);
    const snap = cache.getWorkspaceVariables();
    expect(snap.variables.map((v) => v.name).sort()).toEqual(['A', 'B']);
    cache.dispose();
  });

  it('ignores Rule envelopes — workspace-vars state stays empty', () => {
    const cache = createWorkspaceVariablesCache('ws-1', oracle, broadcast, ctxFactory);
    let listenerFires = 0;
    cache.onChange(() => {
      listenerFires += 1;
    });
    broadcast.publish({
      envelope: {
        mutationId: 'r1',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n0' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        orgId: 'org-test',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    expect(listenerFires).toBe(0);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createWorkspaceVariablesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedWorkspaceVariables(
      makeWorkspaceVars([{ uid: '527219e0', name: 'A', value: '1', type: 'default' }]),
    );
    cache.dispose();
    const intent = setWorkspaceVar(ctxFactory(), { variable: { uid: 'vrwsvarb2', name: 'B', value: '2', type: 'default' } });
    await oracle.apply(intent.batch, []);
    expect(cache.getWorkspaceVariables().variables.map((v) => v.name)).toEqual(['A']);
  });
});
