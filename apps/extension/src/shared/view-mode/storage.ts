/**
 * Persistence for the action-button view mode. Uses `chrome.storage.sync`
 * so the preference follows the user across machines — same store the
 * other UI prefs use (settings store, popup tab).
 */

import { getBrowserAPI } from '@/types/browser';
import { DEFAULT_VIEW_MODE, VIEW_MODE_STORAGE_KEY, type ViewMode } from './types';

function isViewMode(value: unknown): value is ViewMode {
  return value === 'popup' || value === 'sidepanel';
}

export function getViewMode(): Promise<ViewMode> {
  return new Promise((resolve) => {
    const api = getBrowserAPI();
    api.storage.sync.get([VIEW_MODE_STORAGE_KEY], (result: Record<string, unknown>) => {
      const stored = result[VIEW_MODE_STORAGE_KEY];
      resolve(isViewMode(stored) ? stored : DEFAULT_VIEW_MODE);
    });
  });
}

export function setViewMode(mode: ViewMode): Promise<void> {
  return new Promise((resolve) => {
    const api = getBrowserAPI();
    api.storage.sync.set({ [VIEW_MODE_STORAGE_KEY]: mode }, () => resolve());
  });
}

/**
 * Subscribe to view-mode changes (e.g. another extension page flipped it).
 * Returns a disposer.
 */
export function onViewModeChanged(handler: (mode: ViewMode) => void): () => void {
  const api = getBrowserAPI();
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'sync') return;
    const change = changes[VIEW_MODE_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue;
    if (isViewMode(next)) handler(next);
  };
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}
