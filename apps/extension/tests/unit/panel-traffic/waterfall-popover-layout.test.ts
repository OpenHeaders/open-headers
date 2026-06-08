/**
 * Popover-layout resolution — `auto` flips by panel width, explicit choices are
 * honored. The single resolver both decides the rendered component and the antd
 * placement in WaterfallBar, so the View toggle and the width-based auto-switch
 * stay one source of truth.
 */

import { HORIZONTAL_POPOVER_MIN_PX, resolvePopoverLayout } from '@openheaders/ui/panel/components/traffic/WaterfallBar';
import { describe, expect, it } from 'vitest';

describe('resolvePopoverLayout', () => {
  it('honors an explicit choice regardless of width', () => {
    expect(resolvePopoverLayout('vertical', 2000)).toBe('vertical');
    expect(resolvePopoverLayout('horizontal', 100)).toBe('horizontal');
  });

  it('auto picks vertical under a narrow (side-docked) panel', () => {
    expect(resolvePopoverLayout('auto', HORIZONTAL_POPOVER_MIN_PX - 1)).toBe('vertical');
    expect(resolvePopoverLayout('auto', 0)).toBe('vertical');
  });

  it('auto picks horizontal at/above the wide (bottom-docked) threshold', () => {
    expect(resolvePopoverLayout('auto', HORIZONTAL_POPOVER_MIN_PX)).toBe('horizontal');
    expect(resolvePopoverLayout('auto', 1600)).toBe('horizontal');
  });
});
