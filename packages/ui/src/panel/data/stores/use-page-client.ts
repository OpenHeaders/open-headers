/**
 * `usePageClient` — React hook that owns one `oh-page:<tabId>` port for
 * the panel's lifetime and exposes a stable `PageClientSnapshot` via
 * `useSyncExternalStore`.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`; this file only owns the wire-message router and
 * the `PageClientStore`.
 *
 * Replay-on-reconnect: every `ready` envelope clears the store before
 * replay updates land, so a reconnect after SW eviction does not
 * accumulate stale page rows.
 */

import { type PageWireMessage, pagePortName } from '@openheaders/core/page-stream';
import { useRef, useSyncExternalStore } from 'react';
import { useLifelineClient } from '../use-lifeline-client';
import { type PageClientSnapshot, PageClientStore } from './page-client-store';

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

  const { tabId } = useLifelineClient<PageWireMessage>({
    portName: pagePortName,
    handler: (msg) => {
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
    },
  });

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId, store };
}
