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
 * watching, mirroring the browser's own Network panel. The session floor
 * is owned ENGINE-SIDE, keyed by tab — the panel just sends one
 * `subscribe` ("my session") and the engine resolves the floor (and
 * persists it). That is what keeps the view stable across reconnects,
 * panel remounts, and SW restarts WITHOUT the panel carrying the floor
 * itself: a remount that reset a client-held floor used to drop in-flight
 * rows. Each `subscribe` precedes a fresh `ready`+replay, and the `ready`
 * clears the store so the replay is the canonical view.
 *
 * Clear: `clearSession` drops the local mirror AND tells the engine to
 * advance the session floor, so the reset survives a later reconnect
 * (otherwise the engine would replay the cleared requests back in).
 */

import {
  type LifecycleClearSessionMessage,
  type LifecycleRequestBodyMessage,
  type LifecycleSource,
  type LifecycleSubscribeMessage,
  type LifecycleWireMessage,
  lifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLifelineClient } from '../use-lifeline-client';
import { type LifecycleClientSnapshot, LifecycleClientStore } from './lifecycle-client-store';

export interface UseLifecycleClientResult {
  readonly snapshot: LifecycleClientSnapshot;
  readonly tabId: number | null;
  /** Underlying store — surfaced so `usePanelUiState` can clear it. */
  readonly store: LifecycleClientStore;
  /**
   * Current DevTools-session token reported on the `ready` envelope, or
   * `null` until the engine has seen the session message. Session-scoped
   * panel state (open editor tabs) gates restoration on it: a matching token
   * survives an in-session reconnect/remount; a changed token means a new
   * DevTools session, so that state is dropped.
   */
  readonly sessionToken: string | null;
  /**
   * Which correlator feeds the inspected tab. `'cdp'` means the rows are
   * the higher-fidelity CDP view (drives the "CDP-enhanced" badge);
   * defaults to `'heuristic'` until the engine reports otherwise.
   */
  readonly source: LifecycleSource;
  /**
   * Clear the panel's view: drop the local mirror AND advance the
   * engine-owned session floor so the reset survives a reconnect. Register
   * THIS (not `store`) as the panel's lifecycle resettable.
   */
  clearSession(): void;
  /**
   * Ask the engine to fetch one hop's response body on demand (CDP rows
   * carry no body until asked). De-duped per `(requestId, hopIndex)` so the
   * panel can call it freely from a render effect; the body lands as a
   * `body-attached` update on the push channel. The de-dupe is cleared on
   * reconnect, so a fetch interrupted by an SW eviction is re-issued.
   */
  requestResponseBody(requestId: string, hopIndex: number): void;
}

export interface UseLifecycleClientOptions {
  /**
   * Bind a fixed partition instead of the inspected tab — the daemon
   * proxy capture source passes `PROXY_LIFECYCLE_TAB_ID`. Omit on
   * DevTools surfaces to inherit `hostNavigation.inspectedTabId()`.
   */
  readonly tabId?: number;
  /**
   * Override the port-name encoder — the workbench Live Network view
   * passes `qualifiedLifecyclePortName(tabId, nodeId)` so the daemon's
   * relay routes the watch to the owning extension peer. Defaults to
   * the local `oh-lifecycle:<tabId>` shape.
   */
  readonly portName?: (tabId: number) => string;
}

export function useLifecycleClient(options: UseLifecycleClientOptions = {}): UseLifecycleClientResult {
  const storeRef = useRef<LifecycleClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new LifecycleClientStore();
  const store = storeRef.current;
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [source, setSource] = useState<LifecycleSource>('heuristic');
  // Body fetches already issued this connection, keyed `${requestId}:${hop}`,
  // so a render-driven request fires at most once per hop. Cleared on
  // (re)connect: a fresh `ready` replays the rows with empty body slots, so
  // a fetch lost to an SW eviction must be allowed to re-issue.
  const requestedBodiesRef = useRef<Set<string>>(new Set());

  // The session floor is engine-owned, so the panel never carries it: a
  // bare `subscribe` means "my watch session" and the engine resolves the
  // same floor on every reconnect/remount.
  const { tabId, post } = useLifelineClient<LifecycleWireMessage>({
    portName: options.portName ?? lifecyclePortName,
    ...(options.tabId !== undefined ? { tabId: options.tabId } : {}),
    onConnect: (send) => {
      requestedBodiesRef.current.clear();
      send({ kind: 'subscribe' } satisfies LifecycleSubscribeMessage);
    },
    handler: (msg) => {
      switch (msg.kind) {
        case 'ready':
          // Every `ready` precedes a fresh replay; drop accumulated state
          // so the replay is the canonical view.
          store.clear();
          // Adopt the session token (absent until the engine has seen the
          // session message); a reconnect within the same session re-reports
          // the same value, so this is a no-op then.
          if (msg.sessionToken != null) setSessionToken(msg.sessionToken);
          break;
        case 'lifecycle-update':
          store.apply(msg.update);
          break;
        case 'tab-cleared':
          // Upstream tab forgotten — drop the cache so we don't render
          // stale lifecycles against a tab that's gone.
          store.clear();
          break;
        case 'source':
          // Per-tab provenance for the "CDP-enhanced" badge; carries no
          // request data, so the store is untouched.
          setSource(msg.source);
          break;
        default: {
          const _exhaustive: never = msg;
          void _exhaustive;
        }
      }
    },
  });

  // Clear: drop the local mirror and advance the engine session floor so
  // the cleared requests do not replay back in on the next reconnect.
  const clearSession = useCallback(() => {
    store.clear();
    post({ kind: 'clear-session' } satisfies LifecycleClearSessionMessage);
  }, [store, post]);

  const requestResponseBody = useCallback(
    (requestId: string, hopIndex: number) => {
      const key = `${requestId}:${hopIndex}`;
      if (requestedBodiesRef.current.has(key)) return;
      requestedBodiesRef.current.add(key);
      post({ kind: 'request-body', requestId, hopIndex } satisfies LifecycleRequestBodyMessage);
    },
    [post],
  );

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Identity-stable API object — consumers key render callbacks and effects
  // on it, so a fresh literal per render would cascade re-renders.
  return useMemo(
    () => ({ snapshot, tabId, store, sessionToken, source, clearSession, requestResponseBody }),
    [snapshot, tabId, store, sessionToken, source, clearSession, requestResponseBody],
  );
}
