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
  options: CreateLiveVariableSyncMirrorOptions = {},
): LiveVariableSyncMirror {
  const core = createFlatEntityMirror<LiveVariableMirrorEntry>(
    {
      loggerTag: 'LiveVariableSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, liveVariablePostState } = event;
        if (!liveVariablePostState && envelope.body.type !== LIVE_VARIABLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!liveVariablePostState) return { uid, entry: null };
        return { uid, entry: { liveVariable: liveVariablePostState.liveVariable } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotLiveVariables');
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

let active: LiveVariableSyncMirror | null = null;

export function getActiveLiveVariableSyncMirror(): LiveVariableSyncMirror {
  if (!active) active = createLiveVariableSyncMirror();
  return active;
}

export function disposeActiveLiveVariableSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
