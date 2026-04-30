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
  options: CreatePauseMarkersSyncMirrorOptions = {},
): PauseMarkersSyncMirror {
  const core = createSingletonEntityMirror<PauseMarkersMirrorEntry>(
    {
      loggerTag: 'PauseMarkersSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, pauseMarkersPostState } = event;
        if (envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return null;
        if (!pauseMarkersPostState) return 'tombstone';
        return { markers: pauseMarkersPostState.markers, paths: pauseMarkersPostState.paths };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotPauseMarkers');
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
