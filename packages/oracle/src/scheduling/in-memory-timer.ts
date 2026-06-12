/**
 * In-memory `setTimeout` implementation of the {@link RefreshTimer}
 * port — the substrate for an always-on host (the desktop main
 * process), and the scheduler core's own test timer. `setTimeout` is a
 * standard global in every runtime the schedulers target, so this
 * adapter is host-neutral code; what makes it desktop-only in practice
 * is that an evictable service worker cannot rely on in-memory timers
 * for long cadences (its substrate is `chrome.alarms`).
 *
 * No persistence, no codec ceremony, no wake reconcile — keys live and
 * die with the process.
 */

import type { RefreshTimer } from './timer';

/**
 * `setTimeout` clamps a delay above `2^31 - 1` ms (~24.8 days) to fire
 * almost immediately. A target past that horizon (e.g. an `expires-at`
 * far in the future) is armed in `MAX_TIMEOUT_MS` chunks: the timer
 * wakes and re-arms toward the same absolute target rather than firing.
 */
export const MAX_TIMEOUT_MS = 2_147_483_647;

export interface InMemoryRefreshTimer extends RefreshTimer {
  /** Cancel every armed key. Host teardown path (`before-quit`, tests). */
  clearAll(): void;
}

/**
 * Create an in-memory timer. `onFire` receives the armed key when its
 * target elapses — hosts route it into `RefreshScheduler.handleFire`.
 */
export function createInMemoryRefreshTimer(onFire: (key: string) => void): InMemoryRefreshTimer {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const arm = (key: string, atMs: number): void => {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);

    const delayMs = atMs - Date.now();
    if (delayMs > MAX_TIMEOUT_MS) {
      // Beyond the timer horizon — wake in a chunk and re-arm toward
      // the same absolute target (or fire if it has elapsed by then).
      const t = setTimeout(() => {
        timers.delete(key);
        arm(key, atMs);
      }, MAX_TIMEOUT_MS);
      timers.set(key, t);
      return;
    }

    const t = setTimeout(
      () => {
        timers.delete(key);
        onFire(key);
      },
      Math.max(0, delayMs),
    );
    timers.set(key, t);
  };

  return {
    available: true,
    arm,
    cancel(key: string): void {
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
        timers.delete(key);
      }
    },
    async listArmed(): Promise<readonly string[]> {
      return [...timers.keys()];
    },
    clearAll(): void {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}
