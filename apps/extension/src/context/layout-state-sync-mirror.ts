/**
 * Renderer-side layout-state sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Layout is
 * whole-blob LWW, not diffed against existing entries — the mirror
 * exists so the renderer has a synchronous read path consistent with
 * every other entity.
 */

import { LAYOUT_STATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';

export interface LayoutStateMirrorEntry {
  layout: unknown;
}

export type LayoutStateMirrorListener = () => void;

export interface LayoutStateSyncMirror {
  getMirror(): LayoutStateMirrorEntry | null;
  liveLayout(): unknown;
  subscribeMirror(listener: LayoutStateMirrorListener): () => void;
  dispose(): void;
}

export type CreateLayoutStateSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createLayoutStateSyncMirror(
  options: CreateLayoutStateSyncMirrorOptions = {},
): LayoutStateSyncMirror {
  const core = createSingletonEntityMirror<LayoutStateMirrorEntry>(
    {
      loggerTag: 'LayoutStateSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, layoutStatePostState } = event;
        if (envelope.body.type !== LAYOUT_STATE_ENTITY_TYPE) return null;
        if (!layoutStatePostState) return 'tombstone';
        return { layout: layoutStatePostState.layout };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLayoutState');
        const first = resp.entries[0];
        return first ? { layout: first.layout } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveLayout: () => core.get()?.layout ?? null,
    subscribeMirror: core.subscribe,
    dispose: core.dispose,
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
