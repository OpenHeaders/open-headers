/**
 * Renderer-side request-collection sync mirror (Phase B).
 *
 * Mirrors `collection-sync-mirror.ts` but routed through the
 * request-collection entity type. Catalog ships rename-only at v1, so
 * each entry carries the materialized `V5.Collection` only — no
 * `varNames` (additive growth path is to copy the rule-collection
 * shape verbatim).
 */

import { type MutationEnvelope, REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface RequestCollectionMirrorEntry {
  collection: V5.Collection;
}

export type RequestCollectionMirrorListener = (collectionUid: string) => void;

export interface RequestCollectionSyncMirror {
  getRequestCollectionMirror(collectionUid: string): RequestCollectionMirrorEntry | null;
  /** Snapshot of every known request collection in stable uid order. */
  listRequestCollections(): V5.Collection[];
  subscribeRequestCollectionMirror(
    collectionUid: string,
    listener: RequestCollectionMirrorListener,
  ): () => void;
  subscribeAny(listener: RequestCollectionMirrorListener): () => void;
  dispose(): void;
}

export interface CreateRequestCollectionSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createRequestCollectionSyncMirror(
  options: CreateRequestCollectionSyncMirrorOptions = {},
): RequestCollectionSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, RequestCollectionMirrorEntry>();
  const perUidListeners = new Map<string, Set<RequestCollectionMirrorListener>>();
  const anyListeners = new Set<RequestCollectionMirrorListener>();
  const seenSinceMount = new Set<string>();

  const handleEnvelope = (envelope: MutationEnvelope, collection: V5.Collection | null): void => {
    if (envelope.body.type !== REQUEST_COLLECTION_ENTITY_TYPE) return;
    const collectionUid = envelope.body.id;
    seenSinceMount.add(collectionUid);
    if (!collection) {
      if (entries.delete(collectionUid)) notify(perUidListeners, anyListeners, collectionUid);
      return;
    }
    entries.set(collectionUid, { collection });
    notify(perUidListeners, anyListeners, collectionUid);
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, requestCollectionPostState } = event;
    handleEnvelope(envelope, requestCollectionPostState?.collection ?? null);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotRequestCollections')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.collection.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { collection: entry.collection });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('RequestCollectionSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getRequestCollectionMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listRequestCollections() {
      return Array.from(entries.values())
        .map((e) => e.collection)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeRequestCollectionMirror(uid, listener) {
      let bucket = perUidListeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        perUidListeners.set(uid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = perUidListeners.get(uid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) perUidListeners.delete(uid);
      };
    },
    subscribeAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      perUidListeners.clear();
      anyListeners.clear();
    },
  };
}

function notify(
  perUid: Map<string, Set<RequestCollectionMirrorListener>>,
  any: Set<RequestCollectionMirrorListener>,
  collectionUid: string,
): void {
  const bucket = perUid.get(collectionUid);
  if (bucket) {
    for (const l of bucket) {
      try {
        l(collectionUid);
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }
  for (const l of any) {
    try {
      l(collectionUid);
    } catch {
      // Same.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────

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
