/**
 * Renderer-side pause-markers sync mirror (Phase B).
 *
 * Mirrors `vault-sync-mirror.ts` for the singleton pause-markers
 * entity. Subscribes once to the SW's `syncBroadcast` channel and
 * folds every `pauseMarkersPostState` payload into a single mutable
 * record. Renderer write helpers read this mirror to compute the
 * existing key set when emitting a replacement batch — no SW
 * round-trip per write (§19.4). On construction the mirror fires
 * `oh.sync.snapshotPauseMarkers` so it has a starting view before any
 * broadcast arrives. The subscription is registered first so any
 * concurrent broadcast that lands mid-flight wins.
 */

import { PAUSE_MARKERS_ENTITY_TYPE, type PauseMarkerKind } from '@openheaders/core/sync';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface PauseMarkersMirrorEntry {
  markers: Record<string, PauseMarkerKind>;
  paths: string[];
}

export type PauseMarkersMirrorListener = () => void;

export interface PauseMarkersSyncMirror {
  getMirror(): PauseMarkersMirrorEntry | null;
  /** Live marked paths — `[]` when uninitialized. */
  livePaths(): string[];
  /** Marker map convenience — empty record when uninitialized. */
  liveMarkers(): Record<string, PauseMarkerKind>;
  subscribeMirror(listener: PauseMarkersMirrorListener): () => void;
  dispose(): void;
}

export interface CreatePauseMarkersSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createPauseMarkersSyncMirror(
  options: CreatePauseMarkersSyncMirrorOptions = {},
): PauseMarkersSyncMirror {
  const { bootstrap = true } = options;
  let entry: PauseMarkersMirrorEntry | null = null;
  const listeners = new Set<PauseMarkersMirrorListener>();
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
    const { envelope, pauseMarkersPostState } = event;
    if (envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return;
    sawBroadcast = true;

    if (!pauseMarkersPostState) {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }

    entry = {
      markers: pauseMarkersPostState.markers,
      paths: pauseMarkersPostState.paths,
    };
    notify();
  });

  if (bootstrap) {
    void call('oh.sync.snapshotPauseMarkers')
      .then((resp) => {
        if (sawBroadcast) return;
        const first = resp.entries[0];
        if (!first) return;
        entry = { markers: first.markers, paths: first.paths };
        notify();
      })
      .catch((err: Error) => {
        logger.info('PauseMarkersSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getMirror() {
      return entry;
    },
    livePaths() {
      return entry?.paths ?? [];
    },
    liveMarkers() {
      return entry?.markers ?? {};
    },
    subscribeMirror(listener) {
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

// ── Module-level singleton ───────────────────────────────────────────

let active: PauseMarkersSyncMirror | null = null;

export function getActivePauseMarkersSyncMirror(): PauseMarkersSyncMirror {
  if (!active) active = createPauseMarkersSyncMirror();
  return active;
}

export function disposeActivePauseMarkersSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
