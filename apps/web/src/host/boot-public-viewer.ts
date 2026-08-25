/**
 * Anonymous public-viewer boot (the access-foundation plan §8 F5b) —
 * the `bootWebHost` sibling for `/public/<workspaceId>` loads. The tab
 * boots the same host-neutral oracle, but every backend is THROWAWAY
 * MEMORY: nothing an anonymous visit hydrates may land in the origin's
 * IDB (a signed-in session's replica lives there), and nothing needs
 * to survive a reload — the page re-fetches the payload.
 *
 * No wire, no login gate, no service worker: the viewer fetches the
 * published `snapshot.json` from the serving daemon's anonymous route,
 * mints a local workspace from the payload's meta, replays the
 * snapshot through the ordinary applier (the workspace-duplicate
 * pipeline), and mounts the Workbench read-only-by-construction —
 * local edits touch only the in-memory throwaway and vanish on reload.
 */

import {
  ensureSyntheticIdentity,
  getIdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  type PublicWorkspacePublication,
  PublicWorkspacePublicationSchema,
  publicWorkspaceSnapshotPath,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE, setWorkspaceOrgResolver } from '@openheaders/core/sync';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { applyWorkspaceSnapshot } from '@openheaders/oracle/sync/snapshot-applier';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import {
  bootstrap as bootstrapWorkspaces,
  createWorkspace,
  getActiveWorkspaceId,
  getWorkspace,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { hydrateActiveWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import * as v from 'valibot';
import { broadcastLocal } from './web-broadcast';

const SCOPE = 'boot-public-viewer';

/** Blob bytes never ride the public plane — the viewer's store is honest about it. */
const memoryBlobBackend = {
  put(): never {
    throw new Error('public view is read-only; file uploads are not available');
  },
  async get(): Promise<null> {
    return null;
  },
  async getByHash(): Promise<null> {
    return null;
  },
  async list(): Promise<[]> {
    return [];
  },
  async delete(): Promise<boolean> {
    return false;
  },
  async rename(): Promise<null> {
    return null;
  },
  async clearWorkspace(): Promise<void> {},
};

export type PublicViewerBootResult =
  | { ok: true; publication: PublicWorkspacePublication }
  | { ok: false; reason: 'not-found' | 'invalid-payload' | 'boot-failed' };

export async function bootPublicViewer(workspaceId: string): Promise<PublicViewerBootResult> {
  try {
    // 1. Throwaway backends — memory storage was installed at import
    //    time (`install-host-storage.ts` branches on the public path).
    setBlobBackend(memoryBlobBackend);
    setSyncPersistenceProvider({
      createMutationLog: () => new InMemoryMutationLog(),
      createPendingIntents: () => new InMemoryPendingIntents(),
    });

    // 2. Fetch the publication early — a dead link should answer
    //    before any oracle machinery spins up.
    const response = await fetch(publicWorkspaceSnapshotPath(workspaceId), { cache: 'no-cache' });
    if (!response.ok) return { ok: false, reason: 'not-found' };
    const parsed = v.safeParse(PublicWorkspacePublicationSchema, await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, reason: 'invalid-payload' };
    // Per-entity arrays stay `unknown[]` at the envelope boundary —
    // the applier's seed mutators validate item payloads (the
    // documented post-parse cast).
    const publication = parsed.output as unknown as PublicWorkspacePublication;

    // 3. The ordinary host-neutral boot over the memory backends.
    await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Public view' });
    setOracleHostHooks({
      getActiveWorkspaceId,
      peekActiveWorkspaceId,
      broadcastSyncEvent: (event) => broadcastLocal('syncBroadcast', event),
      broadcastAwareness: (event) => broadcastLocal('awarenessBroadcast', event),
      broadcastWorkspaceEvicted: (evictedId) => broadcastLocal('workspaceEvicted', { workspaceId: evictedId }),
    });
    await bootstrapWorkspaces({ seedOnEmpty: false });
    await refreshIdentitySnapshotFromHostStorage();
    setWorkspaceOrgResolver((wsId) => {
      const snapshot = getIdentitySnapshot();
      if (wsId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) return snapshot?.user.homeOrgId;
      return getWorkspace(wsId)?.orgId ?? snapshot?.user.homeOrgId;
    });
    await hydrateActiveWorkspaceStores();
    await bootSyncEngine();

    // 4. Mint the local copy and replay the snapshot into it — the
    //    workspace-duplicate pipeline, retargeted at a fresh local id.
    const created = await createWorkspace({
      name: publication.workspace.name,
      ...(publication.workspace.description !== undefined ? { description: publication.workspace.description } : {}),
      ...(publication.workspace.color !== undefined ? { color: publication.workspace.color } : {}),
      ...(publication.workspace.icon !== undefined ? { icon: publication.workspace.icon } : {}),
    });
    const retargeted: WorkspaceSnapshot = {
      ...(publication.snapshot as unknown as WorkspaceSnapshot),
      workspaceId: created.id,
    };
    const svc = getOrCreateWorkspaceService(created.id);
    try {
      await svc.hydrated;
      const applied = await applyWorkspaceSnapshot(retargeted, { makeContext: () => svc.context.next() });
      logger.info(SCOPE, `hydrated public snapshot of ${workspaceId} (${applied.entitiesApplied} entities)`);
    } finally {
      releaseWorkspaceService(created.id);
    }
    await setActiveWorkspaceById(created.id);
    return { ok: true, publication };
  } catch (err) {
    logger.error(SCOPE, 'public viewer boot failed', err);
    return { ok: false, reason: 'boot-failed' };
  }
}
