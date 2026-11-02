/**
 * contextMenuAlign — the overflow policy every git context menu
 * shares. A row near the window's bottom opens a menu taller than the
 * room on either side; antd's default for a point-aligned menu only
 * FLIPS, and keeps the side that shows more, so the tail (the Git
 * submenu, the last verbs) ran off the window. Shift lets the menu
 * slide up to fit the window the way a native menu does. Rides the
 * Dropdown's `align` prop (merged over the placement), the one typed
 * seam that reaches the trigger's shift flags.
 */

import type { DropdownProps } from 'antd';

export const contextMenuAlign: NonNullable<DropdownProps['align']> = {
  overflow: { adjustX: true, adjustY: true, shiftY: true },
};
