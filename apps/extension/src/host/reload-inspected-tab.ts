/**
 * Reload the page a DevTools panel inspects.
 *
 * `inspectedWindow.reload()` is the host's own call and stays the path
 * wherever the panel frame is bound to its tab. Safari's panel frame is
 * not — it reads the tab id as −1 (see `inspected-tab-id`) — and a reload
 * from there closes Web Inspector instead of reloading the page, while a
 * `tabs.reload` issued from that frame does nothing. There the background
 * reloads the tab the devtools page named.
 *
 * No-ops outside a DevTools context: `chrome.devtools` is absent in the
 * popup, side panel, and tests.
 */

import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { inspectedTabId } from './inspected-tab-id';

interface InspectedWindowLike {
  tabId?: number;
  reload?: () => void;
}

export function reloadInspectedTab(): void {
  const inspectedWindow = (chrome as unknown as { devtools?: { inspectedWindow?: InspectedWindowLike } }).devtools
    ?.inspectedWindow;
  const boundTabId = inspectedWindow?.tabId;
  if (typeof boundTabId === 'number' && boundTabId < 0) {
    const tabId = inspectedTabId();
    if (tabId === null) return;
    void call('reloadTab', { tabId }).catch((error: Error) => {
      logger.info('Navigation', 'tab reload failed:', error.message);
    });
    return;
  }
  inspectedWindow?.reload?.();
}
