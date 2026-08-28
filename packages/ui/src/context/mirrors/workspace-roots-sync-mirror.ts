/**
 * Renderer-side workspace-roots sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror} for the top of
 * the three sidebar trees — the collection order per tree and the
 * per-uid order keys the collection write clients append after. The
 * trees themselves read collection order off the persisted arrays
 * (the caches persist roots order); this mirror is the write side's
 * tail source.
 */

import { keyBetween, WORKSPACE_ROOTS_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WorkspaceRoots } from '@openheaders/core/types';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { type CreateSingletonMirrorOptions, createSingletonEntityMirror } from './singleton-entity-mirror';
import { callSnapshotRpc } from './snapshot-rpc';

export interface WorkspaceRootsMirrorEntry {
  workspaceRoots: WorkspaceRoots;
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type WorkspaceRootsMirrorListener = () => void;

export interface WorkspaceRootsSyncMirror {
  getMirror(): WorkspaceRootsMirrorEntry | null;
  /** Live `(itemId, orderKey)` pairs of one tree's collection set. */
  liveOrderedSetItems(rootsPath: string): Array<{ itemId: string; orderKey: string }>;
  /** The key a new collection takes to land strictly after the tree's live tail. */
  appendOrderKey(rootsPath: string): string;
  subscribeMirror(listener: WorkspaceRootsMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateWorkspaceRootsSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createWorkspaceRootsSyncMirror(
  workspaceId: string,
  options: CreateWorkspaceRootsSyncMirrorOptions = {},
): WorkspaceRootsSyncMirror {
  const core = createSingletonEntityMirror<WorkspaceRootsMirrorEntry>(
    {
      loggerTag: 'WorkspaceRootsSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, workspaceRootsPostState } = event;
        if (envelope.body.type !== WORKSPACE_ROOTS_ENTITY_TYPE) return null;
        if (!workspaceRootsPostState) return 'tombstone';
        return {
          workspaceRoots: workspaceRootsPostState.workspaceRoots,
          setOrderKeys: workspaceRootsPostState.setOrderKeys,
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotWorkspaceRoots', { workspaceId });
        const first = resp.entries[0];
        return first ? { workspaceRoots: first.workspaceRoots, setOrderKeys: first.setOrderKeys } : null;
      },
    },
    options,
  );
  const liveOrderedSetItems = (rootsPath: string): Array<{ itemId: string; orderKey: string }> =>
    core.get()?.setOrderKeys[rootsPath] ?? [];
  return {
    getMirror: core.get,
    liveOrderedSetItems,
    appendOrderKey: (rootsPath) => keyBetween(liveOrderedSetItems(rootsPath).at(-1)?.orderKey ?? null, null),
    subscribeMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const workspaceRootsSyncMirrorRegistry = createWorkspaceMirrorRegistry<WorkspaceRootsSyncMirror>((workspaceId) =>
  createWorkspaceRootsSyncMirror(workspaceId),
);

export function getWorkspaceRootsSyncMirrorForWorkspace(workspaceId: string): WorkspaceRootsSyncMirror {
  return workspaceRootsSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeWorkspaceRootsSyncMirrorForWorkspace(workspaceId: string): void {
  workspaceRootsSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllWorkspaceRootsSyncMirrors(): void {
  workspaceRootsSyncMirrorRegistry.disposeAll();
}
