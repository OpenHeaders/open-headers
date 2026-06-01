/**
 * `useResourceTimingClient` — React hook that owns one `oh-rt:<tabId>`
 * port for the panel's lifetime and exposes a stable
 * `ResourceTimingClientSnapshot` via `useSyncExternalStore`.
 *
 * Sibling of `usePageClient`: port lifecycle (connect / reconnect /
 * cleanup) is delegated to `useLifelineClient`; this file owns only the
 * wire-message router and the `ResourceTimingClientStore`.
 *
 * Replay-on-reconnect: every `ready` envelope clears the store before
 * the relay's replayed snapshot lands, so a reconnect after SW eviction
 * does not strand a stale snapshot.
 */

import { type ResourceTimingWireMessage, resourceTimingPortName } from '@openheaders/core/resource-timing';
import { useRef, useSyncExternalStore } from 'react';

import { type ResourceTimingClientSnapshot, ResourceTimingClientStore } from './resource-timing-client-store';
import { useLifelineClient } from './use-lifeline-client';

export interface UseResourceTimingClientResult {
  readonly snapshot: ResourceTimingClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: ResourceTimingClientStore;
}

export function useResourceTimingClient(): UseResourceTimingClientResult {
  const storeRef = useRef<ResourceTimingClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new ResourceTimingClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<ResourceTimingWireMessage>({
    portName: resourceTimingPortName,
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          store.clear();
          break;
        case 'rt-update':
          store.apply(msg.update);
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
