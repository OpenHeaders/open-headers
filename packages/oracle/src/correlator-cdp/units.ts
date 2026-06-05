/**
 * Shared numeric units for the CDP correlator's HAR/page synthesis.
 *
 * Scaling fractional monotonic seconds to ms (`* 1000`) injects
 * representational noise (e.g. `0.1 * 1000 → 100.00000000002274`); without
 * rounding, otherwise-equal legs differ in their 11th decimal and a clean
 * total reads as a near-miss. Microsecond precision (3 decimals) is the
 * real resolution CDP's millisecond-as-double timings carry, so that is the
 * grain we round to.
 */

/** Round a millisecond quantity to microsecond precision. */
export function round3(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
