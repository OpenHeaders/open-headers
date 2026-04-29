/**
 * Renderer-side live-workflow sync mirror (Phase B).
 *
 * Subscribes once to the SW's `syncBroadcast` channel and folds every
 * `liveWorkflowPostState` payload into a `Map<workflowUid,
 * LiveWorkflowMirrorEntry>`. Renderer write helpers consult this mirror
 * to read the canonical workflow shape synchronously (§19.4); LW has
 * no set-modeled paths (`steps` is whole-array LWW), so there are no
 * itemIds to enumerate.
 */

import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

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

export interface CreateLiveWorkflowSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createLiveWorkflowSyncMirror(
  options: CreateLiveWorkflowSyncMirrorOptions = {},
): LiveWorkflowSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, LiveWorkflowMirrorEntry>();
  const perUidListeners = new Map<string, Set<LiveWorkflowMirrorListener>>();
  const anyListeners = new Set<LiveWorkflowMirrorListener>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, liveWorkflowPostState } = event;
    if (!liveWorkflowPostState && envelope.body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return;
    const uid = envelope.body.id;
    seenSinceMount.add(uid);
    if (!liveWorkflowPostState) {
      if (entries.delete(uid)) notify(perUidListeners, anyListeners, uid);
      return;
    }
    entries.set(uid, { workflow: liveWorkflowPostState.workflow });
    notify(perUidListeners, anyListeners, uid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotLiveWorkflows')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.workflow.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { workflow: entry.workflow });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('LiveWorkflowSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getLiveWorkflowMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listLiveWorkflows() {
      return Array.from(entries.values())
        .map((e) => e.workflow)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeLiveWorkflowMirror(uid, listener) {
      let bucket = perUidListeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        perUidListeners.set(uid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = perUidListeners.get(uid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) perUidListeners.delete(uid);
      };
    },
    subscribeAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      perUidListeners.clear();
      anyListeners.clear();
    },
  };
}

function notify(
  perUid: Map<string, Set<LiveWorkflowMirrorListener>>,
  any: Set<LiveWorkflowMirrorListener>,
  uid: string,
): void {
  const bucket = perUid.get(uid);
  if (bucket) {
    for (const l of bucket) {
      try {
        l(uid);
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }
  for (const l of any) {
    try {
      l(uid);
    } catch {
      // Same as above.
    }
  }
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
