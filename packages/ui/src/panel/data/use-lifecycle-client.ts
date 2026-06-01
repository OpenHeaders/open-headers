/**
 * `useLifecycleClient` — React hook that owns one `oh-lifecycle:<tabId>`
 * port for the panel's lifetime and exposes a stable
 * `LifecycleClientSnapshot` via `useSyncExternalStore`.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`; this file only owns the per-channel pieces: the
 * wire-message router, the `LifecycleClientStore`, and the snapshot
 * subscription.
 *
 * `ready` is intentionally absent from the return shape: the hub's
 * contract is "snapshot replay completes synchronously inside the same
 * delivery as the `ready` envelope," so there is no observable
 * connected-but-empty window from the consumer's POV. The empty
 * `snapshot.ordered` after first mount is the same as "no requests yet
 * on this tab" — the renderer doesn't need to distinguish.
 *
 * Watch session: the panel only shows requests observed after it started
 * watching, mirroring the browser's own Network panel. The session floor
 * is owned ENGINE-SIDE, keyed by tab — the panel just sends one
 * `subscribe` ("my session") and the engine resolves the floor (and
 * persists it). That is what keeps the view stable across reconnects,
 * panel remounts, and SW restarts WITHOUT the panel carrying the floor
 * itself: a remount that reset a client-held floor used to drop in-flight
 * rows. Each `subscribe` precedes a fresh `ready`+replay, and the `ready`
 * clears the store so the replay is the canonical view.
 *
 * Clear: `clearSession` drops the local mirror AND tells the engine to
 * advance the session floor, so the reset survives a later reconnect
 * (otherwise the engine would replay the cleared requests back in).
 */

import {
  type LifecycleClearSessionMessage,
  type LifecycleSubscribeMessage,
  type LifecycleWireMessage,
  lifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { useCallback, useRef, useSyncExternalStore } from 'react';

import { type LifecycleClientSnapshot, LifecycleClientStore } from './lifecycle-client-store';
import { useLifelineClient } from './use-lifeline-client';

export interface UseLifecycleClientResult {
  readonly snapshot: LifecycleClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: LifecycleClientStore;
  /**
   * Clear the panel's view: drop the local mirror AND advance the
   * engine-owned session floor so the reset survives a reconnect. Register
   * THIS (not `store`) as the panel's lifecycle resettable.
   */
  clearSession(): void;
}

export function useLifecycleClient(): UseLifecycleClientResult {
  const storeRef = useRef<LifecycleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new LifecycleClientStore();
  const store = storeRef.current;

  // The session floor is engine-owned, so the panel never carries it: a
  // bare `subscribe` means "my watch session" and the engine resolves the
  // same floor on every reconnect/remount.
  const { tabId, post } = useLifelineClient<LifecycleWireMessage>({
    portName: lifecyclePortName,
    onConnect: (send) => send({ kind: 'subscribe' } satisfies LifecycleSubscribeMessage),
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          // Every `ready` precedes a fresh replay; drop accumulated state
          // so the replay is the canonical view.
          store.clear();
          break;
        case 'lifecycle-update':
          store.apply(msg.update);
          break;
        case 'tab-cleared':
          // Upstream tab forgotten — drop the cache so we don't render
          // stale lifecycles against a tab that's gone.
          store.clear();
          break;
        default: {
          const _exhaustive: never = msg;
          void _exhaustive;
        }
      }
    },
  });

  // Clear: drop the local mirror and advance the engine session floor so
  // the cleared requests do not replay back in on the next reconnect.
  const clearSession = useCallback(() => {
    store.clear();
    post({ kind: 'clear-session' } satisfies LifecycleClearSessionMessage);
  }, [store, post]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId, store, clearSession };
}
