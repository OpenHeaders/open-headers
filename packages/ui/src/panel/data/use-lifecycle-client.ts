/**
 * `useLifecycleClient` — React hook that owns one `oh-lifecycle:<tabId>`
 * port for the panel's lifetime and exposes a stable
 * `LifecycleClientSnapshot` via `useSyncExternalStore`.
 *
 * On mount: read the inspected tab id (`null` outside a devtools host
 * → no-op hook, safe for unit tests). Open the lifecycle port, route
 * `LifecycleWireMessage` frames into the store, and reconnect on
 * disconnect (MV3 SW eviction, background crash).
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

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import {
  type LifecycleWireMessage,
  lifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { LifecycleClientStore, type LifecycleClientSnapshot } from './lifecycle-client-store';

/** Backoff for the panel→background port reconnect loop. */
const RECONNECT_DELAY_MS = 250;

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

  const tabIdRef = useRef<number | null>(hostNavigation.inspectedTabId());

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

    let activePort: LifelinePort | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handler = (msg: LifecycleWireMessage) => {
      switch (msg.kind) {
        case 'ready':
          // Every `ready` precedes a fresh replay; drop accumulated
          // state so the replay is the canonical view.
          store.clear();
          break;
        case 'lifecycle-update':
          store.apply(msg.update);
          break;
        default: {
          const _exhaustive: never = msg;
          void _exhaustive;
        }
      }
    };

    const connect = (): void => {
      if (disposed) return;
      let port: LifelinePort;
      try {
        port = lifelineTransport.connect(lifecyclePortName(tabId));
      } catch {
        // Opening the lifeline can throw "Extension context invalidated"
        // when the panel outlives an extension reload; back off and
        // retry until either the inspected tab refreshes or the panel
        // is torn down.
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      activePort = port;
      port.onMessage<LifecycleWireMessage>(handler);
      port.onDisconnect(() => {
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activePort) {
        try {
          activePort.disconnect();
        } catch {
          // Already disconnected.
        }
        activePort = null;
      }
    };
  }, [store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId: tabIdRef.current, store };
}
