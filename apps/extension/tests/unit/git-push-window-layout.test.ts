/**
 * Pure-model pins for the Push window's two sashes
 * (`push-window-layout.ts`): drag bounds never push a neighbour under
 * its floor, persisted drift degrades field by field, and the grid
 * templates read the model's custom properties.
 */

import {
  filesBounds,
  normalizePushWindowLayoutPrefs,
  PUSH_LAYOUT_DEFAULTS,
  PUSH_LAYOUT_MIN,
  PUSH_LAYOUT_VARS,
  pushColumnsTemplate,
  pushFilesRowsTemplate,
  pushInfoBounds,
} from '@openheaders/ui/workbench/components/panels/git/push/push-window-layout';
import { describe, expect, it } from 'vitest';

describe('push window layout bounds', () => {
  it('caps the files column at its share and never past the commits floor', () => {
    expect(filesBounds(1000)).toEqual({ min: PUSH_LAYOUT_MIN.files, max: 650 });
    // 600 wide: the share allows 390, the commits floor leaves 320.
    expect(filesBounds(600)).toEqual({ min: PUSH_LAYOUT_MIN.files, max: 320 });
    // Too narrow for both floors: the ceiling never drops under the floor.
    expect(filesBounds(400)).toEqual({ min: PUSH_LAYOUT_MIN.files, max: PUSH_LAYOUT_MIN.files });
  });

  it('the info row grows until the tree sits at its floor', () => {
    expect(pushInfoBounds(400)).toEqual({ min: PUSH_LAYOUT_MIN.info, max: 320 });
    expect(pushInfoBounds(100)).toEqual({ min: PUSH_LAYOUT_MIN.info, max: PUSH_LAYOUT_MIN.info });
  });
});

describe('push window layout prefs', () => {
  it('normalizes drift field by field and keeps shares inside (0, 1)', () => {
    expect(normalizePushWindowLayoutPrefs({})).toEqual(PUSH_LAYOUT_DEFAULTS);
    expect(normalizePushWindowLayoutPrefs({ filesShare: 0.6, infoShare: 1.4 })).toEqual({
      filesShare: 0.6,
      infoShare: PUSH_LAYOUT_DEFAULTS.infoShare,
    });
    expect(normalizePushWindowLayoutPrefs({ filesShare: Number.NaN, infoShare: 0 })).toEqual(PUSH_LAYOUT_DEFAULTS);
  });

  it('the templates read the custom properties and drop the info row when hidden', () => {
    expect(pushColumnsTemplate()).toBe(
      `minmax(${PUSH_LAYOUT_MIN.commits}px, 1fr) minmax(${PUSH_LAYOUT_MIN.files}px, calc(100% * var(${PUSH_LAYOUT_VARS.files})))`,
    );
    expect(pushFilesRowsTemplate(true)).toContain(`var(${PUSH_LAYOUT_VARS.info})`);
    expect(pushFilesRowsTemplate(false)).toBe('minmax(0, 1fr)');
  });
});
