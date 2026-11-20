/**
 * A sparkline's path (the activity monitor plan §6, law 11; §7, fork
 * 8): one `d` for one path, the pen lifted where the series holds
 * nothing, a line starting where its first beat began, every value
 * drawn against the one top of scale it is given.
 */

import { describe, expect, it } from 'vitest';
import { cpuScaleTop } from '../../src/activity-monitor/format';
import type { ActivityMonitorSeriesSample } from '../../src/activity-monitor/history';
import { sparklinePath } from '../../src/activity-monitor/sparkline';

const series = (values: Array<number | null>): ActivityMonitorSeriesSample[] =>
  values.map((value, index) => ({ x: index / (values.length - 1), value }));

describe('sparklinePath', () => {
  it('draws one line across the box: zero a pixel above the floor, the top a pixel under the ceiling', () => {
    expect(sparklinePath(series([0, 0.5, 1]), 100, 14, 1)).toBe('M0.0 13.0L50.0 7.0L100.0 1.0');
  });

  it('lifts the pen where the series holds nothing, and starts again where the next value’s beat began', () => {
    expect(sparklinePath(series([0, 0, null, 1, 1]), 100, 14, 1)).toBe(
      'M0.0 13.0L25.0 13.0M50.0 1.0L75.0 1.0L100.0 1.0',
    );
  });

  it('draws nothing before the beat a process was first measured over', () => {
    expect(sparklinePath(series([null, null, 0, 0]), 90, 14, 1)).toBe('M30.0 13.0L60.0 13.0L90.0 13.0');
  });

  it('draws one beat alone as a level over that beat, never a dot', () => {
    expect(sparklinePath(series([null, 1, null]), 100, 14, 1)).toBe('M0.0 1.0L50.0 1.0');
    expect(sparklinePath([{ x: 1, value: 0.5 }], 100, 14, 1)).toBe('M0.0 7.0L100.0 7.0');
  });

  it('marks a first point with a gap after it as a dot — nothing is held of the time before it', () => {
    expect(sparklinePath(series([0, null, 1]), 100, 14, 1)).toBe('M0.0 13.0h0M50.0 1.0L100.0 1.0');
  });

  it('holds a value past the top at the top', () => {
    expect(sparklinePath(series([2.5, 0]), 100, 14, 1)).toBe('M0.0 1.0L100.0 13.0');
  });

  it('is empty for an empty series and for one that holds nothing', () => {
    expect(sparklinePath([], 100, 14, 1)).toBe('');
    expect(sparklinePath(series([null, null]), 100, 14, 1)).toBe('');
  });

  it('draws one full core at the top where "CPU %" counts per core', () => {
    const top = cpuScaleTop('darwin', 10);
    expect(sparklinePath(series([1, 0.5]), 100, 14, top)).toBe('M0.0 1.0L100.0 7.0');
  });

  it('draws the whole machine at the top on Windows — one core of eight is an eighth of the way up', () => {
    const top = cpuScaleTop('win32', 8);
    expect(sparklinePath(series([8, 1]), 100, 14, top)).toBe('M0.0 1.0L100.0 11.5');
  });
});
