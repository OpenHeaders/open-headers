/**
 * computeDropZoneRects — the six dock drop-zone rectangles for the shell,
 * laid out *as if all six panels were open* (not the live region rects).
 * Pure geometry over the live shell measurement, the host's responsive
 * sizes, the bottom-panel alignment, and the measured activity-bar widths.
 * Returns null before the shell has been measured. Extracted from ShellLayout.
 */

import type { BottomPanelAlignment, BottomPanelSplit, DockSlot, DropZoneRect } from './types';

export interface DropZoneRectsInput {
  shellSize: { width: number; height: number };
  sizes: {
    sidebar: { preferred: number };
    inspector: { preferred: number };
    bottom: { preferred: number };
  };
  bottomPanelAlignment: BottomPanelAlignment;
  bottomPanelSplit: BottomPanelSplit;
  barWidths: { left: number; right: number };
}

export function computeDropZoneRects({
  shellSize,
  sizes,
  bottomPanelAlignment,
  bottomPanelSplit,
  barWidths,
}: DropZoneRectsInput): Record<DockSlot, DropZoneRect> | null {
  const fullW = shellSize.width;
  const fullH = shellSize.height;
  if (fullW === 0 || fullH === 0) return null;

  const preferredSidebar = sizes.sidebar.preferred;
  const preferredInspector = sizes.inspector.preferred;
  const preferredBottom = sizes.bottom.preferred;

  // Drop zones reflect the layout *as if all six panels were open* —
  // not the live region rects. Per-alignment math gives each side
  // the height it would have if the bottom panel were also expanded,
  // so sidebars get pushed up by `preferredBottom` only on the
  // alignments where the bottom panel actually shares their column.
  let leftHeight: number;
  let rightHeight: number;
  let bottomLeft: number;
  let bottomWidth: number;

  // Drop-zone math reads `bottomPanelAlignment` (the user's
  // setting), not `effectiveAlignment` (what's currently rendered).
  // When the bottom region is closed the rendered tree may still be
  // a stale variant — but a drop into a bottom slot will OPEN the
  // bottom region, at which point `effectiveAlignment` syncs to the
  // setting and the panel lands in the position the drop zone
  // previewed. Anything else would mismatch the visual hint with
  // the actual destination.
  if (bottomPanelAlignment === 'center') {
    leftHeight = fullH;
    rightHeight = fullH;
    bottomLeft = barWidths.left + preferredSidebar;
    bottomWidth = Math.max(0, fullW - barWidths.left - barWidths.right - preferredSidebar - preferredInspector);
  } else if (bottomPanelAlignment === 'justify') {
    leftHeight = Math.max(0, fullH - preferredBottom);
    rightHeight = Math.max(0, fullH - preferredBottom);
    bottomLeft = barWidths.left;
    bottomWidth = Math.max(0, fullW - barWidths.left - barWidths.right);
  } else if (bottomPanelAlignment === 'left') {
    leftHeight = Math.max(0, fullH - preferredBottom);
    rightHeight = fullH;
    bottomLeft = barWidths.left;
    bottomWidth = Math.max(0, fullW - barWidths.left - barWidths.right - preferredInspector);
  } else {
    // 'right'
    leftHeight = fullH;
    rightHeight = Math.max(0, fullH - preferredBottom);
    bottomLeft = barWidths.left + preferredSidebar;
    bottomWidth = Math.max(0, fullW - barWidths.left - barWidths.right - preferredSidebar);
  }

  // Outer inset against the shell edges / activity bars; HALF_GAP is
  // half of the gutter rendered between the two halves of a region.
  // Adjacent zones get `2 * HALF_GAP` of clear space between them
  // (HALF_GAP from each side). Outer edges get the same OUTER inset
  // against the activity bar / window border.
  const OUTER = 4;
  const HALF_GAP = 4;

  const splitVertical = (r: { left: number; top: number; width: number; height: number }) => {
    const top: DropZoneRect = {
      left: r.left + OUTER,
      top: r.top + OUTER,
      width: Math.max(0, r.width - OUTER * 2),
      height: Math.max(0, r.height / 2 - OUTER - HALF_GAP),
    };
    const bottom: DropZoneRect = {
      left: r.left + OUTER,
      top: r.top + r.height / 2 + HALF_GAP,
      width: Math.max(0, r.width - OUTER * 2),
      height: Math.max(0, r.height / 2 - OUTER - HALF_GAP),
    };
    return [top, bottom] as const;
  };

  const splitHorizontal = (r: { left: number; top: number; width: number; height: number }) => {
    const left: DropZoneRect = {
      left: r.left + OUTER,
      top: r.top + OUTER,
      width: Math.max(0, r.width / 2 - OUTER - HALF_GAP),
      height: Math.max(0, r.height - OUTER * 2),
    };
    const right: DropZoneRect = {
      left: r.left + r.width / 2 + HALF_GAP,
      top: r.top + OUTER,
      width: Math.max(0, r.width / 2 - OUTER - HALF_GAP),
      height: Math.max(0, r.height - OUTER * 2),
    };
    return [left, right] as const;
  };

  const [lt, lb] = splitVertical({ left: barWidths.left, top: 0, width: preferredSidebar, height: leftHeight });
  const [rt, rb] = splitVertical({
    left: fullW - barWidths.right - preferredInspector,
    top: 0,
    width: preferredInspector,
    height: rightHeight,
  });
  // Stacked (`rows`) mode: bottom-left is the upper row, bottom-right
  // the lower — same [first, second] order the columns mode uses.
  const [bl, br] = (bottomPanelSplit === 'rows' ? splitVertical : splitHorizontal)({
    left: bottomLeft,
    top: fullH - preferredBottom,
    width: bottomWidth,
    height: preferredBottom,
  });

  return {
    'left-top': lt,
    'left-bottom': lb,
    'right-top': rt,
    'right-bottom': rb,
    'bottom-left': bl,
    'bottom-right': br,
  };
}
