/**
 * Pure-data layout helpers for `MergePane`.
 *
 * Extracted from the component so the grid-template + visibility
 * logic can be unit-tested without mounting Monaco. No React, no DOM,
 * no side effects.
 */

import type { GridRatios } from '../monaco/use-grid-resize';

export type MergeLayout = 'column' | 'show-base-top' | 'show-base-center';

const SASH_PX = 5;

export interface GridTemplate {
  areas: string;
  cols: string;
  rows: string;
  rowSash: boolean;
}

/**
 * Grid template for a given layout × pane availability. The sash
 * tracks live as fixed-pixel columns/rows in the template; the sash
 * elements themselves are grid items rendered by `MergePane`.
 *
 *   column (3-pane):    theirs sashL result sashR mine            (1 row)
 *   column (2-pane):    theirs sash  result                       (1 row)
 *   show-base-top:      base spans top, sashRow, theirs|result|mine row
 *   show-base-center:   theirs|base|mine row, sashRow, result spans bottom
 *
 * Layouts that need a base degrade to `column` when `baseAvailable`
 * is false.
 */
export function gridTemplate(
  layout: MergeLayout,
  has3Panes: boolean,
  baseAvailable: boolean,
  ratios: GridRatios,
): GridTemplate {
  const effectiveLayout: MergeLayout = baseAvailable ? layout : 'column';
  const sash = `${SASH_PX}px`;
  const [c0, c1, c2] = ratios.cols;
  const cols3 = `${c0}fr ${sash} ${c1}fr ${sash} ${c2}fr`;
  const cols2 = `${c0}fr ${sash} ${c1}fr`;
  const [r0, r1] = ratios.rows;
  const rows2 = `${r0}fr ${sash} ${r1}fr`;

  if (effectiveLayout === 'show-base-top' && has3Panes) {
    return {
      areas: `
        "base   base    base    base    base"
        "rsash  rsash   rsash   rsash   rsash"
        "theirs sashTL  result  sashTR  mine"
      `,
      cols: cols3,
      rows: rows2,
      rowSash: true,
    };
  }
  if (effectiveLayout === 'show-base-center' && has3Panes) {
    return {
      areas: `
        "theirs sashTL  base    sashTR  mine"
        "rsash  rsash   rsash   rsash   rsash"
        "result result  result  result  result"
      `,
      cols: cols3,
      rows: rows2,
      rowSash: true,
    };
  }
  // column
  if (has3Panes) {
    return {
      areas: `"theirs sashTL result sashTR mine"`,
      cols: cols3,
      rows: '1fr',
      rowSash: false,
    };
  }
  // 2-pane fallback
  return {
    areas: `"theirs sashTL result"`,
    cols: cols2,
    rows: '1fr',
    rowSash: false,
  };
}

export interface PaneVisibility {
  theirs: boolean;
  base: boolean;
  result: boolean;
  mine: boolean;
}

/** Whether each pane is a member of the active layout's template. */
export function paneVisibility(layout: MergeLayout, has3Panes: boolean, baseAvailable: boolean): PaneVisibility {
  const effectiveLayout: MergeLayout = baseAvailable ? layout : 'column';
  return {
    theirs: true,
    result: true,
    mine: has3Panes,
    base: baseAvailable && (effectiveLayout === 'show-base-top' || effectiveLayout === 'show-base-center'),
  };
}
