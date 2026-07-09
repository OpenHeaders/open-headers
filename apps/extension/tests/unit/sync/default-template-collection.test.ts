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
} from '@openheaders/oracle/entity/template-store';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installBackingStorage, installHostStorage, seedStorageMany } from '../../helpers/chrome-storage-backing';
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

async function bootWith(activeWorkspaceId: string): Promise<void> {
  seedStorageMany({
    'oh.workspaces': [workspace('ws-home', HOME_ORG_ID), workspace('ws-adopted', CONSUMED_ORG.id)],
    'oh.runtimeActive.active': activeWorkspaceId,
  });
  await bootstrapWorkspaces();
  setOracleHostHooks({ getActiveWorkspaceId });
  __initSyncServiceForTests(activeWorkspaceId);
  await hydrateTemplatesFromStorage();
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
});
