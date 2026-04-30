/**
 * Renderer-side singleton-entity sync mirror — shared core.
 *
 * Sibling of {@link ./flat-entity-mirror.ts} for entities that are
 * one-per-scope (vault, workspace-variables, layout-state, files,
 * pause-markers — the "no uid dimension" entities). Each adapter
 * provides only the per-entity bits — how to extract `Entry` from a
 * broadcast event, how to fetch the bootstrap snapshot — and exposes
 * entity-named methods over the neutral core.
 *
 * Subscription discipline (kept identical to the pre-extraction
 * mirrors):
 *
 *   1. Register the bridge subscription synchronously, before kicking
 *      off any async snapshot fetch. A broadcast that lands while the
 *      snapshot is in-flight carries fresher post-commit state — the
 *      mirror flips `sawBroadcast` and the snapshot handler skips
 *      re-applying the (older) snapshot row.
 *   2. Tombstones (post-state absent on a matching envelope) clear
 *      the entry and notify subscribers; per §7.2 a fresh recreate
 *      replaces the singleton in place.
 *   3. Listener errors are swallowed at the notify boundary so a
 *      broken consumer can't tear down the broadcast pipe for the
 *      others.
 */

import { type BridgeBroadcastPayload, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

/** Bridge payload shape — see {@link ./flat-entity-mirror.ts}. */
export type SyncBroadcastPayload = BridgeBroadcastPayload<'syncBroadcast'>;

/**
 * Outcome of `extractFromBroadcast`:
 *   - `null` — envelope doesn't target this singleton; the core skips it.
 *   - `'tombstone'` — envelope is for this singleton but post-state is
 *     absent (delete); the core clears the entry.
 *   - `entry` — live update; the core stores the entry.
 */
export type SingletonExtractResult<E> = E | 'tombstone' | null;

export interface SingletonMirrorConfig<E> {
  loggerTag: string;
  /** Pure extraction from a wire event into the singleton's entry shape. */
  extractFromBroadcast: (event: SyncBroadcastPayload) => SingletonExtractResult<E>;
  /**
   * Fetch the bootstrap snapshot. Adapters wrap `call('oh.sync.snapshotX')`
   * here so the typed bridge contract is preserved at the boundary. Returns
   * the entry directly (or `null` when the singleton hasn't been seeded
   * yet) — the core skips applying when `sawBroadcast` already won the race.
   */
  fetchSnapshot: () => Promise<E | null>;
}

export type SingletonMirrorListener = () => void;

export interface SingletonMirrorCore<E> {
  get(): E | null;
  subscribe(listener: SingletonMirrorListener): () => void;
  dispose(): void;
}

export interface CreateSingletonMirrorOptions {
  /**
   * When true (default) the core fires the snapshot fetch on
   * construction. Tests that only drive broadcasts pass `false`.
   */
  bootstrap?: boolean;
}

export function createSingletonEntityMirror<E>(
  config: SingletonMirrorConfig<E>,
  options: CreateSingletonMirrorOptions = {},
): SingletonMirrorCore<E> {
  const { bootstrap = true } = options;
  let entry: E | null = null;
  const listeners = new Set<SingletonMirrorListener>();
  let sawBroadcast = false;

  const notify = (): void => {
    for (const l of listeners) {
      try {
        l();
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const result = config.extractFromBroadcast(event);
    if (result === null) return;
    sawBroadcast = true;
    if (result === 'tombstone') {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }
    entry = result;
    notify();
  });

  if (bootstrap) {
    void config
      .fetchSnapshot()
      .then((snapshot) => {
        // A broadcast that landed mid-flight already won the race —
        // it carries fresher post-commit state, so skip the snapshot.
        if (sawBroadcast) return;
        if (!snapshot) return;
        entry = snapshot;
        notify();
      })
      .catch((err: Error) => {
        logger.info(config.loggerTag, `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    get() {
      return entry;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entry = null;
      listeners.clear();
    },
  };
}
