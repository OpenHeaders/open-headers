/**
 * Picks the correct ViewModeAdapter for the runtime browser.
 *
 * Imported by both the SW (controller) and the renderer (transition
 * stub in install-navigation-host.ts). The adapters touch only APIs
 * that are valid in both contexts — except `bindToolbarForMode`, which
 * the SW alone calls.
 */

import { isFirefox } from '@/utils/browser-runtime';
import type { ViewModeAdapter } from './adapter';
import { chromiumViewModeAdapter } from './adapter-chromium';
import { firefoxViewModeAdapter } from './adapter-firefox';

export function selectViewModeAdapter(): ViewModeAdapter {
  return isFirefox ? firefoxViewModeAdapter : chromiumViewModeAdapter;
}
