/**
 * useOptionMenu — the open state of a menu of OPTIONS (✓ rows tried one
 * against another: a pane's View Options, the graph's, the rail's
 * gear). A pick leaves it open, so the next option is one click away;
 * a click outside, its own button or Escape closes it. A menu of
 * actions is not one of these — it closes on its pick as menus do.
 */

import { useCallback, useState } from 'react';

export interface OptionMenu {
  open: boolean;
  /** antd's `Dropdown.onOpenChange`: a close that comes from a pick inside the menu is not taken. */
  onOpenChange: (next: boolean, info: { source: 'trigger' | 'menu' }) => void;
}

export function useOptionMenu(): OptionMenu {
  const [open, setOpen] = useState(false);
  const onOpenChange = useCallback((next: boolean, info: { source: 'trigger' | 'menu' }): void => {
    if (next || info.source === 'trigger') setOpen(next);
  }, []);
  return { open, onOpenChange };
}
