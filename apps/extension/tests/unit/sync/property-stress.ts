/**
 * P5 — sync property-test stress harness.
 *
 * Default runs keep numRuns small so the standard test command stays fast.
 * `STRESS_PROPERTY_TESTS=1 pnpm test:stress` scales every property up by
 * `STRESS_PROPERTY_SCALE` (default 15×) so all four buckets together exceed
 * 10 000 scenarios — the P5 acceptance threshold.
 */

const flag = process.env.STRESS_PROPERTY_TESTS;
const STRESS = flag === '1' || flag === 'true';

const parsedScale = Number.parseInt(process.env.STRESS_PROPERTY_SCALE ?? '15', 10);
const SCALE = STRESS && Number.isFinite(parsedScale) && parsedScale > 1 ? parsedScale : 1;

export const isStressMode = (): boolean => STRESS;
export const stressNumRuns = (base: number): number => Math.max(1, Math.floor(base * SCALE));
