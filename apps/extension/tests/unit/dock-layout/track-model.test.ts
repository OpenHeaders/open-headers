/**
 * track-model — the shell's CSS-track sizing helpers. A pane's size var
 * carries px in the pixel-stable model and a share of the grid in the
 * proportional model; drags clamp to whole pixels.
 */

import { clampTrack, trackValue } from '@openheaders/ui/shared/dock-layout';
import { describe, expect, it } from 'vitest';

describe('trackValue', () => {
  it('pixel-stable model carries whole px', () => {
    expect(trackValue(320.4, false, 1200)).toBe('320px');
  });

  it('proportional model carries the share of the grid', () => {
    expect(trackValue(300, true, 1200)).toBe('25.000%');
  });

  it('proportional model falls back to px before the grid is measured', () => {
    expect(trackValue(300, true, 0)).toBe('300px');
  });
});

describe('clampTrack', () => {
  it('rounds and clamps into [min, max]', () => {
    expect(clampTrack(259.6, 260, 600)).toBe(260);
    expect(clampTrack(310.4, 260, 600)).toBe(310);
    expect(clampTrack(900, 260, 600)).toBe(600);
  });
});
