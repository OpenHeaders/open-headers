/**
 * Shared animation-frame scheduler. Coalesces every one-shot
 * `requestAnimationFrame` callback across popup + workspace into a
 * single browser rAF per frame.
 *
 * Callers hand in a thunk via `scheduleFrame(fn)`; the first call in a
 * tick arms one rAF, and every subsequent call within the same tick
 * piggybacks onto that drain. The drain invokes callbacks in FIFO
 * order. New callbacks queued DURING the drain are pushed onto a fresh
 * queue and run in the NEXT frame — this keeps behavior predictable
 * and prevents unbounded same-frame loops when a retry-on-rAF pattern
 * re-queues itself.
 *
 * Use this for:
 *   - Post-React-commit DOM reads/writes (focus retries, scroll-into-view)
 *   - One-frame layout settling delays
 *
 * Do NOT use this for 60fps animation loops — the "run once and exit"
 * drain is not designed for sustained per-frame cadence. Call rAF
 * directly when you need a tick-per-frame animation (see
 * `src/delay/index.ts`).
 */

type FrameCallback = () => void;

let queue: FrameCallback[] = [];
let rafHandle: number | null = null;

function drain(): void {
  rafHandle = null;
  // Snapshot the current queue so callbacks queuing new work don't run
  // in this pass — they arm a fresh rAF for the next frame.
  const toRun = queue;
  queue = [];
  for (const fn of toRun) {
    try {
      fn();
    } catch (err) {
      // Match bare `requestAnimationFrame`: one broken callback must
      // not block the rest of the queue.
      console.error('[frame-scheduler] callback threw', err);
    }
  }
}

/**
 * Run `fn` on the next animation frame. Returns a cancel function
 * that removes the callback from the pending queue — a no-op if the
 * frame has already drained.
 */
export function scheduleFrame(fn: FrameCallback): () => void {
  queue.push(fn);
  if (rafHandle === null) {
    rafHandle = requestAnimationFrame(drain);
  }
  return () => {
    const idx = queue.indexOf(fn);
    if (idx >= 0) queue.splice(idx, 1);
  };
}

/**
 * Run `fn` after TWO animation frames. Useful when a caller needs to
 * wait for both the React commit AND a follow-up library style update
 * (e.g. Ant Design re-applies classes one frame after layout).
 */
export function scheduleNextFrame(fn: FrameCallback): () => void {
  let innerCancel: (() => void) | null = null;
  let cancelled = false;
  const outerCancel = scheduleFrame(() => {
    if (cancelled) return;
    innerCancel = scheduleFrame(fn);
  });
  return () => {
    cancelled = true;
    outerCancel();
    innerCancel?.();
  };
}
