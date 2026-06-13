/**
 * `cdp-active-tab` — translates browser focus into "the current attachable
 * tab", the active-tab input of {@link CdpAttachController} (used by the
 * `active` / `both` scope modes).
 *
 * Singleton, not per-window: there is one current tab — the active tab of
 * the last-focused window. It follows `tabs.onActivated` (switch tabs),
 * `windows.onFocusChanged` (switch windows), and `tabs.onUpdated` (the
 * current tab navigates).
 *
 * The "no-thrash" rule (§ active mode): only an *attachable* current tab is
 * ever pushed. Focusing a non-attachable page (new-tab, `chrome://`,
 * extension page) is ignored, so the prior attachment is left in place
 * rather than detached and re-attached when focus passes through one on the
 * way to a real page. The held tab is only cleared (`null`) when it is
 * closed with no attachable tab taking its place, or when the current tab
 * itself navigates to a non-attachable URL.
 *
 * The chrome plumbing lives here so the controller stays effect-only over
 * its injected inputs. Inert when `tabs` is unavailable (non-Chromium / no
 * permission): construction is a no-op and the callback never fires — the
 * whole T2 plane is Chromium-only anyway.
 */

import { tabs, windows } from '@utils/browser-api.js';
import { logger } from '@utils/logger';
import { isTrackableUrl } from '../modules/url-utils';

export interface CdpActiveTab {
  /** Detach the listeners. Tests / SW shutdown only. */
  dispose(): void;
}

export interface CdpActiveTabOptions {
  /** The current attachable tab changed (`null` = none / cleared). */
  onActiveTab(tabId: number | null): void;
}

export function startCdpActiveTab(options: CdpActiveTabOptions): CdpActiveTab {
  if (!tabs?.query) {
    logger.info('CdpActiveTab', 'tabs API unavailable — active-tab scope disabled');
    return { dispose: () => {} };
  }

  let lastPushed: number | null = null;
  const push = (next: number | null): void => {
    if (next === lastPushed) return;
    lastPushed = next;
    options.onActiveTab(next);
  };

  // Query the one current tab (active tab of the last-focused window).
  // Attachable → push it; unattachable → keep the prior (no-thrash), or
  // clear when `clearWhenUnattachable` (the held tab just closed).
  const resolveCurrent = (clearWhenUnattachable: boolean): void => {
    tabs.query({ active: true, lastFocusedWindow: true }, (list: chrome.tabs.Tab[]) => {
      const tab = list?.[0];
      const id = tab && typeof tab.id === 'number' ? tab.id : null;
      if (id !== null && tab?.url && isTrackableUrl(tab.url)) {
        push(id);
      } else if (clearWhenUnattachable) {
        push(null);
      }
    });
  };

  const onActivated = (): void => resolveCurrent(false);
  const onFocusChanged = (windowId: number): void => {
    if (windows && windowId === windows.WINDOW_ID_NONE) return;
    resolveCurrent(false);
  };
  const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): void => {
    if (!changeInfo.url || !tab.active) return;
    if (isTrackableUrl(changeInfo.url)) push(tabId);
    else if (tabId === lastPushed) push(null);
  };
  const onRemoved = (tabId: number): void => {
    if (tabId === lastPushed) resolveCurrent(true);
  };

  tabs.onActivated?.addListener(onActivated);
  tabs.onUpdated?.addListener(onUpdated);
  tabs.onRemoved?.addListener(onRemoved);
  windows?.onFocusChanged?.addListener(onFocusChanged);

  // Seed with whatever is current right now (SW wake / install).
  resolveCurrent(false);

  return {
    dispose: () => {
      try {
        tabs.onActivated?.removeListener(onActivated);
        tabs.onUpdated?.removeListener(onUpdated);
        tabs.onRemoved?.removeListener(onRemoved);
        windows?.onFocusChanged?.removeListener(onFocusChanged);
      } catch {
        /* already gone — SW shutdown */
      }
    },
  };
}
