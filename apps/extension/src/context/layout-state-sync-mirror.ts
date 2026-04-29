/**
 * Renderer-side layout-state sync mirror (Phase B).
 *
 * Mirrors `pause-markers-sync-mirror.ts` for the singleton layout-state
 * entity. Subscribes once to the SW's `syncBroadcast` channel and folds
 * every `layoutStatePostState` payload into a single mutable blob.
 * Renderer write helpers don't actually need a snapshot for diffing
 * (layout is whole-blob LWW, not diffed against existing entries) but
 * the mirror gives the renderer a synchronous read path consistent with
 * every other entity. On construction the mirror fires
 * `oh.sync.snapshotLayoutState` so it has a starting view before any
 * broadcast arrives. The subscription is registered first so any
 * concurrent broadcast that lands mid-flight wins.
 */

import { LAYOUT_STATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface LayoutStateMirrorEntry {
  layout: unknown;
}

export type LayoutStateMirrorListener = () => void;

export interface LayoutStateSyncMirror {
  getMirror(): LayoutStateMirrorEntry | null;
  /** Live opaque layout blob — `null` when uninitialized. */
  liveLayout(): unknown;
  subscribeMirror(listener: LayoutStateMirrorListener): () => void;
  dispose(): void;
}

export interface CreateLayoutStateSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createLayoutStateSyncMirror(
  options: CreateLayoutStateSyncMirrorOptions = {},
): LayoutStateSyncMirror {
  const { bootstrap = true } = options;
  let entry: LayoutStateMirrorEntry | null = null;
  const listeners = new Set<LayoutStateMirrorListener>();
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
    const { envelope, layoutStatePostState } = event;
    if (envelope.body.type !== LAYOUT_STATE_ENTITY_TYPE) return;
    sawBroadcast = true;

    if (!layoutStatePostState) {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }

    entry = { layout: layoutStatePostState.layout };
    notify();
  });

  if (bootstrap) {
    void call('oh.sync.snapshotLayoutState')
      .then((resp) => {
        if (sawBroadcast) return;
        const first = resp.entries[0];
        if (!first) return;
        entry = { layout: first.layout };
        notify();
      })
      .catch((err: Error) => {
        logger.info('LayoutStateSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getMirror() {
      return entry;
    },
    liveLayout() {
      return entry?.layout ?? null;
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

let active: LayoutStateSyncMirror | null = null;

export function getActiveLayoutStateSyncMirror(): LayoutStateSyncMirror {
  if (!active) active = createLayoutStateSyncMirror();
  return active;
}

export function disposeActiveLayoutStateSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
