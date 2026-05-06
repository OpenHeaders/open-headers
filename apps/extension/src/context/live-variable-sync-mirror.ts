/**
 * Renderer-side live-variable sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. LV is fully
 * flat-scalar so there are no set-modeled paths to enumerate.
 */

import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface LiveVariableMirrorEntry {
  liveVariable: V5.LiveVariable;
}

export type LiveVariableMirrorListener = (uid: string) => void;

export interface LiveVariableSyncMirror {
  getLiveVariableMirror(uid: string): LiveVariableMirrorEntry | null;
  listLiveVariables(): V5.LiveVariable[];
  subscribeLiveVariableMirror(uid: string, listener: LiveVariableMirrorListener): () => void;
  subscribeAny(listener: LiveVariableMirrorListener): () => void;
  dispose(): void;
}

export type CreateLiveVariableSyncMirrorOptions = CreateFlatMirrorOptions;

export function createLiveVariableSyncMirror(
  workspaceId: string,
  options: CreateLiveVariableSyncMirrorOptions = {},
): LiveVariableSyncMirror {
  const core = createFlatEntityMirror<LiveVariableMirrorEntry>(
    {
      loggerTag: 'LiveVariableSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, liveVariablePostState } = event;
        if (!liveVariablePostState && envelope.body.type !== LIVE_VARIABLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!liveVariablePostState) return { uid, entry: null };
        return { uid, entry: { liveVariable: liveVariablePostState.liveVariable } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLiveVariables', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.liveVariable.uid,
          entry: { liveVariable: e.liveVariable },
        }));
      },
    },
    options,
  );
  return {
    getLiveVariableMirror: core.get,
    listLiveVariables: () =>
      core
        .list()
        .map((e) => e.liveVariable)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    subscribeLiveVariableMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
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

const liveVariableSyncMirrorRegistry = createWorkspaceMirrorRegistry<LiveVariableSyncMirror>(
  (workspaceId) => createLiveVariableSyncMirror(workspaceId),
);

export function getLiveVariableSyncMirrorForWorkspace(workspaceId: string): LiveVariableSyncMirror {
  return liveVariableSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeLiveVariableSyncMirrorForWorkspace(workspaceId: string): void {
  liveVariableSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllLiveVariableSyncMirrors(): void {
  liveVariableSyncMirrorRegistry.disposeAll();
}
