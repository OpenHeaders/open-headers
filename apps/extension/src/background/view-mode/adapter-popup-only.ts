/**
 * ViewModeAdapter for a browser with no side panel (Safari).
 *
 * The popup is the only surface, so the toolbar button stays bound to it
 * whatever mode is stored: a stored `sidepanel` would otherwise empty the
 * popup binding with nothing to open in its place, and the button would
 * do nothing. Every surface operation is a no-op — there is nothing to
 * open, close or query.
 */

import type { ViewMode } from '@openheaders/core/types';
import type { OpenContext, OpenResult, Surface, ViewModeAdapter } from './adapter';
import { POPUP_PATH } from './adapter-chromium';

export const popupOnlyViewModeAdapter: ViewModeAdapter = {
  async bindToolbarForMode(_mode: ViewMode): Promise<void> {
    await chrome.action.setPopup({ popup: POPUP_PATH });
  },

  async openFromRenderer(_surface: Surface): Promise<OpenResult> {
    return { opened: false };
  },

  async closeFromRenderer(_surface: Surface): Promise<void> {},

  async openFromSW(_surface: Surface, _ctx: OpenContext): Promise<OpenResult> {
    return { opened: false };
  },

  async closeFromSW(_surface: Surface, _ctx: OpenContext): Promise<void> {},

  async surfaceIsOpen(_surface: Surface, _ctx: OpenContext): Promise<boolean | null> {
    return null;
  },
};
