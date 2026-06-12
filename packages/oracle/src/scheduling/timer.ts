/**
 * Timer substrate port for the host-neutral `RefreshScheduler`.
 *
 * The cadence loop (reconcile, fire dispatch, orphan sweep, backoff
 * re-arm) is identical across hosts; the ONLY irreducibly host-specific
 * surface is how a "wake me at T for key K" is physically armed:
 *
 *   - The extension service worker is evictable, so its adapter rides
 *     `chrome.alarms` — keys ARE alarm names (they persist across
 *     eviction), `listArmed` reads `alarms.getAll()`, and fires arrive
 *     through the host's alarm dispatch, which routes them back into
 *     `RefreshScheduler.handleFire(key)`.
 *   - The desktop main process is always-on, so its adapter is the
 *     in-memory `setTimeout` map (`./in-memory-timer`) — no codec
 *     persistence, no wake ceremony.
 *
 * Keys are opaque strings minted by the consumer's identity codec
 * (`./codec`). They must be stable for a job identity and must carry the
 * provider's `keyPrefix` so the orphan sweep can scope to its own keys.
 */
export interface RefreshTimer {
  /**
   * False when the substrate is missing on this platform (e.g. the
   * alarms API absent in a browser build). The scheduler then declines
   * to arm and reports `schedule()` as skipped, exactly as if the job
   * were ineligible.
   */
  readonly available: boolean;

  /**
   * Arm (or overwrite) the wake-up for `key` at the absolute wall-clock
   * ms `atMs`. Idempotent by key — re-arming replaces the previous
   * target.
   */
  arm(key: string, atMs: number): void;

  /** Cancel the wake-up for `key`. No-op when none is armed. */
  cancel(key: string): void;

  /**
   * Every key currently armed. May include keys owned by other
   * schedulers sharing the substrate (the alarms adapter returns every
   * alarm name); the scheduler filters by its provider's `keyPrefix`.
   */
  listArmed(): Promise<readonly string[]>;
}
