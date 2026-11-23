/**
 * Picks the correct ViewModeAdapter for the runtime browser.
 *
 * Imported by both the SW (controller) and the renderer (transition
 * stub in install-navigation-host.ts). The adapters touch only APIs
 * that are valid in both contexts — except `bindToolbarForMode`, which
 * the SW alone calls.
 */

import { getBrowserAPI } from '@/types/browser';
import { isFirefox } from '@/utils/browser-runtime';
import type { ViewModeAdapter } from './adapter';
import { chromiumViewModeAdapter } from './adapter-chromium';
import { firefoxViewModeAdapter } from './adapter-firefox';
import { popupOnlyViewModeAdapter } from './adapter-popup-only';

/**
 * Whether this browser has a side panel to switch to. Firefox always has
 * its sidebar; elsewhere the manifest is the honest signal — the Chromium
 * builds hold the `sidePanel` permission, the Safari build does not.
 */
export function hasSidePanelSurface(): boolean {
  if (isFirefox) return true;
  return getBrowserAPI().runtime.getManifest().permissions?.includes('sidePanel') === true;
}

export function selectViewModeAdapter(): ViewModeAdapter {
  if (isFirefox) return firefoxViewModeAdapter;
  return hasSidePanelSurface() ? chromiumViewModeAdapter : popupOnlyViewModeAdapter;
}
