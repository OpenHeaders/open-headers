/**
 * Backend-connection registry — the persisted `OH.backends` list plus an
 * in-memory mirror for synchronous reads (MULTI_BACKEND_PLAN.md §2/§3).
 *
 * The list holds every back-end this app instance has joined: a URL, a
 * per-backend paired token, autoConnect, and the `enabled` kill switch.
 * The local host engine (extension SW / desktop embedded oracle) is tier
 * zero — always on, never a record here.
 *
 * Mirror discipline follows the identity registry: hosts refresh from
 * `HostStorage` at boot and subscribe the persisted slot for
 * cross-context changes; connection modules and UI read synchronously
 * through {@link getBackends} / {@link getPrimaryBackend}. Subscribers
 * fire only when the installed list actually changed, so a redundant
 * refresh never tears down a healthy socket.
 *
 * Phase-1 cap: the single-connection runtime reads entry #0 as "the"
 * backend. {@link updatePrimaryBackend} is the one writer — it creates
 * the entry with defaults on first write and patches it in place after.
 * The N-socket connection plane (Phase 2) generalizes the readers; the
 * record shape doesn't change.
 */

import { WS_SERVER_URL } from '../protocol';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { BackendConnection } from '../types';
import { createMutex } from '../utils/mutex';
import { uuidv7 } from '../utils/uuidv7';

let current: readonly BackendConnection[] = [];
const listeners = new Set<() => void>();

/**
 * Install the mirror; notify only when the list actually changed. An
 * unchanged install keeps the prior array reference so React snapshot
 * reads (`useSyncExternalStore`) stay stable, and a redundant refresh
 * never triggers a reconnect downstream.
 */
function install(next: readonly BackendConnection[]): void {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  for (const fn of [...listeners]) fn();
}

/** Synchronous read of the mirrored registry. Empty before first refresh. */
export function getBackends(): readonly BackendConnection[] {
  return current;
}

/** Entry #0 of the registry — "the" backend under the Phase-1 cap. */
export function getPrimaryBackend(): BackendConnection | null {
  return current[0] ?? null;
}

/** Subscribe to registry changes. Returned function unregisters. */
export function subscribeBackends(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Serializes every `OH.backends` read-modify-write cycle plus the
 * refresh path — the slot is a non-atomic `get`-then-`set`, and a
 * refresh interleaving a write could install a pre-write list last.
 */
const withBackendsLock = createMutex();

/**
 * Refresh the mirror from `HostStorage` — hosts call this at boot and
 * surfaces call it on mount, exactly like the identity snapshot.
 */
export function refreshBackendsFromHostStorage(): Promise<readonly BackendConnection[]> {
  return withBackendsLock(async () => {
    const stored = (await hostStorage.get(OH.backends)) ?? [];
    install(stored);
    return current;
  });
}

/**
 * Keep the mirror hot on cross-context writes (a settings-pane edit in
 * the workbench page landing in the SW, and vice versa). Returns the
 * unsubscribe function.
 */
export function watchBackendsInHostStorage(): () => void {
  return hostStorage.subscribe(OH.backends, (next) => {
    install(next ?? []);
  });
}

/** Fields a caller may patch on the primary record. */
export type BackendConnectionPatch = Partial<Omit<BackendConnection, 'id' | 'addedAt'>>;

function freshBackendConnection(): BackendConnection {
  return {
    id: uuidv7(),
    label: '',
    url: WS_SERVER_URL,
    authToken: '',
    autoConnect: true,
    enabled: false,
    addedAt: new Date().toISOString(),
    lastConnectedAt: null,
  };
}

/**
 * Patch entry #0, creating it with defaults (loopback URL, unpaired,
 * autoConnect on, disabled) when the registry is empty. The Phase-1
 * writer for every connection-shaped edit: URL, token, autoConnect, the
 * enabled kill switch, and the `lastConnectedAt` stamp.
 */
export function updatePrimaryBackend(patch: BackendConnectionPatch): Promise<BackendConnection> {
  return withBackendsLock(async () => {
    const stored = (await hostStorage.get(OH.backends)) ?? [];
    const base = stored[0] ?? freshBackendConnection();
    const next: BackendConnection = { ...base, ...patch };
    const list = [next, ...stored.slice(1)];
    await hostStorage.set(OH.backends, list);
    install(list);
    return next;
  });
}

/** Drop the in-memory mirror. Test-only. */
export function __clearBackendsForTests(): void {
  current = [];
  listeners.clear();
}

/**
 * Is this WebSocket URL reachable over the loopback interface — i.e. a
 * back-end on this same machine? Drives loopback-only affordances (the
 * active-workspace mirroring gate): a loopback desktop's active-workspace
 * changes mirror down to the joined browser, a LAN/WAN peer's never do.
 */
export function isLoopbackBackendUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '::1' || /^127\./.test(host);
  } catch {
    return false;
  }
}
