/**
 * `installHomeOrgFloor` — a host that declared `seedOnEmpty` keeps a
 * workspace in its home Org at runtime. Pinned:
 *
 *   - a delete that empties the home Org (the SW-internal path, which
 *     skips the surface gate exactly like a peer's delete does) is
 *     answered by a fresh default workspace in the home Org;
 *   - the active pointer flips to the seed only when nothing live is
 *     active; a survivor in another Org keeps the pointer;
 *   - a delete that leaves the home Org non-empty seeds nothing;
 *   - a consumed Org emptying seeds nothing — the floor is the home Org's.
 */

import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { __initGlobalSyncServiceForTests, disposeGlobal } from '@openheaders/oracle/sync/global-service';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  DEFAULT_WORKSPACE_NAME,
  deleteWorkspace,
  getActiveWorkspaceId,
  listWorkspaces,
  peekActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { installHomeOrgFloor } from '@openheaders/oracle/workspace/home-org-floor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBackingStorage, installHostStorage, seedStorageMany } from '../../helpers/chrome-storage-backing';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const HOME_ORG_ID = '01900000-0000-7000-8000-0000000000aa';
const CONSUMED_ORG = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Desktop Org',
  hostKind: 'desktop',
  isPrivate: false,
} as const;

function workspace(id: string, orgId: string, sortIndex: number) {
  return {
    schemaVersion: 5,
    version: 1,
    id,
    kind: 'personal',
    name: id,
    sortIndex,
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    orgId,
  };
}

let unsubscribeFloor: (() => void) | null = null;

async function boot(workspaces: ReturnType<typeof workspace>[], activeWorkspaceId: string): Promise<void> {
  seedStorageMany({ 'oh.workspaces': workspaces, 'oh.runtimeActive.active': activeWorkspaceId });
  await bootstrapWorkspaces({ seedOnEmpty: true });
  setOracleHostHooks({ getActiveWorkspaceId });
  __initGlobalSyncServiceForTests({ log: new InMemoryMutationLog() });
  await bridgeExtensionWorkspaceSyncEngine();
  __initSyncServiceForTests(activeWorkspaceId);
  unsubscribeFloor = installHomeOrgFloor();
}

const homeWorkspaces = () => listWorkspaces().filter((ws) => ws.orgId === HOME_ORG_ID);

beforeEach(async () => {
  installBackingStorage();
  await installHostStorage();
  resetWorkspaceStore();
  installTestIdentitySnapshot(HOME_ORG_ID, [CONSUMED_ORG]);
});

afterEach(() => {
  unsubscribeFloor?.();
  unsubscribeFloor = null;
  disposeSyncService();
  disposeGlobal();
  setOracleHostHooks({});
  resetWorkspaceStore();
  clearTestIdentitySnapshot();
});

describe('installHomeOrgFloor', () => {
  it('re-seeds the home Org when its last workspace is deleted, keeping a live survivor active', async () => {
    await boot([workspace('ws-home', HOME_ORG_ID, 0), workspace('ws-desktop', CONSUMED_ORG.id, 1)], 'ws-home');

    await deleteWorkspace('ws-home');

    await vi.waitFor(() => expect(homeWorkspaces()).toHaveLength(1));
    const seeded = homeWorkspaces()[0];
    expect(seeded.id).not.toBe('ws-home');
    expect(seeded.name).toBe(DEFAULT_WORKSPACE_NAME);
    // The delete already flipped the pointer to the surviving desktop
    // workspace; the floor leaves a live pointer alone.
    expect(peekActiveWorkspaceId()).toBe('ws-desktop');
  });

  it('points the active workspace at the seed when the delete left nothing live', async () => {
    await boot([workspace('ws-only', HOME_ORG_ID, 0)], 'ws-only');

    await deleteWorkspace('ws-only');

    await vi.waitFor(() => expect(homeWorkspaces()).toHaveLength(1));
    await vi.waitFor(() => expect(peekActiveWorkspaceId()).toBe(homeWorkspaces()[0].id));
  });

  it('seeds nothing while the home Org still holds a workspace', async () => {
    await boot([workspace('ws-a', HOME_ORG_ID, 0), workspace('ws-b', HOME_ORG_ID, 1)], 'ws-a');

    await deleteWorkspace('ws-a');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(homeWorkspaces().map((ws) => ws.id)).toEqual(['ws-b']);
  });

  it('seeds nothing when a consumed Org empties — the floor is the home Org only', async () => {
    await boot([workspace('ws-home', HOME_ORG_ID, 0), workspace('ws-desktop', CONSUMED_ORG.id, 1)], 'ws-home');

    await deleteWorkspace('ws-desktop');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-home']);
  });
});
