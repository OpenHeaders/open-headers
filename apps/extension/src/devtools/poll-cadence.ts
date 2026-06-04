/**
 * Shared ramped polling cadence for the devtools page's `inspectedWindow`
 * probes (navigation timing, resource timing).
 *
 * A devtools page can't receive the inspected page's own load / resource
 * events without attaching a debugger, so it samples `performance` on a
 * timer instead: tight early so a fast page surfaces its load-time data
 * almost immediately, then backing off for the long tail of slow pages.
 * Each probe eval resolves in well under a millisecond.
 */

export const POLL_FAST_MS = 100;
export const POLL_FAST_WINDOW_MS = 2000;
export const POLL_SLOW_MS = 500;
export const POLL_MAX_MS = 20_000;

/** Delay before the next tick, given how long the poll has been running. */
export function rampedDelayMs(elapsedMs: number): number {
  return elapsedMs < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
}
