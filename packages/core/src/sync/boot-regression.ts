/**
 * Boot-time regression gate (Phase A T3).
 *
 * Pure decision module: given the post-Phase-A `boot.interactive`
 * elapsed-ms value and the T1 baseline (recorded at session-5 head,
 * commit `69f586d3`), report whether we've crossed the gate threshold.
 *
 * The threshold codifies §21 Phase A's "cold-start no worse than
 * baseline" acceptance: a single noisy wake doesn't fail the gate, but
 * three consecutive cold wakes more than 20% above baseline does. The
 * "three consecutive" rule keeps the signal robust under cache-prime
 * variance without burying a real regression behind a single lucky
 * sample.
 *
 * The gate isn't run from CI (the wall-clock value depends on the
 * physical machine the SW is wakings on). Renderer surfaces or
 * background diagnostics call this module with the recent
 * boot-interactive samples pulled from observability and surface the
 * verdict — Status footer banner, diagnostic export, or a CI workflow
 * that records production wakes.
 */

export interface BootRegressionInput {
  /** Most recent N samples of `boot.interactive` phaseElapsedMs, oldest-to-newest. */
  recentSamples: readonly number[];
  /** T1 baseline value captured at v5/data-model commit 69f586d3. */
  baselineMs: number;
}

export interface BootRegressionVerdict {
  /** True when the gate has tripped — caller should surface it. */
  regressed: boolean;
  /** The samples that exceeded the threshold, in input order. */
  offending: number[];
  /** Per-sample multiplier `sample / baseline` (1.20 == 20% over). */
  ratios: number[];
}

/** Multiplier above which a sample counts toward the gate. */
export const REGRESSION_THRESHOLD = 1.2;
/** Number of consecutive offending samples needed to trip. */
export const CONSECUTIVE_REQUIRED = 3;

export function evaluateBootRegression(input: BootRegressionInput): BootRegressionVerdict {
  const { recentSamples, baselineMs } = input;
  if (baselineMs <= 0) {
    return { regressed: false, offending: [], ratios: [] };
  }
  const ratios = recentSamples.map((s) => s / baselineMs);
  // Walk newest → oldest; require CONSECUTIVE_REQUIRED back-to-back over threshold.
  let streak = 0;
  const offending: number[] = [];
  for (let i = recentSamples.length - 1; i >= 0; i--) {
    if (ratios[i] > REGRESSION_THRESHOLD) {
      streak += 1;
      offending.unshift(recentSamples[i]);
      if (streak >= CONSECUTIVE_REQUIRED) break;
    } else {
      break;
    }
  }
  return {
    regressed: streak >= CONSECUTIVE_REQUIRED,
    offending,
    ratios,
  };
}
