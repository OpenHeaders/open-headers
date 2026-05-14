/**
 * Focus-first-dropdown-item helper.
 *
 * Ant Design mounts dropdown portal content asynchronously after the
 * trigger click, so a keyboard opener that needs to land focus inside
 * the menu has to poll until the menu DOM exists. This helper
 * centralizes the retry loop so every keyboard entry-point (workspace
 * Create menu, popup Add-Rule menu, popup Options menu) uses the same
 * frame-bounded retry budget instead of hand-rolling three copies.
 */

import { scheduleFrame } from '@openheaders/ui/shared/frame-scheduler';

const FIRST_ITEM_SELECTOR =
  '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:not(.ant-dropdown-menu-item-disabled)';

/**
 * Move keyboard focus to the first enabled item in whichever Ant
 * dropdown is currently open. Retries up to `attempts` animation
 * frames (default 5 ≈ 80 ms at 60 fps) to cover the gap between the
 * trigger click and antd's portal mount.
 *
 * No-op if the dropdown never opens within the budget.
 */
export function focusFirstDropdownItem(attempts = 5): void {
  const tryFocus = (remaining: number): void => {
    const firstItem = document.querySelector<HTMLElement>(FIRST_ITEM_SELECTOR);
    if (firstItem) {
      firstItem.focus();
      return;
    }
    if (remaining > 0) {
      scheduleFrame(() => tryFocus(remaining - 1));
    }
  };
  scheduleFrame(() => tryFocus(attempts));
}
