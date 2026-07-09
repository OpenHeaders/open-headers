/**
 * `evictConsumedWorkspace` — the Discard leg's host-local eviction
 * (multi-backend §4). Pins the mechanism that makes "re-joining syncs
 * them down again" hold:
 *
 *   - no synced remove mutation is minted (no tombstone anywhere);
 *   - the evicted org's rows leave BOTH log stripes (`__global__` +
 *     the workspace's own), so a re-join state vector stops claiming
 *     the backend's HLCs;
 *   - the backend's ORIGINAL envelope — same mutationId, same old HLC
 *     — re-applies after the eviction and re-materializes the
 *     workspace (dedup ids forgotten alongside the purge);
 *   - locally-minted rows (other orgs) survive the purge;
 *   - the active pointer flips to a survivor when the evicted
 *     workspace was active;
 *   - persisted `oh.workspaces` is rewritten without the entry.
 */

import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { type BlobBackend, setBlobBackend } from '@openheaders/oracle/files';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import {
  __initGlobalSyncServiceForTests,
  disposeGlobal,
  getGlobalOracle,
} from '@openheaders/oracle/sync/global-service';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  __initSyncServiceForTests,
  __setWireDepsFactoryForTests,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { evictConsumedWorkspace } from '@openheaders/oracle/workspace/workspace-eviction';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installBackingStorage,
  installHostStorage,
  readStorage,
  seedStorageMany,
} from '../../helpers/chrome-storage-backing';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const HOME_ORG_ID = '01900000-0000-7000-8000-0000000000aa';
const CONSUMED_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Daemon Org',
  hostKind: 'daemon',
  isPrivate: false,
};

function workspace(id: string, orgId: string) {
  return {
    schemaVersion: 5,
    version: 1,
    id,
    kind: 'personal',
    name: id,
    sortIndex: 0,
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
    orgId,
  };
}

const adoptedSlot: ExtensionWorkspaceSlot = {
  id: 'ws-adopted',
  kind: 'personal',
  name: 'ws-adopted',
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
  orgId: CONSUMED_ORG.id,
};

/** The backend's own addToSet — old HLC, daemon nodeId, consumed org. */
const daemonAddEnvelope = (): MutationEnvelope => ({
  mutationId: 'daemon-add-ws-adopted',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'daemon-node' },
  origin: { surfaceId: 'daemon', deviceId: 'daemon-node' },
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  orgId: CONSUMED_ORG.id,
  mutatorVersion: 1,
  body: {
    kind: 'addToSet',
    type: EXTENSION_WORKSPACE_ENTITY_TYPE,
    id: EXTENSION_WORKSPACE_ID,
    path: EXTENSION_WORKSPACES_SET_PATH,
    itemId: 'ws-adopted',
    item: adoptedSlot,
    orderKey: 'a1',
  },
});

/** A daemon-minted per-workspace envelope in ws-adopted's own stripe. */
const daemonWorkspaceEnvelope = (): MutationEnvelope => ({
  mutationId: 'daemon-rule-create',
  hlc: { physicalMs: 1_500, logical: 0, nodeId: 'daemon-node' },
  origin: { surfaceId: 'daemon', deviceId: 'daemon-node' },
  workspaceId: 'ws-adopted',
  orgId: CONSUMED_ORG.id,
  mutatorVersion: 1,
  body: { kind: 'create', type: 'rule', id: 'r1', payload: { name: 'daemon rule' } },
});

let globalLog: InMemoryMutationLog;
let scopeLogs: Map<string, InMemoryMutationLog>;

const collect = async (it: AsyncIterable<MutationEnvelope>): Promise<MutationEnvelope[]> => {
  const out: MutationEnvelope[] = [];
  for await (const e of it) out.push(e);
  return out;
};

async function boot(activeWorkspaceId: string): Promise<void> {
  seedStorageMany({
    'oh.workspaces': [workspace('ws-home', HOME_ORG_ID), workspace('ws-adopted', CONSUMED_ORG.id)],
    'oh.runtimeActive.active': activeWorkspaceId,
  });
  await bootstrapWorkspaces();
  setOracleHostHooks({ getActiveWorkspaceId });

  globalLog = new InMemoryMutationLog();
  __initGlobalSyncServiceForTests({ log: globalLog });
  await bridgeExtensionWorkspaceSyncEngine();

  // The backend's list entry arrives inbound and lands in the log.
  const oracle = getGlobalOracle();
  if (!oracle) throw new Error('global oracle not initialized');
  const applied = await oracle.apply({ batchId: 'daemon-b1', mutations: [daemonAddEnvelope()] }, [], 'inbound');
  expect(applied.ok).toBe(true);

  // Per-workspace services get their own logs; ws-adopted's stripe
  // carries a daemon envelope that must be purged by the eviction.
  __initSyncServiceForTests(activeWorkspaceId);
  scopeLogs = new Map();
  __setWireDepsFactoryForTests((id) => {
    let log = scopeLogs.get(id);
    if (!log) {
      log = new InMemoryMutationLog();
      scopeLogs.set(id, log);
    }
    return {
      workspaceId: id,
      log,
      intents: new InMemoryPendingIntents(),
      lock: (_ws, _t, _id, fn) => Promise.resolve().then(fn),
      recompile: () => {},
      sink: () => {},
      awarenessSink: () => {},
    };
  });
  const adoptedLog = new InMemoryMutationLog();
  await adoptedLog.append(daemonWorkspaceEnvelope());
  scopeLogs.set('ws-adopted', adoptedLog);
}

// The per-workspace purge routes through the blob store; the eviction
// test only needs it to not throw.
const noopBlobBackend: BlobBackend = {
  put: async () => {
    throw new Error('unused in eviction tests');
  },
  get: async () => null,
  getByHash: async () => null,
  list: async () => [],
  delete: async () => false,
  rename: async () => null,
  clearWorkspace: async () => {},
};

beforeEach(async () => {
  installBackingStorage();
  await installHostStorage();
  setBlobBackend(noopBlobBackend);
  resetWorkspaceStore();
  installTestIdentitySnapshot(HOME_ORG_ID, [CONSUMED_ORG]);
});

afterEach(() => {
  disposeSyncService();
  disposeGlobal();
  setOracleHostHooks({});
  resetWorkspaceStore();
  clearTestIdentitySnapshot();
});

describe('evictConsumedWorkspace', () => {
  it('removes the workspace without a tombstone — the original daemon envelope re-applies', async () => {
    await boot('ws-home');
    expect(
      listWorkspaces()
        .map((w) => w.id)
        .sort(),
    ).toEqual(['ws-adopted', 'ws-home']);

    const result = await evictConsumedWorkspace('ws-adopted');
    expect(result).toEqual({ ok: true });
    expect(listWorkspaces().map((w) => w.id)).toEqual(['ws-home']);
    expect(getWorkspace('ws-adopted')).toBeNull();

    // Re-join replays the SAME envelope — it must re-materialize the
    // workspace (a tombstoned delete would swallow it forever).
    const oracle = getGlobalOracle();
    const replay = await oracle?.apply({ batchId: 'daemon-b2', mutations: [daemonAddEnvelope()] }, [], 'inbound');
    expect(replay?.ok).toBe(true);
    expect(replay?.outcomes[0]?.outcome.status).toBe('applied');
    expect(
      listWorkspaces()
        .map((w) => w.id)
        .sort(),
    ).toEqual(['ws-adopted', 'ws-home']);
  });

  it('purges the evicted org from both log stripes and keeps other rows', async () => {
    await boot('ws-home');
    await evictConsumedWorkspace('ws-adopted');

    const globalRemainder = await collect(globalLog.readSince(null));
    expect(globalRemainder.some((e) => e.orgId === CONSUMED_ORG.id)).toBe(false);
    // The boot seed's locally-minted rows survive — only the evicted
    // org's rows leave the stripe.
    expect(globalRemainder.length).toBeGreaterThan(0);

    const adoptedLog = scopeLogs.get('ws-adopted');
    expect(adoptedLog).toBeDefined();
    if (adoptedLog) expect(await collect(adoptedLog.readSince(null))).toEqual([]);
  });

  it('flips the active pointer to a survivor when the evicted workspace was active', async () => {
    await boot('ws-adopted');
    expect(getActiveWorkspaceId()).toBe('ws-adopted');

    await evictConsumedWorkspace('ws-adopted');
    expect(getActiveWorkspaceId()).toBe('ws-home');
  });

  it('rewrites persisted oh.workspaces without the evicted entry', async () => {
    await boot('ws-home');
    await evictConsumedWorkspace('ws-adopted');
    // Persistence rides the cache sink's async write — settle it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = readStorage('oh.workspaces') as Array<{ id: string }>;
    expect(persisted.map((w) => w.id)).toEqual(['ws-home']);
  });

  it('reports not-found for an unknown workspace', async () => {
    await boot('ws-home');
    expect(await evictConsumedWorkspace('ws-ghost')).toEqual({ ok: false, reason: 'not-found' });
  });
});
