/**
 * backend-registry — React bindings over the `OH.backends` registry
 * (MULTI_BACKEND_PLAN.md §2). Generalizes the Phase-1 cap-1 facade:
 * surfaces read the whole list through {@link useBackends}; the hooks
 * lazily hydrate this context's mirror from host storage and keep it
 * hot via the persisted-slot subscription, the same per-context
 * discipline as `useIdentitySnapshot`. Mode is never stored — derive it
 * with `deriveBackendMode` from the settings schema vocabulary.
 */

import {
  getBackends,
  getPrimaryBackend,
  refreshBackendsFromHostStorage,
  subscribeBackends,
  watchBackendsInHostStorage,
} from '@openheaders/core/backends';
import { WS_SERVER_URL } from '@openheaders/core/protocol';
import type { BackendConnection } from '@openheaders/core/types';
import { useEffect, useSyncExternalStore } from 'react';

let hydrated = false;

/**
 * Hydrate this context's registry mirror once and keep it subscribed to
 * the persisted slot. Safe to call from every consumer; retried when
 * host storage wasn't installed yet at first call.
 */
export function ensureBackendsHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    watchBackendsInHostStorage();
    void refreshBackendsFromHostStorage().catch(() => {
      hydrated = false;
    });
  } catch {
    // Host storage not wired yet — retry on the next consumer.
    hydrated = false;
  }
}

/** The live registry list. Empty before any backend is added. */
export function useBackends(): readonly BackendConnection[] {
  useEffect(() => {
    ensureBackendsHydrated();
  }, []);
  return useSyncExternalStore(subscribeBackends, getBackends, getBackends);
}

/** Live entry #0 of the backend registry; null when none configured. */
export function usePrimaryBackend(): BackendConnection | null {
  useEffect(() => {
    ensureBackendsHydrated();
  }, []);
  return useSyncExternalStore(subscribeBackends, getPrimaryBackend, getPrimaryBackend);
}

/**
 * The address this client dials — entry #0's URL, or the loopback
 * default before any record exists (what a fresh "configure the desktop
 * app" flow starts from).
 */
export function primaryBackendUrl(): string {
  return getPrimaryBackend()?.url ?? WS_SERVER_URL;
}

/** Live {@link primaryBackendUrl}. */
export function usePrimaryBackendUrl(): string {
  usePrimaryBackend();
  return primaryBackendUrl();
}
