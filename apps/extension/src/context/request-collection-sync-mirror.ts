/**
 * Renderer-side request-collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Each entry carries
 * the materialized `V5.Collection`, the live `varUids` (set-member
 * identity for request-collection vars; consumed by the
 * variables-replacement diff helper to enumerate `removeFromSet`
 * itemIds), and the parent-owned `folders` set order keys.
 */

import { REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface RequestCollectionMirrorEntry {
  collection: V5.Collection;
  /** Live variable uids — set-member identity for request-collection vars. */
  varUids: string[];
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the parent's
   *  `folders` set; read via `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RequestCollectionMirrorListener = (collectionUid: string) => void;

export interface RequestCollectionSyncMirror {
  getRequestCollectionMirror(collectionUid: string): RequestCollectionMirrorEntry | null;
  listRequestCollections(): V5.Collection[];
  liveOrderedSetItems(
    collectionUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeRequestCollectionMirror(
    collectionUid: string,
    listener: RequestCollectionMirrorListener,
  ): () => void;
  subscribeAny(listener: RequestCollectionMirrorListener): () => void;
  dispose(): void;
}

export type CreateRequestCollectionSyncMirrorOptions = CreateFlatMirrorOptions;

export function createRequestCollectionSyncMirror(
  options: CreateRequestCollectionSyncMirrorOptions = {},
): RequestCollectionSyncMirror {
  const core = createFlatEntityMirror<RequestCollectionMirrorEntry>(
    {
      loggerTag: 'RequestCollectionSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, requestCollectionPostState } = event;
        if (envelope.body.type !== REQUEST_COLLECTION_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!requestCollectionPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            collection: requestCollectionPostState.collection,
            varUids: requestCollectionPostState.varUids,
            setOrderKeys: requestCollectionPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotRequestCollections');
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection, varUids: e.varUids, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getRequestCollectionMirror: core.get,
    listRequestCollections: () =>
      core
        .list()
        .map((e) => e.collection)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeRequestCollectionMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

let active: RequestCollectionSyncMirror | null = null;

export function getActiveRequestCollectionSyncMirror(): RequestCollectionSyncMirror {
  if (!active) active = createRequestCollectionSyncMirror();
  return active;
}

export function disposeActiveRequestCollectionSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
