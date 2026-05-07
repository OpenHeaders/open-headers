/**
 * Renderer-side request-folder sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Folder envelopes
 * whose `requestFolderPostState` is undefined indicate either a
 * tombstoned folder or a folder whose parent linkage hasn't resolved
 * yet — drop the entry; the next broadcast that does carry post-state
 * restores it.
 */

import { REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface RequestFolderMirrorEntry {
  folder: V5.Folder;
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the folder's
   *  own `folders` set; read via `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RequestFolderMirrorListener = (folderUid: string) => void;

export interface RequestFolderSyncMirror {
  getRequestFolderMirror(folderUid: string): RequestFolderMirrorEntry | null;
  listRequestFolders(): V5.Folder[];
  liveOrderedSetItems(
    folderUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeRequestFolderMirror(
    folderUid: string,
    listener: RequestFolderMirrorListener,
  ): () => void;
  subscribeAny(listener: RequestFolderMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateRequestFolderSyncMirrorOptions = CreateFlatMirrorOptions;

export function createRequestFolderSyncMirror(
  workspaceId: string,
  options: CreateRequestFolderSyncMirrorOptions = {},
): RequestFolderSyncMirror {
  const core = createFlatEntityMirror<RequestFolderMirrorEntry>(
    {
      loggerTag: 'RequestFolderSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, requestFolderPostState } = event;
        if (envelope.body.type !== REQUEST_FOLDER_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!requestFolderPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            folder: requestFolderPostState.folder,
            setOrderKeys: requestFolderPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotRequestFolders', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.folder.uid,
          entry: { folder: e.folder, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getRequestFolderMirror: core.get,
    listRequestFolders: () =>
      core
        .list()
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeRequestFolderMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
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

const requestFolderSyncMirrorRegistry = createWorkspaceMirrorRegistry<RequestFolderSyncMirror>(
  (workspaceId) => createRequestFolderSyncMirror(workspaceId),
);

export function getRequestFolderSyncMirrorForWorkspace(workspaceId: string): RequestFolderSyncMirror {
  return requestFolderSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeRequestFolderSyncMirrorForWorkspace(workspaceId: string): void {
  requestFolderSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllRequestFolderSyncMirrors(): void {
  requestFolderSyncMirrorRegistry.disposeAll();
}
