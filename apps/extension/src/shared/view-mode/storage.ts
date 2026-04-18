/**
 * Persistence for the action-button view mode. Uses the typed
 * `extensionStorage` adapter with the `OH.viewMode` key spec — stored
 * in `chrome.storage.sync` so the preference follows the user across
 * machines.
 */

import { extensionStorage, OH } from '@/shared/storage';
import { DEFAULT_VIEW_MODE, type ViewMode } from './types';

export async function getViewMode(): Promise<ViewMode> {
  const stored = await extensionStorage.get(OH.viewMode);
  return stored ?? DEFAULT_VIEW_MODE;
}

export async function setViewMode(mode: ViewMode): Promise<void> {
  await extensionStorage.set(OH.viewMode, mode);
}

/**
 * Subscribe to view-mode changes (e.g. another extension page flipped it).
 * Returns a disposer.
 */
export function onViewModeChanged(handler: (mode: ViewMode) => void): () => void {
  return extensionStorage.subscribe(OH.viewMode, (next) => {
    if (next === 'popup' || next === 'sidepanel') handler(next);
  });
}
