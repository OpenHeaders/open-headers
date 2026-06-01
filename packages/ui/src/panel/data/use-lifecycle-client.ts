/**
 * `useLifecycleClient` — React hook that owns one `oh-lifecycle:<tabId>`
 * port for the panel's lifetime and exposes a stable
 * `LifecycleClientSnapshot` via `useSyncExternalStore`.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`; this file only owns the per-channel pieces: the
 * wire-message router, the `LifecycleClientStore`, and the snapshot
 * subscription.
 *
 * `ready` is intentionally absent from the return shape: the hub's
 * contract is "snapshot replay completes synchronously inside the same
 * delivery as the `ready` envelope," so there is no observable
 * connected-but-empty window from the consumer's POV. The empty
 * `snapshot.ordered` after first mount is the same as "no requests yet
 * on this tab" — the renderer doesn't need to distinguish.
 *
 * Watch session: the panel only shows requests observed after it started
 * watching, mirroring the browser's own Network panel. It owns a durable
 * session floor — the watermark reported in the first `ready` — and
 * sends it as the `subscribe` floor on every (re)connect, so the engine
 * replays only the session's requests. The floor persists for the
 * panel's lifetime (a `useRef`), so an SW-eviction reconnect restores
 * the session rather than re-surfacing pre-open history.
 *
 * Background-history toggle: when on, the panel re-subscribes with a `-1`
 * floor so the engine replays everything it has retained for the tab.
 * Flipping the toggle re-subscribes in place (no reconnect); each
 * `subscribe` precedes a fresh `ready`+replay, and the `ready` clears the
 * store so the replay is the canonical view.
 */

import {
  type LifecycleSubscribeMessage,
  type LifecycleWireMessage,
  lifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type LifecycleClientSnapshot, LifecycleClientStore } from './lifecycle-client-store';
import { useLifelineClient } from './use-lifeline-client';

export interface UseLifecycleClientResult {
  readonly snapshot: LifecycleClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: LifecycleClientStore;
  /** When true, the view includes requests captured before the panel opened. */
  readonly showBackgroundHistory: boolean;
  setShowBackgroundHistory(value: boolean): void;
}

export function useLifecycleClient(): UseLifecycleClientResult {
  const storeRef = useRef<LifecycleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new LifecycleClientStore();
  const store = storeRef.current;

  const [showBackgroundHistory, setShowBackgroundHistory] = useState(false);

  // Durable session floor — the watermark from the first `ready`. `null`
  // until then; once set, it never changes for the panel's lifetime so
  // reconnects keep the same session boundary.
  const floorRef = useRef<number | null>(null);

  // Rebuilt when the toggle flips — both the connect handshake and the
  // toggle effect read the latest one, so the effect's dependency on it
  // is a real (not ref-laundered) signal that the floor changed.
  const subscribeMessage = useCallback((): LifecycleSubscribeMessage => {
    // No floor learned yet → session-start (the engine floors at its
    // current watermark and reports it back in `ready`).
    if (floorRef.current === null) return { kind: 'subscribe' };
    // `-1` replays everything retained; the session floor replays only
    // requests observed since the panel opened.
    return { kind: 'subscribe', sinceMs: showBackgroundHistory ? -1 : floorRef.current };
  }, [showBackgroundHistory]);

  const { tabId, post } = useLifelineClient<LifecycleWireMessage>({
    portName: lifecyclePortName,
    onConnect: (send) => send(subscribeMessage()),
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          // First `ready` establishes the session floor; later ones (a
          // reconnect or a toggle re-subscribe) must not move it.
          if (floorRef.current === null) floorRef.current = msg.watermarkMs;
          // Every `ready` precedes a fresh replay; drop accumulated state
          // so the replay is the canonical view.
          store.clear();
          break;
        case 'lifecycle-update':
          store.apply(msg.update);
          break;
        case 'tab-cleared':
          // Upstream tab forgotten — drop the cache so we don't render
          // stale lifecycles against a tab that's gone.
          store.clear();
          break;
        default: {
          const _exhaustive: never = msg;
          void _exhaustive;
        }
      }
    },
  });

  // Re-subscribe in place when the toggle flips. Skip the initial mount —
  // `onConnect` already sent the first subscribe.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    post(subscribeMessage());
  }, [post, subscribeMessage]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId, store, showBackgroundHistory, setShowBackgroundHistory };
}
