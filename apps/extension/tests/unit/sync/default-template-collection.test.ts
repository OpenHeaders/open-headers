/**
 * `ensureDefaultTemplateCollection` — the consumed-workspace
 * initialization guard.
 *
 * A freshly adopted consumed workspace (join → adopt) must NOT get a
 * locally-minted "User Templates" collection from the initialization
 * callers (boot, workspace-coord swap): the owning backend ran the same
 * boot and its copy is in the catch-up stream — minting here races it
 * into a duplicate under a second uid, on both ends of the wire. The
 * lazy edit path (first template create) keeps the mint everywhere —
 * that's a real user gesture.
 */

import type { Org } from '@openheaders/core/types';
import {
  ensureDefaultTemplateCollection,
  getTemplateCollections,
  hydrateTemplatesFromStorage,
  __resetForTests as resetTemplateStore,
  wireTemplateCollectionSyncEngine,
} from '@openheaders/oracle/entity/template-store';
import { wsKeys } from '@openheaders/oracle/storage';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
} from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
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

async function bootWith(activeWorkspaceId: string, log?: InMemoryMutationLog): Promise<void> {
  seedStorageMany({
    'oh.workspaces': [workspace('ws-home', HOME_ORG_ID), workspace('ws-adopted', CONSUMED_ORG.id)],
    'oh.runtimeActive.active': activeWorkspaceId,
  });
  await bootstrapWorkspaces({ seedOnEmpty: true });
  setOracleHostHooks({ getActiveWorkspaceId });
  __initSyncServiceForTests(activeWorkspaceId, log ? { log } : {});
  await hydrateTemplatesFromStorage();
}

async function rowCount(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

beforeEach(async () => {
  installBackingStorage();
  await installHostStorage();
  resetWorkspaceStore();
  resetTemplateStore();
  installTestIdentitySnapshot(HOME_ORG_ID, [CONSUMED_ORG]);
});

afterEach(() => {
  disposeSyncService();
  setOracleHostHooks({});
  resetTemplateStore();
  resetWorkspaceStore();
  clearTestIdentitySnapshot();
});

describe('ensureDefaultTemplateCollection', () => {
  it('initialization does not mint in a consumed workspace (the backend owns the default)', async () => {
    await bootWith('ws-adopted');
    const result = await ensureDefaultTemplateCollection('initialization');
    expect(result).toBeNull();
    expect(getTemplateCollections()).toHaveLength(0);
  });

  it('initialization still mints in a home-Org workspace', async () => {
    await bootWith('ws-home');
    const result = await ensureDefaultTemplateCollection('initialization');
    expect(result?.name).toBe('User Templates');
    expect(getTemplateCollections()).toHaveLength(1);
  });

  it('the edit path mints even in a consumed workspace (a real user gesture syncs up)', async () => {
    await bootWith('ws-adopted');
    const result = await ensureDefaultTemplateCollection();
    expect(result.name).toBe('User Templates');
  });

  it('initialization returns the synced-down copy when catch-up already landed it', async () => {
    await bootWith('ws-adopted');
    const minted = await ensureDefaultTemplateCollection();
    const result = await ensureDefaultTemplateCollection('initialization');
    expect(result?.uid).toBe(minted.uid);
  });

  it('a restart over the hydrated log finds the default in the oracle and mints nothing more', async () => {
    const log = new InMemoryMutationLog();
    await bootWith('ws-home', log);
    const minted = await ensureDefaultTemplateCollection('initialization');
    const rows = await rowCount(log);
    expect(rows).toBeGreaterThan(0);

    // A restart with the keys wiped too: the log alone restores the
    // collection into the cache, the wire copies it into the mirror.
    installBackingStorage();
    await installHostStorage();
    resetTemplateStore();
    resetWorkspaceStore();
    await bootWith('ws-home', log);
    expect(getTemplateCollections()).toHaveLength(0);
    const svc = getOrCreateWorkspaceService('ws-home');
    await svc.hydrated;
    releaseWorkspaceService('ws-home');
    wireTemplateCollectionSyncEngine();

    const result = await ensureDefaultTemplateCollection('initialization');
    expect(result?.uid).toBe(minted?.uid);
    expect(getTemplateCollections()).toHaveLength(1);
    expect(await rowCount(log)).toBe(rows);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readStorage<Array<{ uid: string }>>(wsKeys('ws-home').templateCollections.key)?.map((c) => c.uid)).toEqual([
      minted?.uid,
    ]);
  });
});
