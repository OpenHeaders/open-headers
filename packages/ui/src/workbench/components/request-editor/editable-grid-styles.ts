/**
 * Presentation constants + injected hover CSS shared by the
 * `EditableGridTable` shell and its `SortableEditableRow` rows.
 */

import type React from 'react';

// Smallest a flex column shrinks to — also the resize-drag floor. Kept
// low so the default (all flex) still fits the narrow side-by-side
// request pane: 3 × MIN + the ~80px fixed columns stays under its ~288px
// content width, so columns flex to fit instead of forcing a horizontal
// scroll (the 180px floor this replaced summed to a ~620px hard minimum
// that overflowed). The min also stops a column vanishing when its
// neighbours are dragged wide.
export const RESIZE_MIN_WIDTH = 50;

// `minmax(MIN, 1fr)` flex track for a column with no user resize. Every
// cell sets `min-width: 0`, so inputs shrink with their column and
// scroll their own overflow internally.
export const DEFAULT_COLUMN_WIDTH = `minmax(${RESIZE_MIN_WIDTH}px, 1fr)`;

export const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

// One collapsed-cell line height (matches the cell field's middle
// minHeight). Rows top-align (`align-items: start`) so an expanded cell's
// first line lines up with its siblings; giving the small leading/
// trailing controls this min-height keeps them on that first line
// instead of floating to the top of a grown row.
export const ROW_CONTROL_HEIGHT = 32;

// Column-header label cell. `min-width: 0` + ellipsis so the label
// truncates within its (possibly narrow) flex column instead of
// spilling into the neighbouring column / trailing actions.
export const headerLabelStyle: React.CSSProperties = {
  padding: '6px 10px',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Hover-reveal for the drag handle + delete button (same transition so
// the row controls appear/disappear together), plus the hover highlight
// for the `⋯` options-menu rows. Injected once at module load so every
// usage shares the same CSS rule.
const STYLE_ID = 'editable-grid-row-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.editable-grid-row .editable-grid-drag-handle,
.editable-grid-row .editable-grid-delete { opacity: 0; transition: opacity 120ms ease; }
.editable-grid-row:hover .editable-grid-drag-handle,
.editable-grid-row:hover .editable-grid-delete { opacity: 1; }
.editable-grid-row .editable-grid-drag-handle:active { cursor: grabbing; }
.editable-grid-header .editable-grid-select-all { opacity: 0; transition: opacity 120ms ease; }
.editable-grid-header:hover .editable-grid-select-all { opacity: 1; }
.editable-grid-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.editable-grid-menu-item:hover {
  background: var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04));
}
  `;
  document.head.appendChild(style);
}
