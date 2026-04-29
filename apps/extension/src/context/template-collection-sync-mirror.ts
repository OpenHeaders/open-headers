/**
 * Renderer-side template-collection sync mirror (Phase B).
 *
 * Mirrors `request-collection-sync-mirror.ts`. Catalog ships rename-only
 * at v1 — entries carry the materialized `V5.Collection` only.
 */

import { type MutationEnvelope, TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface TemplateCollectionMirrorEntry {
  collection: V5.Collection;
}

export type TemplateCollectionMirrorListener = (collectionUid: string) => void;

export interface TemplateCollectionSyncMirror {
  getTemplateCollectionMirror(collectionUid: string): TemplateCollectionMirrorEntry | null;
  listTemplateCollections(): V5.Collection[];
  subscribeTemplateCollectionMirror(
    collectionUid: string,
    listener: TemplateCollectionMirrorListener,
  ): () => void;
  subscribeAny(listener: TemplateCollectionMirrorListener): () => void;
  dispose(): void;
}

export interface CreateTemplateCollectionSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createTemplateCollectionSyncMirror(
  options: CreateTemplateCollectionSyncMirrorOptions = {},
): TemplateCollectionSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, TemplateCollectionMirrorEntry>();
  const perUidListeners = new Map<string, Set<TemplateCollectionMirrorListener>>();
  const anyListeners = new Set<TemplateCollectionMirrorListener>();
  const seenSinceMount = new Set<string>();

  const handleEnvelope = (envelope: MutationEnvelope, collection: V5.Collection | null): void => {
    if (envelope.body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return;
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
    const { envelope, templateCollectionPostState } = event;
    handleEnvelope(envelope, templateCollectionPostState?.collection ?? null);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotTemplateCollections')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.collection.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { collection: entry.collection });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('TemplateCollectionSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getTemplateCollectionMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listTemplateCollections() {
      return Array.from(entries.values())
        .map((e) => e.collection)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeTemplateCollectionMirror(uid, listener) {
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
  perUid: Map<string, Set<TemplateCollectionMirrorListener>>,
  any: Set<TemplateCollectionMirrorListener>,
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

let active: TemplateCollectionSyncMirror | null = null;

export function getActiveTemplateCollectionSyncMirror(): TemplateCollectionSyncMirror {
  if (!active) active = createTemplateCollectionSyncMirror();
  return active;
}

export function disposeActiveTemplateCollectionSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
