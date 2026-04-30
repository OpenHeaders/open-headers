/**
 * Renderer-side flat-entity sync mirror — shared core.
 *
 * Folds the broadcast → mirror → notify pipeline that every renderer
 * mirror for a multi-entity (uid-keyed) flat entity reproduces. Each
 * adapter provides only the per-entity bits — how to extract `(uid,
 * entry)` from a broadcast event, and how to fetch the bootstrap
 * snapshot — and exposes entity-named methods over the neutral core.
 *
 * Subscription discipline (kept identical to the pre-extraction
 * mirrors):
 *
 *   1. Register the bridge subscription synchronously, before kicking
 *      off any async snapshot fetch. A broadcast that lands while the
 *      snapshot is in-flight carries fresher post-commit state — the
 *      mirror records the uid in `seenSinceMount` and the snapshot
 *      handler skips re-applying the (older) snapshot row.
 *   2. Tombstones (post-state absent on a matching envelope) drop the
 *      entry and notify subscribers; per §7.2 a fresh recreate is a
 *      separate uid, so dropping the local entry can't collide.
 *   3. Listener errors are swallowed at the notify boundary so a
 *      broken consumer can't tear down the broadcast pipe for the
 *      others.
 *
 * Adapters keep their entity-named API surface (`getRuleMirror`,
 * `subscribeEnvironmentMirror`, `liveVarNames`, ...) by aliasing /
 * wrapping the core's neutral `get` / `subscribe` / `subscribeAny` /
 * `list` / `dispose` methods.
 */

import { type BridgeBroadcastPayload, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

/** Shape an adapter receives — the bridge payload, not the wire-level
 *  `SyncBroadcastEvent` (the `type` discriminator is added at the wire
 *  boundary). Adapters destructure `envelope` + the post-state field
 *  they own. */
export type SyncBroadcastPayload = BridgeBroadcastPayload<'syncBroadcast'>;

/**
 * Outcome of `extractFromBroadcast`:
 *   - `null` — envelope doesn't target this entity; the core skips it.
 *   - `{ uid, entry: null }` — tombstone (entity delete or post-state
 *     absent on a matching envelope); the core drops the entry.
 *   - `{ uid, entry }` — live update; the core stores the entry.
 */
export type ExtractResult<E> = { uid: string; entry: E | null } | null;

export interface FlatMirrorConfig<E> {
  loggerTag: string;
  /**
   * Pure extraction from a wire event. Adapters reach into the
   * post-state field they own and shape it into the mirror's `Entry`
   * type.
   */
  extractFromBroadcast: (event: SyncBroadcastPayload) => ExtractResult<E>;
  /**
   * Fetch the bootstrap snapshot. Adapters wrap `call('oh.sync.snapshotX')`
   * here so the typed bridge contract is preserved at the boundary.
   */
  fetchSnapshot: () => Promise<Array<{ uid: string; entry: E }>>;
}

export type FlatMirrorListener = (uid: string) => void;

export interface FlatMirrorCore<E> {
  get(uid: string): E | null;
  /** Unsorted; adapters add their own sort order if they need one. */
  list(): E[];
  subscribe(uid: string, listener: FlatMirrorListener): () => void;
  subscribeAny(listener: FlatMirrorListener): () => void;
  dispose(): void;
}

export interface CreateFlatMirrorOptions {
  /**
   * When true (default) the core fires the snapshot fetch on
   * construction. Tests that only drive broadcasts pass `false`.
   */
  bootstrap?: boolean;
}

export function createFlatEntityMirror<E>(
  config: FlatMirrorConfig<E>,
  options: CreateFlatMirrorOptions = {},
): FlatMirrorCore<E> {
  const { bootstrap = true } = options;
  const entries = new Map<string, E>();
  const perUidListeners = new Map<string, Set<FlatMirrorListener>>();
  const anyListeners = new Set<FlatMirrorListener>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const result = config.extractFromBroadcast(event);
    if (!result) return;
    const { uid, entry } = result;
    seenSinceMount.add(uid);
    if (entry === null) {
      if (entries.delete(uid)) notify(perUidListeners, anyListeners, uid);
      return;
    }
    entries.set(uid, entry);
    notify(perUidListeners, anyListeners, uid);
  });

  if (bootstrap) {
    void config
      .fetchSnapshot()
      .then((rows) => {
        for (const { uid, entry } of rows) {
          // A broadcast that landed mid-flight carries fresher
          // post-commit state — defer to it instead of overwriting.
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, entry);
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info(config.loggerTag, `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    get(uid) {
      return entries.get(uid) ?? null;
    },
    list() {
      return Array.from(entries.values());
    },
    subscribe(uid, listener) {
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
  perUid: Map<string, Set<FlatMirrorListener>>,
  any: Set<FlatMirrorListener>,
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
      // Same.
    }
  }
}
