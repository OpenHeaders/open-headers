/**
 * A sparkline as ONE path (the activity monitor plan §6, law 11): a
 * series, a box and the top of the scale in, the `d` of a single SVG
 * path out. Where the series holds nothing the pen lifts — a process
 * that did not exist yet draws no line, never a line at zero.
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
  for (const sample of samples) {
    if (sample.value === null) {
      // A point with a gap on both sides is a zero-length stroke, which a round cap draws as a dot.
      if (alone) d += 'h0';
      down = false;
      alone = false;
      continue;
    }
    const share = top > 0 ? Math.min(1, Math.max(0, sample.value / top)) : 0;
    const x = (sample.x * width).toFixed(1);
    const y = (height - 1 - share * (height - 2)).toFixed(1);
    d += `${down ? 'L' : 'M'}${x} ${y}`;
    alone = !down;
    down = true;
  }
  return alone ? `${d}h0` : d;
}
