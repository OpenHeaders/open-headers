/**
 * Renderer-side live-variable sync mirror (Phase B).
 *
 * Subscribes once to the SW's `syncBroadcast` channel and folds every
 * `liveVariablePostState` payload into a `Map<liveVariableUid,
 * LiveVariableMirrorEntry>`. Renderer write helpers consult this mirror
 * to read the canonical LV shape synchronously (§19.4); LV is fully
 * flat-scalar so there are no set-modeled paths to enumerate.
 *
 * On construction the mirror fires `oh.sync.snapshotLiveVariables` so
 * the starting view is populated before the first broadcast lands; any
 * concurrent broadcast that arrives mid-flight wins.
 */

import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

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

export interface CreateLiveVariableSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createLiveVariableSyncMirror(
  options: CreateLiveVariableSyncMirrorOptions = {},
): LiveVariableSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, LiveVariableMirrorEntry>();
  const perUidListeners = new Map<string, Set<LiveVariableMirrorListener>>();
  const anyListeners = new Set<LiveVariableMirrorListener>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, liveVariablePostState } = event;
    if (!liveVariablePostState && envelope.body.type !== LIVE_VARIABLE_ENTITY_TYPE) return;
    const uid = envelope.body.id;
    seenSinceMount.add(uid);
    if (!liveVariablePostState) {
      if (entries.delete(uid)) notify(perUidListeners, anyListeners, uid);
      return;
    }
    entries.set(uid, { liveVariable: liveVariablePostState.liveVariable });
    notify(perUidListeners, anyListeners, uid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotLiveVariables')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.liveVariable.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { liveVariable: entry.liveVariable });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('LiveVariableSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getLiveVariableMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listLiveVariables() {
      return Array.from(entries.values())
        .map((e) => e.liveVariable)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeLiveVariableMirror(uid, listener) {
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
  perUid: Map<string, Set<LiveVariableMirrorListener>>,
  any: Set<LiveVariableMirrorListener>,
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
