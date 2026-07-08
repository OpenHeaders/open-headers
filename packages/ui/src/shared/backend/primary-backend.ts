/**
 * primary-backend — React bindings + write facade over the `OH.backends`
 * registry's Phase-1 cap (entry #0 is "the" backend; see
 * MULTI_BACKEND_PLAN.md §6 Phase 1).
 *
 * Surfaces read the registry through {@link usePrimaryBackend}; the hook
 * lazily hydrates this context's mirror from host storage and keeps it
 * hot via the persisted-slot subscription, the same per-context
 * discipline as `useIdentitySnapshot`. Mode is never stored — derive it
 * with `deriveBackendMode` from the settings schema vocabulary.
 */

import {
  getPrimaryBackend,
  refreshBackendsFromHostStorage,
  subscribeBackends,
  updatePrimaryBackend,
  watchBackendsInHostStorage,
} from '@openheaders/core/backends';
import { WS_SERVER_URL } from '@openheaders/core/protocol';
import type { BackendConnection } from '@openheaders/core/types';
// Package-specifier import (not relative): it resolves through the
// dist type surface, keeping the settings-schema source graph out of
// consumers' typecheck programs — same idiom as `useBackendMode`.
import {
  type BackendMode,
  backendModeNeedsConnection,
  hostIsTheBackend,
} from '@openheaders/ui/workbench/settings/schema/backend';
import { useEffect, useSyncExternalStore } from 'react';
import { getCurrentHost, type Host } from '../host-vocabulary';

let hydrated = false;

/**
 * Hydrate this context's registry mirror once and keep it subscribed to
 * the persisted slot. Safe to call from every consumer; retried when
 * host storage wasn't installed yet at first call.
 */
export function ensurePrimaryBackendHydrated(): void {
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

/** Live entry #0 of the backend registry; null when none configured. */
export function usePrimaryBackend(): BackendConnection | null {
  useEffect(() => {
    ensurePrimaryBackendHydrated();
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

/**
 * Commit a derived-mode change onto the registry (the cap-1 mapping of
 * the retired `backend.mode` write): a tier-zero / host-is-the-backend
 * target disables entry #0 without forgetting its config; a connection
 * target enables it, creating the record with defaults on first use.
 */
export async function applyBackendMode(host: Host, next: BackendMode): Promise<void> {
  if (!backendModeNeedsConnection(next) || hostIsTheBackend(next, host)) {
    if (getPrimaryBackend()) await updatePrimaryBackend({ enabled: false });
    return;
  }
  await updatePrimaryBackend({ enabled: true });
}

/** {@link applyBackendMode} for the running host. */
export function applyBackendModeForCurrentHost(next: BackendMode): Promise<void> {
  return applyBackendMode(getCurrentHost(), next);
}
