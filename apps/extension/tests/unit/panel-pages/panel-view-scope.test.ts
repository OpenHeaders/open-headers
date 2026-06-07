/**
 * `panel-view-scope` — the single recording-state scope predicate the
 * projection applies to both rows and pages. Pure function; tested directly
 * for the floor + recording-window composition and boundary inclusivity.
 */

import { isInView, type PanelViewScope } from '@openheaders/ui/panel/data/panel-view-scope';
import { describe, expect, it } from 'vitest';

describe('isInView', () => {
  it('no floor and no recording windows shows everything', () => {
    const scope: PanelViewScope = { navClearFloorMs: -1 };
    expect(isInView(0, scope)).toBe(true);
    expect(isInView(10_000, scope)).toBe(true);
  });

  it('navClearFloorMs is inclusive at the floor and excludes below it', () => {
    const scope: PanelViewScope = { navClearFloorMs: 1000 };
    expect(isInView(999, scope)).toBe(false);
    expect(isInView(1000, scope)).toBe(true);
    expect(isInView(1001, scope)).toBe(true);
  });

  it('recording windows are start-inclusive and end-exclusive', () => {
    const scope: PanelViewScope = { navClearFloorMs: -1, recordingWindows: [{ startMs: 100, endMs: 200 }] };
    expect(isInView(99, scope)).toBe(false);
    expect(isInView(100, scope)).toBe(true);
    expect(isInView(199, scope)).toBe(true);
    expect(isInView(200, scope)).toBe(false);
  });

  it('an open recording window (endMs null) extends to the future', () => {
    const scope: PanelViewScope = { navClearFloorMs: -1, recordingWindows: [{ startMs: 100, endMs: null }] };
    expect(isInView(99, scope)).toBe(false);
    expect(isInView(1_000_000, scope)).toBe(true);
  });

  it('drops the gap between two recording windows (stop → resume, no back-fill)', () => {
    const scope: PanelViewScope = {
      navClearFloorMs: -1,
      recordingWindows: [
        { startMs: 0, endMs: 100 },
        { startMs: 200, endMs: null },
      ],
    };
    expect(isInView(50, scope)).toBe(true);
    expect(isInView(150, scope)).toBe(false); // recording was stopped here
    expect(isInView(250, scope)).toBe(true);
  });

  it('requires BOTH axes — floor AND a recording window', () => {
    const scope: PanelViewScope = { navClearFloorMs: 1000, recordingWindows: [{ startMs: 0, endMs: 2000 }] };
    expect(isInView(500, scope)).toBe(false); // recorded but below the floor
    expect(isInView(1500, scope)).toBe(true); // above the floor and recorded
    expect(isInView(2500, scope)).toBe(false); // above the floor but not recorded
  });
});
