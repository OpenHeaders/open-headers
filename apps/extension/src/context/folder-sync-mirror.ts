/**
 * Renderer-side folder sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(folderUid, { folder })` from each `folderPostState` payload.
 * Folder envelopes whose post-state is undefined indicate a tombstoned
 * folder OR one whose parent linkage hasn't resolved yet — the
 * conservative policy is to drop the entry; the next broadcast that
 * does carry post-state restores it.
 */

import { FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface FolderMirrorEntry {
  folder: V5.Folder;
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the folder's
   *  own `folders` set (slots for nested child folders); read via
   *  `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type FolderMirrorListener = (folderUid: string) => void;

export interface FolderSyncMirror {
  getFolderMirror(folderUid: string): FolderMirrorEntry | null;
  /** Snapshot of every known folder, in stable uid order. */
  listFolders(): V5.Folder[];
  liveOrderedSetItems(
    folderUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeFolderMirror(folderUid: string, listener: FolderMirrorListener): () => void;
  /** Subscribe to *any* folder change. */
  subscribeAny(listener: FolderMirrorListener): () => void;
  dispose(): void;
}

export type CreateFolderSyncMirrorOptions = CreateFlatMirrorOptions;

export function createFolderSyncMirror(
  workspaceId: string,
  options: CreateFolderSyncMirrorOptions = {},
): FolderSyncMirror {
  const core = createFlatEntityMirror<FolderMirrorEntry>(
    {
      loggerTag: 'FolderSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, folderPostState } = event;
        if (envelope.body.type !== FOLDER_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!folderPostState) return { uid, entry: null };
        return {
          uid,
          entry: { folder: folderPostState.folder, setOrderKeys: folderPostState.setOrderKeys },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotFolders', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.folder.uid,
          entry: { folder: e.folder, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getFolderMirror: core.get,
    listFolders: () =>
      core
        .list()
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeFolderMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's `services: Map<workspaceId,
// WorkspaceServiceState>` (commit 1, sub-commit 1a). Each workspace's
// mirror is independent: its bridge subscription filters by
// `event.envelope.workspaceId` at the shared mirror core (M-2), and
// its bootstrap snapshot is fetched scoped to the workspace via
// `oh.sync.snapshotX, { workspaceId }` (M-1). Cross-workspace
// contamination is structurally inexpressible.

const folderSyncMirrorRegistry = createWorkspaceMirrorRegistry<FolderSyncMirror>(
  (workspaceId) => createFolderSyncMirror(workspaceId),
);

export function getFolderSyncMirrorForWorkspace(workspaceId: string): FolderSyncMirror {
  return folderSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeFolderSyncMirrorForWorkspace(workspaceId: string): void {
  folderSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllFolderSyncMirrors(): void {
  folderSyncMirrorRegistry.disposeAll();
}
