/**
 * Circuit gate for a live-workflow refresh fire — host-neutral, shared
 * by both live refresh providers (extension SW + desktop main) so the
 * dispatch-time circuit semantics cannot drift between hosts.
 *
 * Two steps, in order:
 *   1. Attempt gate — an OPEN circuit before `nextAttemptAt` refuses
 *      the dispatch (timers can wake "early" on some platforms, and
 *      racing reconciles could arm an attempt inside the backoff
 *      window). The caller skips without touching the state machine;
 *      its post-fire re-arm lines the next attempt up with
 *      `nextAttemptAt`.
 *   2. Probe-start transition — before an `open`-eligible probe runs,
 *      persist `open → half-open` so the UI shows "probing…" and a
 *      subsequent `recordRefreshError` correctly lands on the
 *      half-open branch of `onCircuitFailure` (which bumps the backoff
 *      curve). No-op for already-half-open / closed states.
 */

import { type CircuitSnapshot, canAttempt } from '@openheaders/core/live';
import { markProbeStartForRun } from './live-cache-store';

/**
 * Returns `false` when the circuit refuses the dispatch (caller skips
 * the refresh); `true` to proceed, with the open → half-open
 * probe-start already persisted when applicable. A `null` circuit
 * (never-failed row) always proceeds.
 */
export async function gateCircuitForFire(args: {
  circuit: CircuitSnapshot | null;
  workflowUid: string;
  environmentId: string | null;
  workspaceId: string;
  nowMs: number;
}): Promise<boolean> {
  const { circuit, workflowUid, environmentId, workspaceId, nowMs } = args;
  if (!circuit) return true;
  if (!canAttempt(circuit, nowMs)) return false;
  if (circuit.state === 'open') {
    await markProbeStartForRun(workflowUid, environmentId, nowMs, workspaceId);
  }
  return true;
}
