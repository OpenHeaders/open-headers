/**
 * Applies a `ViewMode` to the live browser action button. Called from
 * the background SW (on startup + on storage changes) — never from
 * extension UI pages, since `chrome.action.setPopup` and
 * `chrome.sidePanel.setPanelBehavior` are SW-side APIs.
 *
 * The trick: when `default_popup` is empty, the action button fires
 * `onClicked` instead of opening a popup, and Chrome's
 * `openPanelOnActionClick: true` makes that click open the side panel.
 * Switching back restores the popup and disables the auto-open.
 *
 * Firefox lacks `chrome.sidePanel` — it uses `browser.sidebarAction`
 * which has no equivalent of `openPanelOnActionClick`. On Firefox we
 * still flip the popup off in sidepanel mode and rely on the user
 * opening the sidebar via Firefox's built-in sidebar menu or our
 * keyboard shortcut.
 */

import { isFirefox } from '@utils/browser-api';
import type { ViewMode } from '@openheaders/core/types';

const POPUP_PATH = 'popup.html';

interface SidePanelLike {
  setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
}

function getSidePanel(): SidePanelLike | null {
  const api = chrome as unknown as { sidePanel?: SidePanelLike };
  return api.sidePanel ?? null;
}

export async function applyViewMode(mode: ViewMode): Promise<void> {
  if (mode === 'popup') {
    await chrome.action.setPopup({ popup: POPUP_PATH });
    if (!isFirefox) {
      await getSidePanel()?.setPanelBehavior?.({ openPanelOnActionClick: false });
    }
    return;
  }

  // sidepanel mode: clear popup so action click fires onClicked, and
  // tell the side panel API to swallow that click into an open.
  await chrome.action.setPopup({ popup: '' });
  if (!isFirefox) {
    await getSidePanel()?.setPanelBehavior?.({ openPanelOnActionClick: true });
  }
}
