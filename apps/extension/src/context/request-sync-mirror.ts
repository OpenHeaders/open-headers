/**
 * Renderer-side request sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Renderer write
 * helpers consult this mirror to:
 *
 *   1. Read the canonical request shape synchronously (§19.4).
 *   2. Enumerate live `(itemId, orderKey)` pairs at set-modeled paths
 *      (`headers`, `params`) for the unified set-diff synthesizer to
 *      emit minimum-diff envelope batches on save.
 */

import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface RequestMirrorEntry {
  request: V5.Request;
  /** Map keyed by set path (e.g. `headers`, `params`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type RequestMirrorListener = (uid: string) => void;

export interface RequestSyncMirror {
  getRequestMirror(uid: string): RequestMirrorEntry | null;
  listRequests(): V5.Request[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeRequestMirror(uid: string, listener: RequestMirrorListener): () => void;
  subscribeAny(listener: RequestMirrorListener): () => void;
  dispose(): void;
}

export type CreateRequestSyncMirrorOptions = CreateFlatMirrorOptions;

export function createRequestSyncMirror(
  options: CreateRequestSyncMirrorOptions = {},
): RequestSyncMirror {
  const core = createFlatEntityMirror<RequestMirrorEntry>(
    {
      loggerTag: 'RequestSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, requestPostState } = event;
        // A non-Request broadcast arrives with `requestPostState`
        // undefined; ignore it so it doesn't tombstone an unrelated
        // entry. Type-matching tombstone (post-state absent on a
        // Request envelope) drops the entry.
        if (!requestPostState && envelope.body.type !== REQUEST_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!requestPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            request: requestPostState.request,
            setItemIds: requestPostState.setItemIds,
            setOrderKeys: requestPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotRequests');
        return resp.entries.map((e) => ({
          uid: e.request.uid,
          entry: {
            request: e.request,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getRequestMirror: core.get,
    listRequests: () =>
      core
        .list()
        .map((e) => e.request)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeRequestMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

let active: RequestSyncMirror | null = null;

export function getActiveRequestSyncMirror(): RequestSyncMirror {
  if (!active) active = createRequestSyncMirror();
  return active;
}

export function disposeActiveRequestSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
