/**
 * Reconnect policy helpers shared by the long-lived session executors
 * (MQTT, WebSocket / Socket.IO) — the ONE backoff law: the wait before
 * an attempt is the entity's period, or under exponential backoff the
 * period doubled per attempt already failed with ±20 % jitter, capped
 * at the ceiling. Each executor owns its own loop (what "dropped" and
 * "opened" mean is protocol truth); the arithmetic lives once here.
 */

/** Wait between auto-reconnect attempts when the entity leaves the
 *  knob empty — the reference clients' order of magnitude; the loop
 *  runs until the peer is back or the user ends the session. */
export const DEFAULT_RECONNECT_PERIOD_MS = 5_000;

/** Ceiling on the doubled wait under exponential backoff — a period
 *  above it holds constant (never shrinks the entity's own wait). */
export const MAX_RECONNECT_BACKOFF_MS = 60_000;

/** Jitter span under backoff — the wait lands within ±20 % of the
 *  doubled period, so a fleet never redials in lockstep. */
export const RECONNECT_JITTER = 0.2;

/** Wait between client heartbeat frames when the entity names a
 *  heartbeat message but leaves the interval empty — under the
 *  common 60 s idle cut of load balancers. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

/** The wait before reconnect attempt `attempt` (1-based): the exact
 *  period, or under backoff the period doubled per attempt already
 *  failed, jittered by `random` (a draw in [0, 1)), the ceiling
 *  holding above everything. */
export function reconnectDelayMs(periodMs: number, attempt: number, backoff: boolean, random: number): number {
  if (!backoff) return periodMs;
  const ceiling = Math.max(periodMs, MAX_RECONNECT_BACKOFF_MS);
  const doubled = Math.min(periodMs * 2 ** (attempt - 1), ceiling);
  const jittered = Math.round(doubled * (1 - RECONNECT_JITTER + 2 * RECONNECT_JITTER * random));
  return Math.min(jittered, ceiling);
}
