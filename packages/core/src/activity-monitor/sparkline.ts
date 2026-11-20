/**
 * A sparkline as ONE path (the activity monitor plan §6, law 11): a
 * series, a box and the top of the scale in, the `d` of a single SVG
 * path out. Where the series holds nothing the pen lifts — a process
 * that did not exist yet draws no line, never a line at zero. A value
 * is the whole of the beat that ends at it, so a line starts where its
 * first beat began: one beat alone is a level, not a dot.
 */

import type { ActivityMonitorSeriesSample } from './history';

export function sparklinePath(
  samples: readonly ActivityMonitorSeriesSample[],
  width: number,
  height: number,
  top: number,
): string {
  let d = '';
  let down = false;
  let alone = false;
  /** Where the sample before this one sits; the box's left edge before the first. */
  let before = 0;
  for (const sample of samples) {
    const at = sample.x * width;
    if (sample.value === null) {
      // A point with nothing before it and a gap after is a zero-length stroke, which a round cap draws as a dot.
      if (alone) d += 'h0';
      down = false;
      alone = false;
    } else {
      const share = top > 0 ? Math.min(1, Math.max(0, sample.value / top)) : 0;
      const x = at.toFixed(1);
      const y = (height - 1 - share * (height - 2)).toFixed(1);
      const level = !down && before < at;
      d += down ? `L${x} ${y}` : level ? `M${before.toFixed(1)} ${y}L${x} ${y}` : `M${x} ${y}`;
      alone = !down && !level;
      down = true;
    }
    before = at;
  }
  return alone ? `${d}h0` : d;
}
