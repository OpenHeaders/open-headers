import {
  fittedScale,
  wheelZoomFactor,
  zoomedScale,
  zoomOutStopOf,
} from '@openheaders/ui/workbench/components/live/graph-zoom';
import { describe, expect, it } from 'vitest';

describe('wheelZoomFactor', () => {
  it('a wheel’s notch away zooms out by 0.0015 a unit', () => {
    // 100 units × 0.0015.
    expect(wheelZoomFactor({ deltaY: 100, ctrlKey: false })).toBeCloseTo(Math.exp(-0.15), 12);
  });

  it('a pinch — the control key set — zooms at ten times that', () => {
    // 4 units × 0.015.
    expect(wheelZoomFactor({ deltaY: -4, ctrlKey: true })).toBeCloseTo(Math.exp(0.06), 12);
    expect(wheelZoomFactor({ deltaY: 4, ctrlKey: true })).toBeCloseTo(Math.exp(-0.06), 12);
  });

  it('no one event zooms by more than two notches of a wheel', () => {
    // The control key over a real wheel: 100 units × 0.015 is 1.5, held at 200 × 0.0015.
    expect(wheelZoomFactor({ deltaY: 100, ctrlKey: true })).toBeCloseTo(Math.exp(-0.3), 12);
    expect(wheelZoomFactor({ deltaY: -100, ctrlKey: true })).toBeCloseTo(Math.exp(0.3), 12);
    expect(wheelZoomFactor({ deltaY: 400, ctrlKey: false })).toBeCloseTo(Math.exp(-0.3), 12);
  });
});

describe('fittedScale', () => {
  const pane = { width: 832, height: 632 };

  it('a box smaller than the pane is drawn at the most allowed', () => {
    // 800 / 400 and 600 / 300 are both 2.
    expect(fittedScale({ width: 400, height: 300 }, pane, 32, 1)).toBe(1);
  });

  it('a wide box is fitted by its width, the pad kept clear', () => {
    // 800 / 1600.
    expect(fittedScale({ width: 1600, height: 300 }, pane, 32, 1)).toBe(0.5);
  });

  it('a tall box is fitted by its height, however small that draws it', () => {
    // 600 / 6000.
    expect(fittedScale({ width: 400, height: 6000 }, pane, 32, 1)).toBe(0.1);
  });
});

describe('zoomedScale', () => {
  it('zooming out stops at half the fitted size', () => {
    expect(zoomOutStopOf(0.8)).toBe(0.4);
    expect(zoomedScale(1, 0.5, 0.6)).toBe(0.6);
    expect(zoomedScale(1, 0.75, 0.6)).toBe(0.75);
  });

  it('a view already under the stop stays where it is, and zooms in from there', () => {
    expect(zoomedScale(0.4, 0.5, 0.6)).toBe(0.4);
    expect(zoomedScale(0.4, 1.5, 0.6)).toBeCloseTo(0.6, 12);
  });

  it('zooming in stops at 2', () => {
    expect(zoomedScale(1.5, 1.5, 0.6)).toBe(2);
    expect(zoomedScale(2, 1.2, 0.6)).toBe(2);
  });
});
