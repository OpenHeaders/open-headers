/**
 * Phase B — global sync service lifecycle. Distinct from per-workspace
 * `service.ts`: one-time init at SW boot, no workspace-switch reinit,
 * sentinel scope id `EXTENSION_WORKSPACE_GLOBAL_SCOPE` for the IDB +
 * lock stripe.
 */

import { EXTENSION_WORKSPACE_GLOBAL_SCOPE, setExtensionWorkspace } from '@openheaders/core/sync';
import { seedExtensionWorkspaces } from '@openheaders/core/sync-builders/projections/extension-workspace-projection';
import { getActiveExtensionWorkspaceCache } from '@openheaders/oracle/sync/caches/extension-workspace-cache';
import {
  __initGlobalSyncServiceForTests,
  disposeGlobal,
  getGlobalOracle,
  nextGlobalSwContext,
  snapshotExtensionWorkspacePostStates,
  whenGlobalHydrated,
} from '@openheaders/oracle/sync/global-service';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  disposeGlobal();
});

describe('global-service', () => {
  it('returns null oracle + empty snapshots before init', () => {
    expect(getGlobalOracle()).toBeNull();
    expect(snapshotExtensionWorkspacePostStates()).toEqual([]);
    expect(getActiveExtensionWorkspaceCache()).toBeNull();
  });

  it('init wires oracle + cache + snapshot RPC against the sentinel scope', async () => {
    __initGlobalSyncServiceForTests();
    const oracle = getGlobalOracle();
    expect(oracle).not.toBeNull();
    const cache = getActiveExtensionWorkspaceCache();
    expect(cache).not.toBeNull();
    expect(cache?.scope).toBe(EXTENSION_WORKSPACE_GLOBAL_SCOPE);

    // Seed via the cache, confirm it shows up in the snapshot RPC
    await cache?.seedFromPersistedState({
      workspaces: [
        {
          schemaVersion: 5,
          id: 'ws-a',
          kind: 'personal',
          name: 'A',
          sortIndex: 0,
          createdAt: '2026-04-30T10:00:00.000Z',
          updatedAt: '2026-04-30T10:00:00.000Z',
          orgId: 'org-test',
        },
      ],
      activeWorkspaceId: 'ws-a',
    });
    const entries = snapshotExtensionWorkspacePostStates();
    expect(entries).toHaveLength(1);
    expect(entries[0].workspaces.map((w) => w.id)).toEqual(['ws-a']);
    expect(entries[0].activeWorkspaceId).toBe('ws-a');
  });

  it('init replays the log: the snapshot answers after the hydration gate and the next mint exceeds the log', async () => {
    const log = new InMemoryMutationLog();
    const seed = seedExtensionWorkspaces(
      [
        {
          schemaVersion: 5,
          id: 'ws-logged',
          kind: 'personal',
          name: 'Logged',
          sortIndex: 0,
          createdAt: '2026-04-30T10:00:00.000Z',
          updatedAt: '2026-04-30T10:00:00.000Z',
          orgId: 'org-test',
        },
      ],
      'ws-logged',
      {
        workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
        hlc: { physicalMs: Date.now() + 60_000, logical: 0, nodeId: 'n-prior' },
        surfaceId: 's',
        deviceId: 'd',
      },
    );
    await log.appendAll(seed.mutations);
    const highest = seed.mutations[seed.mutations.length - 1].hlc;

    __initGlobalSyncServiceForTests({ log });
    await whenGlobalHydrated();

    const entries = snapshotExtensionWorkspacePostStates();
    expect(entries).toHaveLength(1);
    expect(entries[0].workspaces.map((w) => w.id)).toEqual(['ws-logged']);
    expect(entries[0].activeWorkspaceId).toBe('ws-logged');
    expect(nextGlobalSwContext().hlc.physicalMs).toBeGreaterThanOrEqual(highest.physicalMs);
  });

  it('emits global-scope context envelopes scoped by the sentinel id', () => {
    __initGlobalSyncServiceForTests();
    const ctx = nextGlobalSwContext();
    expect(ctx.workspaceId).toBe(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
    expect(ctx.surfaceId).toBe('sw');

    // Mint an envelope from the global context — its `workspaceId`
    // field should match the sentinel.
    const intent = setExtensionWorkspace(ctx, {
      slot: {
        id: 'ws-x',
        kind: 'personal',
        name: 'X',
        createdAt: '2026-04-30T10:00:00.000Z',
        updatedAt: '2026-04-30T10:00:00.000Z',
        orgId: 'org-test',
      },
      orderKey: 'm',
    });
    expect(intent.batch.mutations[0].workspaceId).toBe(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
  });

  it('dispose tears down the cache reference', () => {
    __initGlobalSyncServiceForTests();
    expect(getActiveExtensionWorkspaceCache()).not.toBeNull();
    disposeGlobal();
    expect(getActiveExtensionWorkspaceCache()).toBeNull();
    expect(getGlobalOracle()).toBeNull();
  });

  it('init is idempotent on repeated test re-entry', () => {
    __initGlobalSyncServiceForTests();
    const first = getGlobalOracle();
    __initGlobalSyncServiceForTests();
    const second = getGlobalOracle();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first); // test helper rebuilds; production initGlobalSyncService is idempotent
  });
});
