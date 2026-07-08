/**
 * Login-gate decision logic — whether the tab may mount the Workbench
 * directly or must pair with its serving daemon first.
 *
 * The daemon requires a paired token on every connection (loopback
 * included — trust-by-process was retired when the token ledger
 * landed), so the gate applies wherever the daemon is reachable and no
 * token is stored yet. A token check is a REAL handshake: the entered
 * token rides a HELLO and only a WELCOME accept persists it. The tab
 * stays offline-first — an unreachable daemon (or an explicit skip)
 * mounts the Workbench on local data alone.
 */

import type { InitiatorState } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import { hasDaemonToken, persistDaemonToken, setCandidateDaemonToken } from './daemon-token';
import type { DaemonWire } from './daemon-wire';

/** Budget for one join attempt to reach a terminal outcome. */
const JOIN_OUTCOME_BUDGET_MS = 10_000;
/** Budget for the boot-time "is the daemon there at all" probe. */
const GATE_PROBE_TIMEOUT_MS = 1500;

export type JoinOutcome = 'joined' | 'auth-required' | 'offline';

/** The boot-time mount decision. */
export type GateDecision = 'mount' | 'gate';

/**
 * Decide the boot flow. A stored token mounts straight away (the wire
 * joins in the background); with none, a reachable daemon gates for
 * pairing — WITHOUT burning a tokenless HELLO against the daemon's
 * brute-force budget — and an unreachable one mounts offline-first.
 */
export async function decideGate(): Promise<GateDecision> {
  if (hasDaemonToken()) return 'mount';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GATE_PROBE_TIMEOUT_MS);
    const response = await fetch('/healthz', { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok ? 'gate' : 'mount';
  } catch {
    return 'mount';
  }
}

/**
 * Wait for the current join attempt to reach a terminal outcome. The
 * caller has already kicked the wire (`start()` / `reconnect()`); this
 * only observes. Handshake `rejected` with `auth-required` is the gate
 * signal; any other terminal state — including the transport giving up
 * into backoff — reads as offline.
 */
export function awaitJoinOutcome(wire: DaemonWire, budgetMs: number = JOIN_OUTCOME_BUDGET_MS): Promise<JoinOutcome> {
  return new Promise<JoinOutcome>((resolve) => {
    let done = false;
    let unsubscribeHandshake: () => void = () => undefined;
    let unsubscribeTransport: () => void = () => undefined;
    const finish = (outcome: JoinOutcome): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribeHandshake();
      unsubscribeTransport();
      resolve(outcome);
    };
    const timer = setTimeout(() => finish('offline'), budgetMs);

    const evaluateHandshake = (state: InitiatorState): void => {
      if (state === 'welcomed' || state === 'catching-up' || state === 'synced') {
        finish('joined');
        return;
      }
      if (state === 'rejected') {
        finish(wire.rejectReason() === 'auth-required' ? 'auth-required' : 'offline');
        return;
      }
      if (state === 'timed-out' || state === 'failed' || state === 'aborted') {
        finish('offline');
      }
    };

    unsubscribeHandshake = wire.subscribeHandshake(evaluateHandshake);
    // The transport backing off means the daemon never answered the
    // probe/open — no handshake outcome is coming on this attempt.
    unsubscribeTransport = wire.subscribeTransport((state) => {
      if (state === 'backoff' || state === 'idle') finish('offline');
    });
    evaluateHandshake(wire.handshakeState());
  });
}

/** Outcome of one token submission from the gate UI. */
export type TokenSubmitResult = { ok: true } | { ok: false; reason: 'rejected' | 'offline' };

/**
 * Try a candidate token: install it in memory, redial, and persist it
 * only when the daemon's WELCOME accepts the handshake.
 */
export async function submitDaemonToken(wire: DaemonWire, token: string): Promise<TokenSubmitResult> {
  setCandidateDaemonToken(token.trim());
  wire.reconnect();
  const outcome = await awaitJoinOutcome(wire);
  if (outcome === 'joined') {
    await persistDaemonToken();
    return { ok: true };
  }
  return { ok: false, reason: outcome === 'auth-required' ? 'rejected' : 'offline' };
}
