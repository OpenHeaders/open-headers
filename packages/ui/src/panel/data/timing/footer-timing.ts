/**
 * Footer milestone duration formatter — Finish / DOMContentLoaded / Load.
 *
 * Three bands:
 *   - below 1 s   → whole milliseconds ("840 ms")
 *   - below 1 min → seconds, 2 decimals ("12.34 s")
 *   - 1 min+      → minutes + seconds ("3 min 0.29 s", "2 min 38.74 s")
 *
 * The minute band keeps the seconds at full 2-decimal precision rather than
 * collapsing to a fractional-minute reading: "2 min 38.74 s" tells the user the
 * actual elapsed time, where a "2.6 min" form leaves them to do the math.
 * Returns '' for unknown / non-positive input so the caller can omit the chip.
 */
export function formatFooterDuration(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  // Round to centiseconds first, then split, so a value that rounds up to a
  // whole minute (e.g. 119.996 s) carries into the minute instead of reading
  // "1min60.00s".
  const totalCentiseconds = Math.round(ms / 10);
  if (totalCentiseconds < 6000) return `${(totalCentiseconds / 100).toFixed(2)} s`;
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = (totalCentiseconds - minutes * 6000) / 100;
  return `${minutes} min ${seconds.toFixed(2)} s`;
}
