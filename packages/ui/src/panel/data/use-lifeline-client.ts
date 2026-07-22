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
 * re-emits idempotent), the per-channel client store, and (via
 * `onConnect`) any handshake the channel sends on connect — e.g. the
 * lifecycle channel posts its `subscribe` floor every (re)connect.
 *
 * `post` lets a channel send a frame on the live port at any time (a
 * no-op while disconnected) — used to re-subscribe in place when the
 * panel toggles which slice of history it wants.
 */

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useRef } from 'react';

/** Backoff for the panel→background port reconnect loop. */
const RECONNECT_DELAY_MS = 250;

export interface UseLifelineClientOptions<TWire> {
  /** Per-channel port name encoder, e.g. `lifecyclePortName`. */
  readonly portName: (tabId: number) => string;
  /**
   * Explicit tab id to bind, overriding `hostNavigation.inspectedTabId()`.
   * Surfaces that watch a fixed synthetic partition (the daemon proxy
   * capture source) pass it here; DevTools surfaces omit it and inherit
   * the inspected tab.
   */
  readonly tabId?: number;
  /** Per-channel wire-message router. Called once per inbound frame. */
  readonly handler: (msg: TWire) => void;
  /**
   * When `false`, the hook never opens the port — a safe no-op with a
   * `null`-ish transport footprint. Fixed per mount (read once, like
   * `tabId`): surfaces that toggle a lifeline remount with a fresh key.
   */
  readonly enabled?: boolean;
  /**
   * Called after every (re)connect with a sender bound to the fresh
   * port. Channels that open with a handshake (lifecycle `subscribe`)
   * post it here so it is re-sent automatically after an SW-eviction
   * reconnect.
   */
  readonly onConnect?: (post: (msg: unknown) => void) => void;
}

export interface UseLifelineClientResult {
  readonly tabId: number | null;
  /** Send a frame on the active port. No-op while disconnected. */
  readonly post: (msg: unknown) => void;
}

export function useLifelineClient<TWire>(opts: UseLifelineClientOptions<TWire>): UseLifelineClientResult {
  const tabIdRef = useRef<number | null>(
    opts.enabled === false ? null : (opts.tabId ?? hostNavigation.inspectedTabId()),
  );

  const handlerRef = useRef(opts.handler);
  handlerRef.current = opts.handler;
  const portNameRef = useRef(opts.portName);
  portNameRef.current = opts.portName;
  const onConnectRef = useRef(opts.onConnect);
  onConnectRef.current = opts.onConnect;
  const activePortRef = useRef<LifelinePort | null>(null);

  const post = useCallback((msg: unknown) => {
    const port = activePortRef.current;
    if (port === null) return;
    try {
      port.postMessage(msg);
    } catch {
      // Port died between the caller's check and here; the disconnect
      // handler will reconnect and onConnect will re-send the handshake.
    }
  }, []);

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

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
        activePortRef.current = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      activePortRef.current = port;
      port.onMessage<TWire>((msg) => {
        handlerRef.current(msg);
      });
      port.onDisconnect(() => {
        activePortRef.current = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
      // Re-run the channel's connect handshake (e.g. lifecycle subscribe)
      // against the fresh port.
      onConnectRef.current?.((msg) => {
        try {
          port.postMessage(msg);
        } catch {
          /* port already gone; reconnect will retry */
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const port = activePortRef.current;
      if (port) {
        try {
          port.disconnect();
        } catch {
          // Already disconnected.
        }
        activePortRef.current = null;
      }
    };
  }, []);

  return { tabId: tabIdRef.current, post };
}
