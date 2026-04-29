/**
 * Renderer-side collection sync mirror (Phase B).
 *
 * Mirrors `env-sync-mirror.ts`: subscribes once to the SW's
 * `syncBroadcast` channel and folds every `collectionPostState` payload
 * into a `Map<collectionUid, { collection, varNames }>`. Renderer write
 * helpers read this mirror to build collection mutation batches
 * synchronously without a SW round-trip per write (§19.4). On
 * construction the mirror fires a `oh.sync.snapshotCollections` RPC so
 * it has a starting view before any broadcast arrives. The
 * subscription is registered first so any concurrent broadcast that
 * lands mid-flight wins.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface CollectionMirrorEntry {
  collection: V5.Collection;
  /** Live variable names (set member identity = variable name). */
  varNames: string[];
}

export type CollectionMirrorListener = (collectionUid: string) => void;

export interface CollectionSyncMirror {
  getCollectionMirror(collectionUid: string): CollectionMirrorEntry | null;
  /** Live variable names at the collection, `[]` when unknown. */
  liveVarNames(collectionUid: string): string[];
  subscribeCollectionMirror(collectionUid: string, listener: CollectionMirrorListener): () => void;
  dispose(): void;
}

export interface CreateCollectionSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createCollectionSyncMirror(
  options: CreateCollectionSyncMirrorOptions = {},
): CollectionSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, CollectionMirrorEntry>();
  const listeners = new Map<string, Set<CollectionMirrorListener>>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, collectionPostState } = event;
    if (envelope.body.type !== 'collection') return;
    const collectionUid = envelope.body.id;
    seenSinceMount.add(collectionUid);

    if (!collectionPostState) {
      if (entries.delete(collectionUid)) notify(listeners, collectionUid);
      return;
    }

    entries.set(collectionUid, {
      collection: collectionPostState.collection,
      varNames: collectionPostState.varNames,
    });
    notify(listeners, collectionUid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotCollections')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.collection.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { collection: entry.collection, varNames: entry.varNames });
          notify(listeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('CollectionSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getCollectionMirror(uid) {
      return entries.get(uid) ?? null;
    },
    liveVarNames(uid) {
      return entries.get(uid)?.varNames ?? [];
    },
    subscribeCollectionMirror(uid, listener) {
      let bucket = listeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        listeners.set(uid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = listeners.get(uid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) listeners.delete(uid);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      listeners.clear();
    },
  };
}

function notify(
  listeners: Map<string, Set<CollectionMirrorListener>>,
  collectionUid: string,
): void {
  const bucket = listeners.get(collectionUid);
  if (!bucket) return;
  for (const l of bucket) {
    try {
      l(collectionUid);
    } catch {
      // Listener errors must not tear down the broadcast pipe.
    }
  }
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
