/**
 * `useJsContexts` — React hook that owns one `oh-contexts:<tabId>` port for
 * the panel's lifetime and exposes a stable `JsContextsClientSnapshot` via
 * `useSyncExternalStore`.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`; this file only owns the wire-message router and the
 * `JsContextsClientStore`.
 *
 * Replay-on-reconnect: every `ready` envelope clears the store before the
 * replayed live set lands — replay re-adds every live context, so clearing
 * first is what removes contexts that died while the port was down.
 */

import { type JsContextsWireMessage, jsContextsPortName } from '@openheaders/core/js-contexts';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import { useLifelineClient } from '../use-lifeline-client';
import { type JsContextsClientSnapshot, JsContextsClientStore } from './js-contexts-client-store';

export interface UseJsContextsResult {
  readonly snapshot: JsContextsClientSnapshot;
  readonly tabId: number | null;
  readonly store: JsContextsClientStore;
}

export function useJsContexts(): UseJsContextsResult {
  const storeRef = useRef<JsContextsClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new JsContextsClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<JsContextsWireMessage>({
    portName: jsContextsPortName,
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          store.clear();
          break;
        case 'contexts-update':
          switch (msg.update.kind) {
            case 'context-added':
              store.upsert(msg.update.context);
              break;
            case 'context-removed':
              store.remove(msg.update.contextKey);
              break;
            case 'tab-cleared':
              store.clear();
              break;
            default: {
              const _exhaustiveUpdate: never = msg.update;
              void _exhaustiveUpdate;
            }
          }
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
