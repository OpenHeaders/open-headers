import { describe, expect, it } from 'vitest';
import {
  CONSECUTIVE_REQUIRED,
  evaluateBootRegression,
  REGRESSION_THRESHOLD,
} from '@openheaders/core/sync';

describe('boot-regression', () => {
  it('does not regress when samples are within threshold', () => {
    const verdict = evaluateBootRegression({
      recentSamples: [100, 110, 115, 105],
      baselineMs: 100,
    });
    expect(verdict.regressed).toBe(false);
    expect(verdict.offending).toHaveLength(0);
  });

  it('does not regress on a single offending sample', () => {
    const verdict = evaluateBootRegression({
      recentSamples: [100, 100, 200],
      baselineMs: 100,
    });
    expect(verdict.regressed).toBe(false);
  });

  it('regresses when the last three consecutive samples exceed threshold', () => {
    const verdict = evaluateBootRegression({
      recentSamples: [100, 130, 130, 130],
      baselineMs: 100,
    });
    expect(verdict.regressed).toBe(true);
    expect(verdict.offending).toEqual([130, 130, 130]);
  });

  it('resets the streak on a clean sample between offenders', () => {
    const verdict = evaluateBootRegression({
      recentSamples: [200, 200, 100, 200, 200],
      baselineMs: 100,
    });
    // last two are offending but non-consecutive across the clean 100.
    expect(verdict.regressed).toBe(false);
  });

  it('handles an empty samples list as no regression', () => {
    expect(evaluateBootRegression({ recentSamples: [], baselineMs: 100 }).regressed).toBe(false);
  });

  it('returns no regression when baseline is non-positive (uninitialized)', () => {
    expect(evaluateBootRegression({ recentSamples: [9999, 9999, 9999], baselineMs: 0 }).regressed).toBe(false);
  });

  it('exposes the threshold + consecutive constants on the public surface', () => {
    expect(REGRESSION_THRESHOLD).toBeGreaterThan(1);
    expect(CONSECUTIVE_REQUIRED).toBeGreaterThanOrEqual(3);
  });
});
