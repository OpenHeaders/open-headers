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
 * Replay-on-reconnect: every `ready` envelope clears the store before
 * the replay updates land. That keeps the panel's view aligned with the
 * engine's current state instead of accumulating stale lifecycles from
 * before the reconnect.
 */

import {
  type LifecycleWireMessage,
  lifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { useRef, useSyncExternalStore } from 'react';

import { LifecycleClientStore, type LifecycleClientSnapshot } from './lifecycle-client-store';
import { useLifelineClient } from './use-lifeline-client';

export interface UseLifecycleClientResult {
  readonly snapshot: LifecycleClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: LifecycleClientStore;
}

export function useLifecycleClient(): UseLifecycleClientResult {
  const storeRef = useRef<LifecycleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new LifecycleClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<LifecycleWireMessage>({
    portName: lifecyclePortName,
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          // Every `ready` precedes a fresh replay; drop accumulated
          // state so the replay is the canonical view.
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

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId, store };
}
