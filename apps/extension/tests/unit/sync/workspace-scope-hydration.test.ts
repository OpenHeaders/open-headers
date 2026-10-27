/**
 * Every per-workspace scope boots from its log (the workspace-list scope
 * plan, Part 3). Pinned across simulated process restarts over ONE
 * in-memory log per workspace, with the `oh.ws.<id>.*` projection keys
 * persisting between boots the way the host's storage does:
 *
 *   - stored projections over an empty log migrate once — the tree
 *     entities as real commits, the slot reconciler healing their slots
 *     in the same boot — and every later materialization appends
 *     nothing and derives no intent;
 *   - a log that holds an entity wins over a stale key, and the key is
 *     rewritten from the oracle;
 *   - a slot-less leaf the log holds is healed by the hydration pass
 *     once;
 *   - a swap between two workspaces — the store swap, the Active flip,
 *     the bridge re-point, the default template ensure — appends
 *     nothing to either log once each has booted.
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type MutatorContext,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Rule } from '@openheaders/core/types';
import { __resetForTests as resetEnvironmentStore } from '@openheaders/oracle/entity/environment-store';
import { __resetForTests as resetFilesStore } from '@openheaders/oracle/entity/files-store';
import { __resetForTests as resetOAuthStore } from '@openheaders/oracle/entity/oauth-token-store';
import { __resetForTests as resetPauseMarkersStore } from '@openheaders/oracle/entity/pause-markers-store';
import {
  ensureDefaultTemplateCollection,
  getTemplateCollections,
  __resetForTests as resetTemplateStore,
} from '@openheaders/oracle/entity/template-store';
import { type BlobBackend, setBlobBackend } from '@openheaders/oracle/files';
import { reseedAllPerWorkspaceBridges } from '@openheaders/oracle/host-runtime';
import { __resetForTests as resetLiveValueStore } from '@openheaders/oracle/live/live-value-store';
import { type PersistedLocalFolder, wsKeys } from '@openheaders/oracle/storage';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import type { CollectionCache } from '@openheaders/oracle/sync/caches/collection-cache';
import type { FolderCache } from '@openheaders/oracle/sync/caches/folder-cache';
import type { LayoutStateCache } from '@openheaders/oracle/sync/caches/layout-state-cache';
import type { RuleCache } from '@openheaders/oracle/sync/caches/rule-cache';
import {
  COLLECTION_REGISTRATION,
  FOLDER_REGISTRATION,
  LAYOUT_STATE_REGISTRATION,
  RULE_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  __initSyncServiceForTests,
  __setWireDepsFactoryForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  setRuntimeActive,
  type WorkspaceServiceState,
} from '@openheaders/oracle/sync/service';
import { getCacheForWorkspace } from '@openheaders/oracle/sync/service/accessors';
import {
  bootstrap as bootstrapWorkspaces,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import {
  hydrateActiveWorkspaceStores,
  swapPerWorkspaceStores,
} from '@openheaders/oracle/workspace/workspace-coordinator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installBackingStorage,
  installHostStorage,
  readStorage,
  seedStorageMany,
} from '../../helpers/chrome-storage-backing';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-scope';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function rowCount(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

/** A context the way a pre-upgrade boot minted it: strictly increasing HLCs. */
let tick = 0;
const ctx = (): MutatorContext => {
  tick += 1;
  return {
    workspaceId: wsId,
    hlc: { physicalMs: 1_000 + tick, logical: 0, nodeId: 'pre-upgrade' },
    surfaceId: 'sw',
    deviceId: 'pre-upgrade',
  };
};

const makeCollection = (uid: string): Collection => ({
  schemaVersion: 5,
  uid,
  name: uid,
  path: `rules/api-${uid}`,
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
});

const makeFolder = (uid: string, parentPath: string): PersistedLocalFolder => ({
  schemaVersion: 5,
  uid,
  path: `${parentPath}/sub-${uid}`,
  name: 'Sub',
});

const makeRule = (uid: string, parentPath: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${uid}`,
    type: 'header',
    name: uid,
    enabled: true,
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['https://openheaders.io/*'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'override', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

const noopBlobBackend: BlobBackend = {
  put: async () => {
    throw new Error('unused in hydration tests');
  },
  get: async () => null,
  getByHash: async () => null,
  list: async () => [],
  delete: async () => false,
  rename: async () => null,
  clearWorkspace: async () => {},
};

const rules = (): Rule[] => getCacheForWorkspace<RuleCache>(RULE_REGISTRATION, wsId)?.getRules() ?? [];
const collections = (): Collection[] =>
  getCacheForWorkspace<CollectionCache>(COLLECTION_REGISTRATION, wsId)?.getCollections() ?? [];
const folders = () => getCacheForWorkspace<FolderCache>(FOLDER_REGISTRATION, wsId)?.getFolders() ?? [];
const layout = () => getCacheForWorkspace<LayoutStateCache>(LAYOUT_STATE_REGISTRATION, wsId)?.getSnapshot().layout;

beforeEach(async () => {
  installBackingStorage();
  await installHostStorage();
  setBlobBackend(noopBlobBackend);
  tick = 0;
});

afterEach(() => {
  disposeSyncService();
  setOracleHostHooks({});
  clearTestIdentitySnapshot();
});

describe('a per-workspace scope boots from its log', () => {
  interface Rig {
    log: InMemoryMutationLog;
    intents: InMemoryPendingIntents;
  }

  let rig: Rig;

  /** A process boot: memory gone, the keys and the log kept. */
  async function boot(): Promise<WorkspaceServiceState> {
    __initSyncServiceForTests(wsId, { log: rig.log, intents: rig.intents });
    const svc = getOrCreateWorkspaceService(wsId);
    await svc.hydrated;
    releaseWorkspaceService(wsId);
    await flush();
    return svc;
  }

  beforeEach(() => {
    installTestIdentitySnapshot();
    rig = { log: new InMemoryMutationLog(), intents: new InMemoryPendingIntents() };
  });

  it('migrates stored projections into an empty log once; later materializations append nothing', async () => {
    const coll = makeCollection('col00001');
    const folder = makeFolder('fol00001', coll.path);
    const inCollection = makeRule('rul00001', coll.path);
    const inFolder = makeRule('rul00002', folder.path);
    const panelLayout = { panes: ['left', 'right'] };
    const keys = wsKeys(wsId);
    seedStorageMany({
      [keys.collections.key]: [coll],
      [keys.folders.key]: [folder],
      [keys.rules.key]: [inCollection, inFolder],
      [keys.panelLayout.key]: panelLayout,
    });

    const first = await boot();

    const rows = await rowCount(rig.log);
    expect(rows).toBeGreaterThan(0);
    expect(collections().map((c) => c.uid)).toEqual(['col00001']);
    expect(folders().map((f) => f.uid)).toEqual(['fol00001']);
    expect(rules().map((r) => r.uid)).toEqual(['rul00001', 'rul00002']);
    expect(layout()).toEqual(panelLayout);
    // The reconciler's hydration pass slotted every migrated leaf in the same boot.
    const itemsOf = (type: string, uid: string) =>
      first.oracle.liveOrderedSetItems(type, uid, FOLDER_ITEMS_PATH).map((s) => s.itemId);
    expect(itemsOf(COLLECTION_ENTITY_TYPE, coll.uid)).toEqual(['rul00001']);
    expect(itemsOf(FOLDER_ENTITY_TYPE, folder.uid)).toEqual(['rul00002']);
    const intentsAfterFirst = await rig.intents.list();

    await boot();
    const third = await boot();

    expect(await rowCount(rig.log)).toBe(rows);
    expect(await rig.intents.list()).toEqual(intentsAfterFirst);
    expect(collections().map((c) => c.uid)).toEqual(['col00001']);
    expect(folders().map((f) => f.uid)).toEqual(['fol00001']);
    expect(rules().map((r) => r.uid)).toEqual(['rul00001', 'rul00002']);
    expect(layout()).toEqual(panelLayout);
    expect(
      third.oracle.liveOrderedSetItems(COLLECTION_ENTITY_TYPE, coll.uid, FOLDER_ITEMS_PATH).map((s) => s.itemId),
    ).toEqual(['rul00001']);
  });

  it('a log that holds the rules wins over a stale key, and the key is rewritten from the oracle', async () => {
    await boot();
    const live = makeRule('rul0live', 'rules/x');
    await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(live, ctx()) });
    await flush();
    const rows = await rowCount(rig.log);
    const key = wsKeys(wsId).rules.key;
    expect(readStorage<Rule[]>(key)?.map((r) => r.uid)).toEqual(['rul0live']);
    seedStorageMany({ [key]: [makeRule('rul0stal', 'rules/x')] });

    await boot();

    expect(rules().map((r) => r.uid)).toEqual(['rul0live']);
    expect(await rowCount(rig.log)).toBe(rows);
    expect(readStorage<Rule[]>(key)?.map((r) => r.uid)).toEqual(['rul0live']);
  });

  it('heals a slot-less leaf the log holds once, in the hydration pass', async () => {
    const coll = makeCollection('col00001');
    const rule = makeRule('rul00001', coll.path);
    await rig.log.appendAll([...seedCollection(coll, ctx()).mutations, ...seedRule(rule, ctx()).mutations]);
    const rows = await rowCount(rig.log);

    const svc = await boot();

    // One heal batch: the collection's roots slot and the rule's items slot.
    expect(
      svc.oracle
        .liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)
        .map((s) => s.itemId),
    ).toEqual(['col00001']);
    expect(
      svc.oracle.liveOrderedSetItems(COLLECTION_ENTITY_TYPE, coll.uid, FOLDER_ITEMS_PATH).map((s) => s.itemId),
    ).toEqual(['rul00001']);
    const healed = await rowCount(rig.log);
    expect(healed).toBe(rows + 2);

    await boot();
    expect(await rowCount(rig.log)).toBe(healed);
  });
});

describe('a swap between hydrated workspaces appends nothing', () => {
  const HOME_ORG_ID = '01900000-0000-7000-8000-0000000000aa';
  const workspace = (id: string, sortIndex: number) => ({
    schemaVersion: 5,
    id,
    kind: 'personal',
    name: id,
    sortIndex,
    createdAt: '2026-10-27T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
    orgId: HOME_ORG_ID,
  });

  let active = 'ws-a';
  const logs = new Map<string, InMemoryMutationLog>();
  const logFor = (id: string): InMemoryMutationLog => {
    let log = logs.get(id);
    if (!log) {
      log = new InMemoryMutationLog();
      logs.set(id, log);
    }
    return log;
  };

  beforeEach(async () => {
    logs.clear();
    active = 'ws-a';
    resetWorkspaceStore();
    resetTemplateStore();
    seedStorageMany({
      'oh.workspaces': [workspace('ws-a', 0), workspace('ws-b', 1)],
      'oh.runtimeActive.active': 'ws-a',
    });
    await bootstrapWorkspaces({ seedOnEmpty: true });
    installTestIdentitySnapshot(HOME_ORG_ID);
    setOracleHostHooks({ getActiveWorkspaceId: () => active });
    __initSyncServiceForTests('ws-a', { log: logFor('ws-a') });
    __setWireDepsFactoryForTests((id) => ({
      workspaceId: id,
      log: logFor(id),
      intents: new InMemoryPendingIntents(),
      lock: (_ws, _t, _id, fn) => Promise.resolve().then(fn),
      recompile: () => {},
      sink: () => {},
      awarenessSink: () => {},
    }));
  });

  afterEach(() => {
    resetTemplateStore();
    resetEnvironmentStore();
    resetPauseMarkersStore();
    resetFilesStore();
    resetOAuthStore();
    resetLiveValueStore();
    resetWorkspaceStore();
  });

  /** The coord runner's swap, as `bootSyncEngine` composes it. */
  async function switchTo(id: string): Promise<void> {
    active = id;
    await swapPerWorkspaceStores(id);
    const result = await setRuntimeActive(id);
    expect(result.ok).toBe(true);
    await reseedAllPerWorkspaceBridges();
    await ensureDefaultTemplateCollection('initialization');
    await flush();
  }

  it('the store swap, the Active flip, the bridge re-point and the template ensure read; nothing is minted twice', async () => {
    const svc = getOrCreateWorkspaceService('ws-a');
    await svc.hydrated;
    releaseWorkspaceService('ws-a');
    await hydrateActiveWorkspaceStores();
    await reseedAllPerWorkspaceBridges();
    const rowsBeforeDefault = await rowCount(logFor('ws-a'));
    await ensureDefaultTemplateCollection('initialization');
    await flush();
    const rowsA = await rowCount(logFor('ws-a'));
    expect(rowsA).toBeGreaterThan(rowsBeforeDefault);
    const defaultUid = getTemplateCollections()[0]?.uid;

    await switchTo('ws-b');
    const rowsB = await rowCount(logFor('ws-b'));
    expect(rowsB).toBeGreaterThan(0);
    expect(await rowCount(logFor('ws-a'))).toBe(rowsA);

    // A stale key on the way back: the log restores the default, not the key.
    seedStorageMany({ [wsKeys('ws-a').templateCollections.key]: [] });
    await switchTo('ws-a');
    expect(getTemplateCollections().map((c) => c.uid)).toEqual([defaultUid]);
    expect(await rowCount(logFor('ws-a'))).toBe(rowsA);
    expect(await rowCount(logFor('ws-b'))).toBe(rowsB);

    await switchTo('ws-b');
    expect(await rowCount(logFor('ws-b'))).toBe(rowsB);
    expect(await rowCount(logFor('ws-a'))).toBe(rowsA);
  });
});
