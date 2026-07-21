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
import { useMemo, useRef, useSyncExternalStore } from 'react';
import { useLifelineClient } from '../use-lifeline-client';
import { type ConsoleClientSnapshot, ConsoleClientStore } from './console-client-store';

export interface UseConsoleClientOptions {
  /**
   * Bind a fixed browser tab instead of the inspected tab — the
   * workbench Traffic Monitor passes the watched tab. Omit on DevTools
   * surfaces to inherit `hostNavigation.inspectedTabId()`.
   */
  readonly tabId?: number;
  /**
   * Override the port-name encoder — the workbench console pane passes
   * `qualifiedConsolePortName(tabId, nodeId)` so the daemon's relay
   * routes the watch to the owning extension peer. Defaults to the
   * local `oh-console:<tabId>` shape.
   */
  readonly portName?: (tabId: number) => string;
}

export interface UseConsoleClientResult {
  readonly snapshot: ConsoleClientSnapshot;
  readonly tabId: number | null;
  readonly store: ConsoleClientStore;
}

export function useConsoleClient(options: UseConsoleClientOptions = {}): UseConsoleClientResult {
  const storeRef = useRef<ConsoleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new ConsoleClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<ConsoleStreamWireMessage>({
    ...(options.tabId !== undefined ? { tabId: options.tabId } : {}),
    portName: options.portName ?? consoleStreamPortName,
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

  // Identity-stable API object — consumers key render callbacks and effects
  // on it, so a fresh literal per render would cascade re-renders.
  return useMemo(() => ({ snapshot, tabId, store }), [snapshot, tabId, store]);
}
