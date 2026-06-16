/**
 * `useConsoleClient` — React hook that owns one `oh-console:<tabId>` port for
 * the panel's lifetime and exposes a stable `ConsoleClientSnapshot` via
 * `useSyncExternalStore`.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`; this file only owns the wire-message router and the
 * `ConsoleClientStore`.
 *
 * Replay-on-reconnect: like the page hook (and unlike the idempotent fire
 * hook), every `ready` envelope clears the store before the replayed entries
 * land — console appends have no identity, so without the clear a reconnect
 * after SW eviction would duplicate the whole replayed buffer.
 */

import { type ConsoleStreamWireMessage, consoleStreamPortName } from '@openheaders/core/console-stream';
import { useRef, useSyncExternalStore } from 'react';

import { type ConsoleClientSnapshot, ConsoleClientStore } from './console-client-store';
import { useLifelineClient } from './use-lifeline-client';

export interface UseConsoleClientResult {
  readonly snapshot: ConsoleClientSnapshot;
  readonly tabId: number | null;
  readonly store: ConsoleClientStore;
}

export function useConsoleClient(): UseConsoleClientResult {
  const storeRef = useRef<ConsoleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new ConsoleClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<ConsoleStreamWireMessage>({
    portName: consoleStreamPortName,
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          store.clear();
          break;
        case 'console-update':
          if (msg.update.kind === 'tab-cleared') store.clear();
          else store.append(msg.update.entry);
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
