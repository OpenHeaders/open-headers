/**
 * useOpenBeside — opens a tab beside the tab it is opened from: the
 * workflow view's "Open request" keeps the workflow in sight and shows
 * the request's own tab in the group next to it.
 *
 * The opener runs as it does from anywhere else — an open tab is shown,
 * a new one is added, with whatever the app hangs on that opener — and
 * the tab it showed is then stood beside the anchor's.
 */

import { useCallback } from 'react';
import type { UseEditorGroupsApi } from './editor-groups-shared';

/**
 * The narrowest half an editor is whole in. Measured on a request editor
 * in its stacked layout: whole at 545 px; at 494 px its script list
 * slips under its toolbar.
 */
const MIN_HALF_WIDTH = 540;

/** Where the group beside a group of that width stands: at its right where both halves keep their room, under it otherwise. */
export function besideDirection(groupWidth: number): 'right' | 'bottom' {
  return groupWidth / 2 >= MIN_HALF_WIDTH ? 'right' : 'bottom';
}

export type OpenBeside = (anchorTabId: string, open: () => void) => void;

/**
 * The anchor's group is read from the page, not from the tree: the
 * callback then keeps one identity through every tab switch, as each
 * tab body's props must.
 */
export function useOpenBeside(moveShownTabBeside: UseEditorGroupsApi['moveShownTabBeside']): OpenBeside {
  return useCallback(
    (anchorTabId, open) => {
      open();
      const group = document.querySelector(`[role="tab"][data-tab-id="${anchorTabId}"]`)?.closest('[data-leaf-id]');
      moveShownTabBeside(anchorTabId, besideDirection(group?.getBoundingClientRect().width ?? 0));
    },
    [moveShownTabBeside],
  );
}
