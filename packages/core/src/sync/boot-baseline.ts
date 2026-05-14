/**
 * T1 cold-start baseline pin (Phase A T3 input).
 *
 * The boot-regression gate (`boot-regression.ts`) consumes this value as
 * the divisor when computing per-sample ratios against
 * `boot.interactive`. The number is ground truth for "what cold-start
 * looked like at end of Phase A, before any further mutation pipeline
 * work." A non-zero pin is what makes the gate live — `evaluateBoot
 * Regression` short-circuits to `regressed: false` while the baseline is
 * 0 (intentional: we don't want a synthetic pass while measurement is
 * outstanding, but we also don't want to lie about a regression we
 * cannot have observed).
 *
 * Measurement procedure (capture against the head this constant ships
 * on; update the constant in the same commit):
 *
 *   1. Cold-load the unpacked extension: `chrome://extensions` → Reload.
 *   2. Open chrome://extensions → service worker logs, wait for
 *      observability hydration messages to settle.
 *   3. Open the workbench (or any surface bound to the SW), click
 *      System status → Diagnostic export, save the JSON.
 *   4. Filter `entries[]` by `subsystem === 'sync' && op === 'boot.
 *      interactive'`, read `context.phaseElapsedMs`.
 *   5. Repeat steps 1–4 three times. Average the three values.
 *   6. Update `BOOT_BASELINE_MS` to the rounded average.
 *
 * Three samples averaged keeps cache-prime variance from skewing the
 * baseline. The session-5 telemetry framework pins t=0 at host reactor
 * evaluation, so the value is wall-clock against `Date.now()`.
 *
 * Until the real measurement lands, the pinned value is 0 and the gate
 * is inert. The renderer-side UI guards on `BOOT_BASELINE_MS > 0` so it
 * doesn't surface a verdict while there's no comparator.
 */

export const BOOT_BASELINE_MS = 0;

/**
 * Number of recent `boot.interactive` samples the gate considers. The
 * `CONSECUTIVE_REQUIRED = 3` rule in `boot-regression.ts` walks
 * newest→oldest looking for a streak of offenders; sampling more than
 * 3–4 wakes back gives the streak room to start mid-window without
 * losing the very recent past.
 */
export const BOOT_REGRESSION_SAMPLE_WINDOW = 5;

export function getBootBaselineMs(): number {
  return BOOT_BASELINE_MS;
}
