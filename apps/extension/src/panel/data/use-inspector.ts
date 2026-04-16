/**
 * useInspector — React hook that owns the lifecycle of the inspector
 * port and exposes a stable `InspectorStore` snapshot via
 * `useSyncExternalStore`.
 *
 * On mount:
 *   - reads the inspected tab id (falls back to `null` if called
 *     outside a devtools context — makes the hook safe to import in
 *     unit tests)
 *   - opens `devtools-inspector:<tabId>` to the background
 *   - routes incoming `InspectorPortMessage`s into the store
 *   - reconnects automatically when the port disconnects (MV3
 *     service-worker eviction, background crash, etc.) so the panel
 *     survives idle periods without manual reload
 *
 * On unmount: disconnects the port and cancels any pending reconnect.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { InspectorPortMessage } from '@/background/modules/devtools-inspector-port';
import { InspectorStore } from './inspector-store';

/** Backoff for the panel→background port reconnect loop. */
const RECONNECT_DELAY_MS = 250;

function getInspectedTabId(): number | null {
  const devtoolsApi = (chrome as unknown as { devtools?: { inspectedWindow?: { tabId?: number } } }).devtools;
  const tabId = devtoolsApi?.inspectedWindow?.tabId;
  return typeof tabId === 'number' ? tabId : null;
}

export interface UseInspectorResult {
  entries: readonly ReturnType<InspectorStore['getSnapshot']>['entries'][number][];
  danglingFires: readonly ReturnType<InspectorStore['getSnapshot']>['danglingFires'][number][];
  tabId: number | null;
  ready: boolean;
  preserveLog: boolean;
  setPreserveLog: (value: boolean) => void;
  recording: boolean;
  setRecording: (value: boolean) => void;
  clear: () => void;
}

export function useInspector(): UseInspectorResult {
  const storeRef = useRef<InspectorStore | null>(null);
  if (!storeRef.current) storeRef.current = new InspectorStore();
  const store = storeRef.current;

  const readyRef = useRef(false);
  const tabIdRef = useRef<number | null>(getInspectedTabId());

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

    let activePort: chrome.runtime.Port | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handler = (msg: InspectorPortMessage) => {
      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          break;
        case 'fire':
          store.ingestFire(msg.record, msg.authoritative);
          break;
        case 'har':
          store.ingestHarEntry(msg.entry);
          break;
        case 'har-body':
          store.ingestHarBody(msg.body);
          break;
        case 'nav':
          store.onNavigated();
          break;
        default: {
          // Exhaustiveness guard — TypeScript flags any new
          // `InspectorPortMessage` variant that isn't handled above.
          const _exhaustive: never = msg;
          void _exhaustive;
        }
      }
    };

    const connect = () => {
      if (disposed) return;
      readyRef.current = false;
      const port = chrome.runtime.connect({ name: `devtools-inspector:${tabId}` });
      activePort = port;
      port.onMessage.addListener(handler);
      port.onDisconnect.addListener(() => {
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
          // Already disconnected — no-op.
        }
        activePort = null;
      }
    };
  }, [store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return {
    entries: snapshot.entries,
    danglingFires: snapshot.danglingFires,
    tabId: tabIdRef.current,
    ready: readyRef.current,
    preserveLog: store.getPreserveLog(),
    setPreserveLog: store.setPreserveLog,
    recording: store.getRecording(),
    setRecording: store.setRecording,
    clear: store.clear,
  };
}
