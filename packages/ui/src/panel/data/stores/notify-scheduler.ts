/**
 * Notify-scheduler seam — decides *when* a client store's
 * `getSnapshot`-changed notification fans out to subscribers.
 *
 * The panel's client stores apply one mutation per inbound wire frame and
 * call `markDirty()` after each. Fanning out synchronously per frame makes
 * a heavy live capture re-run the whole `usePanelData` projection once per
 * event — O(n) per update, O(n²) across a capture. Coalescing the notify
 * to one per animation frame collapses a burst of mutations into a single
 * projection + render, regardless of burst size.
 *
 * This is a host-seam in the same shape as the lifeline / navigation
 * seams: production installs the rAF scheduler (lazily, the first time a
 * store notifies), tests swap in a synchronous or manual one. `markDirty`
 * reads the seam at call time, so a swap takes effect for every store —
 * including ones already constructed.
 *
 * `getSnapshot()` stays lazy-on-dirty (see `createSnapshotPublisher`), so
 * a synchronous read after `markDirty` still returns the latest state.
 * Only the *notify* is deferred — the data is never stale, the render is
 * merely batched.
 */

export interface NotifyScheduler {
  /**
   * Queue `flush` to run on the next frame. Re-queuing the same callback
   * before it runs keeps it queued exactly once, so N `schedule(notify)`
   * calls from one publisher coalesce to a single fan-out.
   */
  schedule(flush: () => void): void;
  /** Run every queued flush synchronously now and clear the queue. */
  flushNow(): void;
  /**
   * Optional: defer pending and newly-scheduled flushes for the next `ms`
   * milliseconds (extends, never shortens, an active hold). A flush burst
   * re-runs projections + renders on the main thread — the same thread a
   * manual scroll needs for its re-window commits — so surfaces that own a
   * scroll (the traffic table) hold flushes for a beat on each user scroll
   * event. Data is never lost: stores stay dirty and the burst fans out
   * when the hold expires.
   */
  holdFor?(ms: number): void;
}

export interface RafNotifySchedulerOptions {
  /**
   * Fallback delay (ms) for when `requestAnimationFrame` is paused. A
   * hidden DevTools panel or backgrounded tab never receives a frame, so
   * a timer races the frame: whichever fires first flushes the burst and
   * cancels the other. Without this a burst that lands while hidden would
   * be stranded until the panel is shown again.
   */
  readonly hiddenFallbackMs?: number;
  /**
   * Probed at arm time: `true` keeps the per-frame rAF cadence, `false`
   * skips the frame request so the burst flushes on the fallback timer
   * instead. Default probes `document.hasFocus()` — a visible but
   * UNFOCUSED window still receives frames at full rate, and every page
   * of the extension shares one renderer main thread, so a busy capture
   * flushing 60×/s in an unfocused devtools window starves the focused
   * window's main-thread work (input handling, scrollbar paints). Backing
   * off to the timer cadence caps that cost while the user works
   * elsewhere; refocusing restores per-frame updates on the next burst.
   */
  readonly preferFrameCadence?: () => boolean;
}

const DEFAULT_HIDDEN_FALLBACK_MS = 250;

const defaultPreferFrameCadence = (): boolean => typeof document === 'undefined' || document.hasFocus();

/**
 * Production scheduler. Coalesces per animation frame while the window
 * has focus, with a timeout fallback so a burst still flushes while the
 * frame loop is paused — and as the deliberate slower cadence while the
 * window is unfocused (see `preferFrameCadence`).
 */
export function createRafNotifyScheduler(options: RafNotifySchedulerOptions = {}): NotifyScheduler {
  const fallbackMs = options.hiddenFallbackMs ?? DEFAULT_HIDDEN_FALLBACK_MS;
  const preferFrameCadence = options.preferFrameCadence ?? defaultPreferFrameCadence;
  const hasRaf = typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function';
  const pending = new Set<() => void>();
  let frameHandle: number | null = null;
  let timerHandle: ReturnType<typeof setTimeout> | null = null;
  let holdUntil = 0;

  const disarm = (): void => {
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    if (timerHandle !== null) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }
  };

  const holdRemainingMs = (): number => Math.max(0, holdUntil - Date.now());

  const flushNow = (): void => {
    disarm();
    if (pending.size === 0) return;
    const batch = [...pending];
    pending.clear();
    for (const flush of batch) flush();
  };

  const arm = (): void => {
    if (frameHandle !== null || timerHandle !== null) return;
    const hold = holdRemainingMs();
    // Under an active hold the frame path stays disarmed — the burst waits
    // out the hold on a timer, then fans out.
    if (hold === 0 && hasRaf && preferFrameCadence()) frameHandle = requestAnimationFrame(flushNow);
    timerHandle = setTimeout(flushNow, Math.max(fallbackMs, hold));
  };

  return {
    schedule(flush) {
      pending.add(flush);
      arm();
    },
    flushNow,
    holdFor(ms) {
      const until = Date.now() + ms;
      if (until <= holdUntil) return;
      holdUntil = until;
      // A burst armed before (or during) the hold would still fire early —
      // re-arm it under the new deadline.
      if (pending.size > 0) {
        disarm();
        arm();
      }
    },
  };
}

/**
 * Synchronous scheduler — runs each flush the moment it is scheduled. No
 * coalescing; reproduces the pre-batching notify timing. Used by tests
 * asserting mutation→notify semantics, and available as the escape hatch
 * for any call site where a frame of latency is undesirable.
 */
export function createSyncNotifyScheduler(): NotifyScheduler {
  return {
    schedule(flush) {
      flush();
    },
    flushNow() {},
  };
}

export interface ManualNotifyScheduler extends NotifyScheduler {
  /** Number of distinct flushes queued and not yet run. */
  pendingCount(): number;
}

/**
 * Manual scheduler — queues flushes and runs them only on an explicit
 * `flushNow()`. Lets tests and the replay harness drive frame boundaries
 * deterministically (queue a burst → one `flushNow` → assert one notify).
 */
export function createManualNotifyScheduler(): ManualNotifyScheduler {
  const pending = new Set<() => void>();
  return {
    schedule(flush) {
      pending.add(flush);
    },
    flushNow() {
      if (pending.size === 0) return;
      const batch = [...pending];
      pending.clear();
      for (const flush of batch) flush();
    },
    pendingCount() {
      return pending.size;
    },
  };
}

let installed: NotifyScheduler | null = null;

/** Returns the installed scheduler, lazily creating the rAF default. */
export function getNotifyScheduler(): NotifyScheduler {
  if (installed === null) installed = createRafNotifyScheduler();
  return installed;
}

/**
 * Install (or replace) the active scheduler. Pass `null` to restore the
 * lazy rAF default — tests do this in teardown so a swapped scheduler
 * never leaks across cases.
 */
export function setNotifyScheduler(scheduler: NotifyScheduler | null): void {
  installed = scheduler;
}
