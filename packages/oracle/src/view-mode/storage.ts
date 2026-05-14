/**
 * Persistence for the action-button view mode. Uses the typed
 * `hostStorage` adapter with the `OH.viewMode` key spec — stored
 * in `chrome.storage.sync` so the preference follows the user across
 * machines.
 */

import { DEFAULT_VIEW_MODE, type ViewMode } from '@openheaders/core/types';
import { hostStorage, OH } from '../storage';

export async function getViewMode(): Promise<ViewMode> {
  const stored = await hostStorage.get(OH.viewMode);
  return stored ?? DEFAULT_VIEW_MODE;
}

export async function setViewMode(mode: ViewMode): Promise<void> {
  await hostStorage.set(OH.viewMode, mode);
}

/**
 * Subscribe to view-mode changes (e.g. another extension page flipped it).
 * Returns a disposer.
 */
export function onViewModeChanged(handler: (mode: ViewMode) => void): () => void {
  return hostStorage.subscribe(OH.viewMode, (next) => {
    if (next === 'popup' || next === 'sidepanel') handler(next);
  });
}
