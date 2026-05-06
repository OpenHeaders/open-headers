/**
 * Renderer-side pause-markers sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Renderer
 * write helpers consult this mirror to compute the existing key set
 * when emitting a replacement batch — no SW round-trip per write
 * (§19.4).
 */

import { PAUSE_MARKERS_ENTITY_TYPE, type PauseMarkerKind } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface PauseMarkersMirrorEntry {
  markers: Record<string, PauseMarkerKind>;
  paths: string[];
}

export type PauseMarkersMirrorListener = () => void;

export interface PauseMarkersSyncMirror {
  getMirror(): PauseMarkersMirrorEntry | null;
  livePaths(): string[];
  liveMarkers(): Record<string, PauseMarkerKind>;
  subscribeMirror(listener: PauseMarkersMirrorListener): () => void;
  dispose(): void;
}

export type CreatePauseMarkersSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createPauseMarkersSyncMirror(
  workspaceId: string,
  options: CreatePauseMarkersSyncMirrorOptions = {},
): PauseMarkersSyncMirror {
  const core = createSingletonEntityMirror<PauseMarkersMirrorEntry>(
    {
      loggerTag: 'PauseMarkersSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, pauseMarkersPostState } = event;
        if (envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return null;
        if (!pauseMarkersPostState) return 'tombstone';
        return { markers: pauseMarkersPostState.markers, paths: pauseMarkersPostState.paths };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotPauseMarkers', { workspaceId });
        const first = resp.entries[0];
        return first ? { markers: first.markers, paths: first.paths } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    livePaths: () => core.get()?.paths ?? [],
    liveMarkers: () => core.get()?.markers ?? {},
    subscribeMirror: core.subscribe,
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

const pauseMarkersSyncMirrorRegistry = createWorkspaceMirrorRegistry<PauseMarkersSyncMirror>(
  (workspaceId) => createPauseMarkersSyncMirror(workspaceId),
);

export function getPauseMarkersSyncMirrorForWorkspace(workspaceId: string): PauseMarkersSyncMirror {
  return pauseMarkersSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposePauseMarkersSyncMirrorForWorkspace(workspaceId: string): void {
  pauseMarkersSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllPauseMarkersSyncMirrors(): void {
  pauseMarkersSyncMirrorRegistry.disposeAll();
}
