/**
 * Renderer-side request-collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Catalog ships
 * rename-only at v1, so each entry carries the materialized
 * `V5.Collection` only — no `varNames` (additive growth path is to
 * mirror the rule-collection shape verbatim if/when collection
 * variables ship for requests).
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
}

export type RequestCollectionMirrorListener = (collectionUid: string) => void;

export interface RequestCollectionSyncMirror {
  getRequestCollectionMirror(collectionUid: string): RequestCollectionMirrorEntry | null;
  listRequestCollections(): V5.Collection[];
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
        return { uid, entry: { collection: requestCollectionPostState.collection } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotRequestCollections');
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection },
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
