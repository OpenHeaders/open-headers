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

export interface LiveWorkflowMirrorEntry {
  workflow: V5.LiveWorkflow;
}

export type LiveWorkflowMirrorListener = (uid: string) => void;

export interface LiveWorkflowSyncMirror {
  getLiveWorkflowMirror(uid: string): LiveWorkflowMirrorEntry | null;
  listLiveWorkflows(): V5.LiveWorkflow[];
  subscribeLiveWorkflowMirror(uid: string, listener: LiveWorkflowMirrorListener): () => void;
  subscribeAny(listener: LiveWorkflowMirrorListener): () => void;
  dispose(): void;
}

export type CreateLiveWorkflowSyncMirrorOptions = CreateFlatMirrorOptions;

export function createLiveWorkflowSyncMirror(
  options: CreateLiveWorkflowSyncMirrorOptions = {},
): LiveWorkflowSyncMirror {
  const core = createFlatEntityMirror<LiveWorkflowMirrorEntry>(
    {
      loggerTag: 'LiveWorkflowSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, liveWorkflowPostState } = event;
        if (!liveWorkflowPostState && envelope.body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!liveWorkflowPostState) return { uid, entry: null };
        return { uid, entry: { workflow: liveWorkflowPostState.workflow } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLiveWorkflows');
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
    dispose: core.dispose,
  };
}

let active: LiveWorkflowSyncMirror | null = null;

export function getActiveLiveWorkflowSyncMirror(): LiveWorkflowSyncMirror {
  if (!active) active = createLiveWorkflowSyncMirror();
  return active;
}

export function disposeActiveLiveWorkflowSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
