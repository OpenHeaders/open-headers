import { fitToolbarItems, type ToolbarOverflowItem } from '@openheaders/ui/shared/toolbar-overflow';
import { describe, expect, it } from 'vitest';

const item = (): ToolbarOverflowItem => ({ kind: 'item', extent: 24 });
const sep = (): ToolbarOverflowItem => ({ kind: 'separator', extent: 7 });

// hide | new update delete | gear expand collapse — the rail's shape in small.
const bar: ToolbarOverflowItem[] = [item(), sep(), item(), item(), item(), sep(), item(), item(), item()];
const fit = (available: number) => fitToolbarItems({ items: bar, available, gap: 2, moreExtent: 24 });

describe('fitToolbarItems', () => {
  it('keeps everything when the run fits', () => {
    // 7 items × 24 + 2 separators × 7 + 8 gaps × 2 = 198
    expect(fit(198)).toEqual({ visible: 9, overflowStart: 9 });
    expect(fit(400)).toEqual({ visible: 9, overflowStart: 9 });
  });

  it('reserves the chevron and folds the tail one pixel short of fitting', () => {
    // room = 197 - 24 - 2 = 171: hide(24) +2+7 +2+24 +2+24 +2+24 = 111, +2+7 = 120, +2+24 = 146, +2+24 = 172 > 171
    expect(fit(197)).toEqual({ visible: 7, overflowStart: 7 });
  });

  it('never ends the visible run on a separator and never opens the folded run with one', () => {
    // room = 146 - 26 = 120: the run reaches hide + sep + 3 items + sep (120) — the trailing separator is dropped
    // from the bar, and the folded run starts past it.
    expect(fit(146)).toEqual({ visible: 5, overflowStart: 6 });
  });

  it('folds everything but the chevron when even one item does not fit beside it', () => {
    expect(fit(30)).toEqual({ visible: 0, overflowStart: 0 });
  });

  it('is empty for an empty bar', () => {
    expect(fitToolbarItems({ items: [], available: 10, gap: 2, moreExtent: 24 })).toEqual({ visible: 0, overflowStart: 0 });
  });
});
