/**
 * Renderer-side collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(collectionUid, { collection, varUids })` from each
 * `collectionPostState` payload, hydrates from
 * `oh.sync.snapshotCollections` on construction.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface CollectionMirrorEntry {
  collection: V5.Collection;
  /** Live variable uids. Set member identity is `variable.uid`; this
   *  array is the projected names list. */
  varUids: string[];
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the parent's
   *  `folders` set today; readers consume via `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type CollectionMirrorListener = (collectionUid: string) => void;

export interface CollectionSyncMirror {
  getCollectionMirror(collectionUid: string): CollectionMirrorEntry | null;
  liveVarNames(collectionUid: string): string[];
  liveOrderedSetItems(
    collectionUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeCollectionMirror(collectionUid: string, listener: CollectionMirrorListener): () => void;
  dispose(): void;
}

export type CreateCollectionSyncMirrorOptions = CreateFlatMirrorOptions;

export function createCollectionSyncMirror(
  workspaceId: string,
  options: CreateCollectionSyncMirrorOptions = {},
): CollectionSyncMirror {
  const core = createFlatEntityMirror<CollectionMirrorEntry>(
    {
      loggerTag: 'CollectionSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, collectionPostState } = event;
        if (envelope.body.type !== 'collection') return null;
        const uid = envelope.body.id;
        if (!collectionPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            collection: collectionPostState.collection,
            varUids: collectionPostState.varUids,
            setOrderKeys: collectionPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotCollections', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection, varUids: e.varUids, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getCollectionMirror: core.get,
    liveVarNames: (uid) => core.get(uid)?.varUids ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeCollectionMirror: core.subscribe,
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

const collectionSyncMirrorRegistry = createWorkspaceMirrorRegistry<CollectionSyncMirror>(
  (workspaceId) => createCollectionSyncMirror(workspaceId),
);

export function getCollectionSyncMirrorForWorkspace(workspaceId: string): CollectionSyncMirror {
  return collectionSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeCollectionSyncMirrorForWorkspace(workspaceId: string): void {
  collectionSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllCollectionSyncMirrors(): void {
  collectionSyncMirrorRegistry.disposeAll();
}
