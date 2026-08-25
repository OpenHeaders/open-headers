/**
 * Admin-visibility probe — asks the daemon whether the calling subject
 * may administer it (`oh.daemon.admin.status`). Drives WHETHER admin
 * affordances render; it never authorizes anything — the server gates
 * every admin call per frame regardless of what this store reads.
 *
 * Resolution by host: the desktop renderer reaches its own spine over
 * IPC (the operator — always admin); the web tab forwards the probe up
 * the wire and reads its peer's `daemon.admin` resolution; hosts with
 * no daemon surface (extension) reject the channel and read `false`.
 *
 * ONE probe per session, shared: the answer lives in a module store so
 * synchronous readers (`availableToolWindows` gating the Server admin
 * dock window) and React surfaces (the hook) see the same fact, and a
 * late answer — the web tab's probe lands only after the wire
 * handshake — notifies every subscriber so the dock layout can
 * reconcile the window in.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useSyncExternalStore } from 'react';

export type ServerAdminStatus = 'unknown' | 'admin' | 'denied';

let status: ServerAdminStatus = 'unknown';
/** A real server answer landed — the fact is settled for this session. */
let definitive = false;
let inFlight = false;
let lastAttemptAt = 0;
const listeners = new Set<() => void>();

/** Floor between re-probes after a transport rejection — the web tab's
 *  probe can fire before the wire handshake, and the next render
 *  retries it once the cooldown passes. */
const RETRY_COOLDOWN_MS = 2_000;

function notify(): void {
  for (const listener of listeners) listener();
}

function setStatus(next: ServerAdminStatus): void {
  if (status === next) return;
  status = next;
  notify();
}

/**
 * Fire the probe. A response (either way) settles the store for the
 * session; a REJECTION — wire not yet joined, or a host with no daemon
 * surface — reads as `denied` for honesty but stays transient: any
 * later read past the cooldown asks again, so the answer arriving
 * after the handshake still reconciles the admin affordances in.
 */
function ensureProbe(): void {
  if (definitive || inFlight) return;
  const now = Date.now();
  if (now - lastAttemptAt < RETRY_COOLDOWN_MS) return;
  lastAttemptAt = now;
  inFlight = true;
  void hostBridge
    .call('oh.daemon.admin.status')
    .then((resp) => {
      // Settling is itself a state change even when the value stands
      // (transient denied → settled denied): the web mount decision
      // waits on `settled` before choosing a surface, so notify
      // unconditionally.
      definitive = true;
      status = resp.admin ? 'admin' : 'denied';
      notify();
    })
    .catch(() => setStatus('denied'))
    .finally(() => {
      inFlight = false;
    });
}

/** Synchronous read for non-React seams (the tool-window registry). */
export function getServerAdminStatus(): ServerAdminStatus {
  ensureProbe();
  return status;
}

/** True once a real server answer landed — `denied` before this point
 *  is a transient transport rejection, not a verdict. */
export function getServerAdminStatusSettled(): boolean {
  return definitive;
}

/**
 * Re-ask NOW, skipping the retry cooldown. For hosts that observe a
 * transport-level readiness signal — the web tab's wire handshake
 * completing — where the pre-join probe's rejection is known stale.
 * A settled answer stays settled; this never re-opens it.
 */
export function reprobeServerAdminStatus(): void {
  if (definitive || inFlight) return;
  lastAttemptAt = 0;
  ensureProbe();
}

export function subscribeServerAdminStatus(listener: () => void): () => void {
  ensureProbe();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam — resets the store so each rig starts unprobed. */
export function __resetServerAdminStatusForTests(): void {
  status = 'unknown';
  definitive = false;
  inFlight = false;
  lastAttemptAt = 0;
  listeners.clear();
}

export function useServerAdminStatus(): ServerAdminStatus {
  return useSyncExternalStore(subscribeServerAdminStatus, getServerAdminStatus, getServerAdminStatus);
}

export function useServerAdminStatusSettled(): boolean {
  return useSyncExternalStore(subscribeServerAdminStatus, getServerAdminStatusSettled, getServerAdminStatusSettled);
}
