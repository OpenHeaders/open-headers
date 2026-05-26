/**
 * `useLifelineClient` — shared port-lifecycle hook for the panel's three
 * sibling lifeline channels (`oh-lifecycle:<tabId>`, `oh-page:<tabId>`,
 * `oh-fires:<tabId>`). Owns:
 *   - reading the inspected tab id from `hostNavigation` (`null` outside a
 *     devtools host → effect bails, hook is a safe no-op);
 *   - opening the port via `lifelineTransport.connect(portName(tabId))`;
 *   - the 250ms backoff reconnect loop on disconnect (SW eviction,
 *     background crash) and on connect throw ("Extension context
 *     invalidated" when the panel outlives an extension reload);
 *   - cleanup on unmount (cancel pending reconnect, disconnect active
 *     port).
 *
 * Per-channel concerns stay with the caller: the wire-message type
 * generic `TWire`, the message routing (replay-on-`ready` clears for
 * lifecycle + page; fire is upsert-only because engine dedup makes
 * re-emits idempotent), and the per-channel client store.
 */

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import { useEffect, useRef } from 'react';

/** Backoff for the panel→background port reconnect loop. */
const RECONNECT_DELAY_MS = 250;

export interface UseLifelineClientOptions<TWire> {
  /** Per-channel port name encoder, e.g. `lifecyclePortName`. */
  readonly portName: (tabId: number) => string;
  /** Per-channel wire-message router. Called once per inbound frame. */
  readonly handler: (msg: TWire) => void;
}

export interface UseLifelineClientResult {
  readonly tabId: number | null;
}

export function useLifelineClient<TWire>(
  opts: UseLifelineClientOptions<TWire>,
): UseLifelineClientResult {
  const tabIdRef = useRef<number | null>(hostNavigation.inspectedTabId());

  const handlerRef = useRef(opts.handler);
  handlerRef.current = opts.handler;
  const portNameRef = useRef(opts.portName);
  portNameRef.current = opts.portName;

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

    let activePort: LifelinePort | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = (): void => {
      if (disposed) return;
      let port: LifelinePort;
      try {
        port = lifelineTransport.connect(portNameRef.current(tabId));
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
      port.onMessage<TWire>((msg) => {
        handlerRef.current(msg);
      });
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
  }, []);

  return { tabId: tabIdRef.current };
}
