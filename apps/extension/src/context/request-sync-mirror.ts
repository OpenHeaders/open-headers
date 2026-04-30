/**
 * Renderer-side request sync mirror (Phase B).
 *
 * Mirrors `rule-sync-mirror.ts`: subscribes once to the SW's
 * `syncBroadcast` channel and folds every `requestPostState` payload
 * into a `Map<requestUid, { request, setItemIds }>`. Renderer write
 * helpers consult this mirror to:
 *
 *   1. Read the canonical request shape synchronously (§19.4).
 *   2. Enumerate live `itemId`s at set-modeled paths (`headers`,
 *      `params`). Set replacement requires these — `buildUpdateBatch`
 *      emits `removeFromSet` per existing itemId and `addToSet` per
 *      new member.
 *
 * On construction the mirror fires `oh.sync.snapshotRequests` so the
 * starting view is populated before the first broadcast lands; any
 * concurrent broadcast that arrives mid-flight wins (it carries fresher
 * post-commit state than the snapshot can).
 */

import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface RequestMirrorEntry {
  request: V5.Request;
  /** Map keyed by set path (e.g. `headers`, `params`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RequestMirrorListener = (uid: string) => void;

export interface RequestSyncMirror {
  getRequestMirror(uid: string): RequestMirrorEntry | null;
  /** Snapshot of every known request, in stable uid order. */
  listRequests(): V5.Request[];
  /** Live itemIds at a set path on the request. Returns `[]` when the
   *  mirror has no entry for `uid` or the path has no members. Same
   *  shape the SW oracle exposes via `liveSetItems`, so write helpers
   *  duck-type either. */
  liveSetItems(uid: string, setPath: string): string[];
  /** Live `(itemId, orderKey)` pairs at a set path on the request, in
   *  canonical sort order. Returns `[]` when the mirror has no entry
   *  for `uid` or the path has no members. The write-client's
   *  pure-reorder detector reads these to compute `keyBetween(prev,
   *  next)` for `moveBefore` envelopes. */
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeRequestMirror(uid: string, listener: RequestMirrorListener): () => void;
  /** Subscribe to *any* request change — listener receives the uid that
   *  moved. Sidebar tree consumers want this signal. */
  subscribeAny(listener: RequestMirrorListener): () => void;
  dispose(): void;
}

export interface CreateRequestSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createRequestSyncMirror(
  options: CreateRequestSyncMirrorOptions = {},
): RequestSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, RequestMirrorEntry>();
  const perUidListeners = new Map<string, Set<RequestMirrorListener>>();
  const anyListeners = new Set<RequestMirrorListener>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, requestPostState } = event;
    const uid = envelope.body.id;
    // Only honor envelopes that target the Request entity. Non-Request
    // broadcasts arrive with `requestPostState === undefined`; they
    // mustn't tombstone our entries (rule / collection / vault all
    // share this same channel).
    if (!requestPostState && envelope.body.type !== REQUEST_ENTITY_TYPE) return;

    seenSinceMount.add(uid);
    if (!requestPostState) {
      // Tombstone — drop our entry.
      if (entries.delete(uid)) notify(perUidListeners, anyListeners, uid);
      return;
    }
    entries.set(uid, {
      request: requestPostState.request,
      setItemIds: requestPostState.setItemIds,
      setOrderKeys: requestPostState.setOrderKeys,
    });
    notify(perUidListeners, anyListeners, uid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotRequests')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.request.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, {
            request: entry.request,
            setItemIds: entry.setItemIds,
            setOrderKeys: entry.setOrderKeys,
          });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('RequestSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getRequestMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listRequests() {
      return Array.from(entries.values())
        .map((e) => e.request)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    liveSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setItemIds[setPath] ?? [];
    },
    liveOrderedSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setOrderKeys[setPath] ?? [];
    },
    subscribeRequestMirror(uid, listener) {
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
  perUid: Map<string, Set<RequestMirrorListener>>,
  any: Set<RequestMirrorListener>,
  uid: string,
): void {
  const bucket = perUid.get(uid);
  if (bucket) {
    for (const l of bucket) {
      try {
        l(uid);
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }
  for (const l of any) {
    try {
      l(uid);
    } catch {
      // Same as above.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────

let active: RequestSyncMirror | null = null;

export function getActiveRequestSyncMirror(): RequestSyncMirror {
  if (!active) active = createRequestSyncMirror();
  return active;
}

export function disposeActiveRequestSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
