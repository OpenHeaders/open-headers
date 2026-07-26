import {
  initialSingleSurface,
  regionHasContent,
  resolveSingleSurface,
  SINGLE_SURFACE_MAX_PX,
  TIER_LG_MIN_PX,
  TIER_MD_MIN_PX,
  TIER_SM_MIN_PX,
  TIER_XL_MIN_PX,
  tierAtMost,
  tierForWidth,
} from '@openheaders/ui/panel/responsive';
import type { DockSlot, DockState, ToolLayoutState } from '@openheaders/ui/shared/dock-layout';
import { describe, expect, it } from 'vitest';

type W = 'network' | 'storage' | 'matched-rules';

function layout(active: Partial<Record<DockSlot, W | null>> = {}): ToolLayoutState<W> {
  const dock = (slot: DockSlot): DockState<W> => {
    const win = active[slot] ?? null;
    return { windows: win ? [win] : [], active: win };
  };
  return {
    docks: {
      'left-top': dock('left-top'),
      'left-bottom': dock('left-bottom'),
      'right-top': dock('right-top'),
      'right-bottom': dock('right-bottom'),
      'bottom-left': dock('bottom-left'),
      'bottom-right': dock('bottom-right'),
    },
    hidden: [],
    zenSnapshot: null,
  };
}

describe('tierForWidth', () => {
  it('maps widths to tiers at the documented boundaries', () => {
    expect(tierForWidth(1920)).toBe('xl');
    expect(tierForWidth(TIER_XL_MIN_PX)).toBe('xl');
    expect(tierForWidth(TIER_XL_MIN_PX - 1)).toBe('lg');
    expect(tierForWidth(TIER_LG_MIN_PX)).toBe('lg');
    expect(tierForWidth(TIER_LG_MIN_PX - 1)).toBe('md');
    expect(tierForWidth(TIER_MD_MIN_PX)).toBe('md');
    expect(tierForWidth(TIER_MD_MIN_PX - 1)).toBe('sm');
    expect(tierForWidth(TIER_SM_MIN_PX)).toBe('sm');
    expect(tierForWidth(TIER_SM_MIN_PX - 1)).toBe('xs');
    expect(tierForWidth(0)).toBe('xs');
  });

  it('enters single-surface exactly below the md lower bound', () => {
    expect(SINGLE_SURFACE_MAX_PX).toBe(TIER_MD_MIN_PX);
  });
});

describe('tierAtMost', () => {
  it('orders tiers by available width', () => {
    expect(tierAtMost('md', 'md')).toBe(true);
    expect(tierAtMost('sm', 'md')).toBe(true);
    expect(tierAtMost('xs', 'md')).toBe(true);
    expect(tierAtMost('lg', 'md')).toBe(false);
    expect(tierAtMost('xl', 'md')).toBe(false);
    expect(tierAtMost('xl', 'xl')).toBe(true);
  });
});

describe('single-surface resolution', () => {
  it('regionHasContent sees either dock of the region', () => {
    const st = layout({ 'left-bottom': 'storage' });
    expect(regionHasContent('left', st)).toBe(true);
    expect(regionHasContent('right', st)).toBe(false);
    expect(regionHasContent('bottom', st)).toBe(false);
  });

  it('keeps a preferred region that has content', () => {
    const st = layout({ 'left-top': 'network' });
    expect(resolveSingleSurface('left', st)).toBe('left');
  });

  it('falls back to the editor when the preferred region is empty', () => {
    const st = layout({ 'left-top': 'network' });
    expect(resolveSingleSurface('right', st)).toBe('editor');
    expect(resolveSingleSurface('bottom', st)).toBe('editor');
  });

  it('editor preference is always honored', () => {
    expect(resolveSingleSurface('editor', layout({ 'left-top': 'network' }))).toBe('editor');
    expect(resolveSingleSurface('editor', layout())).toBe('editor');
  });

  it('initial surface: open document wins, else first region with content, else editor', () => {
    const st = layout({ 'left-top': 'network', 'bottom-right': 'matched-rules' });
    expect(initialSingleSurface(true, st)).toBe('editor');
    expect(initialSingleSurface(false, st)).toBe('left');
    expect(initialSingleSurface(false, layout({ 'bottom-right': 'matched-rules' }))).toBe('bottom');
    expect(initialSingleSurface(false, layout())).toBe('editor');
  });
});
