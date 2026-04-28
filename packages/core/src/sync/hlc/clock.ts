/**
 * Physical-time source for HLC issuance. Abstracted so tests can pin
 * the clock and so the SW / desktop / CLI can plug their preferred
 * reading (monotonic where available, wall fallback — §25 Q1 lean).
 */
export interface WallClock {
  now(): number;
}

/**
 * Default browser/Node clock: prefers `performance.now()` referenced
 * to `performance.timeOrigin` (monotonic across pauses), ratcheted so
 * we never go backwards on a system clock adjustment.
 */
export function createDefaultWallClock(): WallClock {
  let last = 0;
  const hasPerf = typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number';
  return {
    now(): number {
      const raw = hasPerf ? performance.timeOrigin + performance.now() : Date.now();
      const next = raw > last ? raw : last + 1;
      last = next;
      return Math.floor(next);
    },
  };
}

/** Test helper — manually-advanceable clock. */
export function createManualClock(initial = 0): WallClock & { set(t: number): void; tick(by?: number): number } {
  let t = initial;
  return {
    now: () => t,
    set: (next: number) => {
      t = next;
    },
    tick: (by = 1) => {
      t += by;
      return t;
    },
  };
}
