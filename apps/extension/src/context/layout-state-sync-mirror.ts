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
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface LayoutStateMirrorEntry {
  layout: unknown;
}

export type LayoutStateMirrorListener = () => void;

export interface LayoutStateSyncMirror {
  getMirror(): LayoutStateMirrorEntry | null;
  liveLayout(): unknown;
  subscribeMirror(listener: LayoutStateMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateLayoutStateSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createLayoutStateSyncMirror(
  workspaceId: string,
  options: CreateLayoutStateSyncMirrorOptions = {},
): LayoutStateSyncMirror {
  const core = createSingletonEntityMirror<LayoutStateMirrorEntry>(
    {
      loggerTag: 'LayoutStateSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, layoutStatePostState } = event;
        if (envelope.body.type !== LAYOUT_STATE_ENTITY_TYPE) return null;
        if (!layoutStatePostState) return 'tombstone';
        return { layout: layoutStatePostState.layout };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLayoutState', { workspaceId });
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
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's `services: Map<workspaceId,
// WorkspaceServiceState>` (commit 1, sub-commit 1a). Each workspace's
// mirror is independent: its bridge subscription filters by
// `event.envelope.workspaceId` at the shared mirror core (M-2), and
// its bootstrap snapshot is fetched scoped to the workspace via
// `oh.sync.snapshotX, { workspaceId }` (M-1). Cross-workspace
// contamination is structurally inexpressible.

const layoutStateSyncMirrorRegistry = createWorkspaceMirrorRegistry<LayoutStateSyncMirror>(
  (workspaceId) => createLayoutStateSyncMirror(workspaceId),
);

export function getLayoutStateSyncMirrorForWorkspace(workspaceId: string): LayoutStateSyncMirror {
  return layoutStateSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeLayoutStateSyncMirrorForWorkspace(workspaceId: string): void {
  layoutStateSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllLayoutStateSyncMirrors(): void {
  layoutStateSyncMirrorRegistry.disposeAll();
}
