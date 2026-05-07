/**
 * Renderer-side live-workflow sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. LW has no
 * set-modeled paths (`steps` is whole-array LWW) so there are no
 * itemIds to enumerate.
 */

import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface LiveWorkflowMirrorEntry {
  workflow: V5.LiveWorkflow;
}

export type LiveWorkflowMirrorListener = (uid: string) => void;

export interface LiveWorkflowSyncMirror {
  getLiveWorkflowMirror(uid: string): LiveWorkflowMirrorEntry | null;
  listLiveWorkflows(): V5.LiveWorkflow[];
  subscribeLiveWorkflowMirror(uid: string, listener: LiveWorkflowMirrorListener): () => void;
  subscribeAny(listener: LiveWorkflowMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateLiveWorkflowSyncMirrorOptions = CreateFlatMirrorOptions;

export function createLiveWorkflowSyncMirror(
  workspaceId: string,
  options: CreateLiveWorkflowSyncMirrorOptions = {},
): LiveWorkflowSyncMirror {
  const core = createFlatEntityMirror<LiveWorkflowMirrorEntry>(
    {
      loggerTag: 'LiveWorkflowSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, liveWorkflowPostState } = event;
        if (!liveWorkflowPostState && envelope.body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!liveWorkflowPostState) return { uid, entry: null };
        return { uid, entry: { workflow: liveWorkflowPostState.workflow } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLiveWorkflows', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.workflow.uid,
          entry: { workflow: e.workflow },
        }));
      },
    },
    options,
  );
  return {
    getLiveWorkflowMirror: core.get,
    listLiveWorkflows: () =>
      core
        .list()
        .map((e) => e.workflow)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    subscribeLiveWorkflowMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
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

const liveWorkflowSyncMirrorRegistry = createWorkspaceMirrorRegistry<LiveWorkflowSyncMirror>(
  (workspaceId) => createLiveWorkflowSyncMirror(workspaceId),
);

export function getLiveWorkflowSyncMirrorForWorkspace(workspaceId: string): LiveWorkflowSyncMirror {
  return liveWorkflowSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeLiveWorkflowSyncMirrorForWorkspace(workspaceId: string): void {
  liveWorkflowSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllLiveWorkflowSyncMirrors(): void {
  liveWorkflowSyncMirrorRegistry.disposeAll();
}
