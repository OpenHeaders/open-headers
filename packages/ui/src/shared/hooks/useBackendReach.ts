/**
 * useBackendReach — live-tracked reach tiers, one entry per connection
 * (`OH.backendReach`, {@link BackendReachMap}): each connected backend
 * record writes its tier from its handshake WELCOME (cleared on that
 * wire's disconnect and at SW init), and a host running its own
 * ws-server publishes its bind tier under the reserved self entry.
 *
 * Two views cover every consumer:
 *   - `map`  — the raw per-connection entries; the Org icon reads a
 *     joined daemon Org's tier off its bound record's entry.
 *   - `self` — the host's OWN server-bind tier; feeds the home-Org
 *     host-kind hints ("Local server" vs "Remote server").
 *
 * `self` is `null` when no server is bound, or before the first
 * hydration completes. Same host-storage subscription shape as
 * {@link useIdentitySnapshot}.
 */

import type { BackendReach } from '@openheaders/core/protocol';
import type { BackendReachMap } from '@openheaders/core/storage';
import { getHostStorage, OH, SELF_BACKEND_REACH_KEY } from '@openheaders/core/storage';
import { useEffect, useState } from 'react';

export interface BackendReachView {
  /** Raw per-connection map — backend record ids plus the self entry. */
  map: BackendReachMap;
  /** The host's own server-bind tier; null when it serves nothing. */
  self: BackendReach | null;
}

const EMPTY: BackendReachView = { map: {}, self: null };

function toView(map: BackendReachMap | undefined): BackendReachView {
  if (!map || Object.keys(map).length === 0) return EMPTY;
  return { map, self: map[SELF_BACKEND_REACH_KEY] ?? null };
}

export function useBackendReach(): BackendReachView {
  const [view, setView] = useState<BackendReachView>(EMPTY);

  useEffect(() => {
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    const hydrate = (): void => {
      void storage.get(OH.backendReach).then((value) => {
        if (!cancelled) setView(toView(value));
      });
    };
    hydrate();
    const unsubscribe = storage.subscribe(OH.backendReach, hydrate);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return view;
}
