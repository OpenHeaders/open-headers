/**
 * Persisted preference for which surface the toolbar action button opens.
 * 'popup' is the install default — matches every other extension's
 * convention. 'sidepanel' opts in to the persistent right-side surface.
 */
export type ViewMode = 'popup' | 'sidepanel';

export const DEFAULT_VIEW_MODE: ViewMode = 'popup';

/** chrome.storage.sync key — `oh.` prefix avoids collisions with other modules. */
export const VIEW_MODE_STORAGE_KEY = 'oh.viewMode';
