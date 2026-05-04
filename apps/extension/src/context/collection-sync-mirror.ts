/**
 * Renderer-side collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}: extracts
 * `(collectionUid, { collection, varNames })` from each
 * `collectionPostState` payload, hydrates from
 * `oh.sync.snapshotCollections` on construction.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface CollectionMirrorEntry {
  collection: V5.Collection;
  /** Live variable names. Set member identity is `variable.uid`; this
   *  array is the projected names list. */
  varNames: string[];
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
  options: CreateCollectionSyncMirrorOptions = {},
): CollectionSyncMirror {
  const core = createFlatEntityMirror<CollectionMirrorEntry>(
    {
      loggerTag: 'CollectionSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, collectionPostState } = event;
        if (envelope.body.type !== 'collection') return null;
        const uid = envelope.body.id;
        if (!collectionPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            collection: collectionPostState.collection,
            varNames: collectionPostState.varNames,
            setOrderKeys: collectionPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotCollections');
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection, varNames: e.varNames, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getCollectionMirror: core.get,
    liveVarNames: (uid) => core.get(uid)?.varNames ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeCollectionMirror: core.subscribe,
    dispose: core.dispose,
  };
}

// ── Module-level singleton ───────────────────────────────────────────

let active: CollectionSyncMirror | null = null;

export function getActiveCollectionSyncMirror(): CollectionSyncMirror {
  if (!active) active = createCollectionSyncMirror();
  return active;
}

export function disposeActiveCollectionSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
