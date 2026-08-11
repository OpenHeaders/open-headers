/**
 * Drop-zone geometry for the bottom-panel split modes. The bottom
 * region's two zones divide its strip side by side in `columns` mode
 * and stack in `rows` mode; slot labels follow through
 * `dockSlotLabelKey`.
 */

import {
  type BottomPanelSplit,
  computeDropZoneRects,
  type DropZoneRectsInput,
  dockSlotLabelKey,
} from '@openheaders/ui/shared/dock-layout';
import { describe, expect, it } from 'vitest';

const input = (bottomPanelSplit: BottomPanelSplit): DropZoneRectsInput => ({
  shellSize: { width: 1200, height: 800 },
  sizes: {
    sidebar: { preferred: 280 },
    inspector: { preferred: 300 },
    bottom: { preferred: 240 },
  },
  bottomPanelAlignment: 'justify',
  bottomPanelSplit,
  barWidths: { left: 64, right: 64 },
});

describe('computeDropZoneRects — bottom panel split', () => {
  it('columns mode lays the bottom zones side by side', () => {
    const rects = computeDropZoneRects(input('columns'));
    expect(rects).not.toBeNull();
    const bl = rects!['bottom-left'];
    const br = rects!['bottom-right'];
    expect(bl.top).toBe(br.top);
    expect(bl.height).toBe(br.height);
    expect(bl.width).toBe(br.width);
    expect(bl.left + bl.width).toBeLessThanOrEqual(br.left);
  });

  it('rows mode stacks the bottom zones, bottom-left on top', () => {
    const rects = computeDropZoneRects(input('rows'));
    expect(rects).not.toBeNull();
    const bl = rects!['bottom-left'];
    const br = rects!['bottom-right'];
    expect(bl.left).toBe(br.left);
    expect(bl.width).toBe(br.width);
    expect(bl.height).toBe(br.height);
    expect(bl.top + bl.height).toBeLessThanOrEqual(br.top);
    // Both rows stay inside the bottom strip (top edge at 800 - 240).
    expect(bl.top).toBeGreaterThanOrEqual(560);
    expect(br.top + br.height).toBeLessThanOrEqual(800);
  });

  it('split mode leaves the side-region zones untouched', () => {
    const columns = computeDropZoneRects(input('columns'));
    const rows = computeDropZoneRects(input('rows'));
    for (const slot of ['left-top', 'left-bottom', 'right-top', 'right-bottom'] as const) {
      expect(rows![slot]).toEqual(columns![slot]);
    }
  });
});

describe('dockSlotLabelKey', () => {
  it('columns mode keeps the left/right bottom names', () => {
    expect(dockSlotLabelKey('bottom-left', 'columns')).toBe('shared.dock.slot.bottomLeft');
    expect(dockSlotLabelKey('bottom-right', 'columns')).toBe('shared.dock.slot.bottomRight');
  });

  it('rows mode renames the bottom slots to top/bottom', () => {
    expect(dockSlotLabelKey('bottom-left', 'rows')).toBe('shared.dock.slot.bottomTop');
    expect(dockSlotLabelKey('bottom-right', 'rows')).toBe('shared.dock.slot.bottomBottom');
  });

  it('side slots read the same in both modes', () => {
    expect(dockSlotLabelKey('left-top', 'rows')).toBe('shared.dock.slot.leftTop');
    expect(dockSlotLabelKey('right-bottom', 'rows')).toBe('shared.dock.slot.rightBottom');
  });
});
