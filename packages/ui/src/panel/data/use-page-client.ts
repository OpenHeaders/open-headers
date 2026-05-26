/**
 * `usePageClient` — React hook that owns one `oh-page:<tabId>` port for
 * the panel's lifetime and exposes a stable `PageClientSnapshot` via
 * `useSyncExternalStore`.
 *
 * Sibling of `useLifecycleClient`. Owns the page-stream port end-to-end;
 * nav-timing fields arrive in the same envelopes and are projected into
 * the snapshot rather than living on a separate channel.
 *
 * Replay-on-reconnect: every `ready` envelope clears the store before
 * replay updates land, so a reconnect after SW eviction does not
 * accumulate stale page rows.
 */

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import { type PageWireMessage, pagePortName } from '@openheaders/core/page-stream';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { PageClientStore, type PageClientSnapshot } from './page-client-store';

const RECONNECT_DELAY_MS = 250;

export interface UsePageClientResult {
  readonly snapshot: PageClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: PageClientStore;
}

export function usePageClient(): UsePageClientResult {
  const storeRef = useRef<PageClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new PageClientStore();
  const store = storeRef.current;

  const tabIdRef = useRef<number | null>(hostNavigation.inspectedTabId());

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

    let activePort: LifelinePort | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handler = (msg: PageWireMessage): void => {
      switch (msg.kind) {
        case 'ready':
          store.clear();
          break;
        case 'page-update':
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
        port = lifelineTransport.connect(pagePortName(tabId));
      } catch {
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      activePort = port;
      port.onMessage<PageWireMessage>(handler);
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
          /* already disconnected */
        }
        activePort = null;
      }
    };
  }, [store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId: tabIdRef.current, store };
}
