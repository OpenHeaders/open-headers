/**
 * Protocol message type definitions.
 *
 * Reserved for the desktop ↔ extension WebSocket protocol. Today the
 * only inhabitant is `AppNavigationIntent` — the payload passed with
 * deep-link / focus-app navigation. Other message shapes were retired
 * along with the recording subsystem.
 */

/** Navigation action applied to an item or settings toggle. */
export type NavigationAction = 'edit' | 'delete' | 'toggle' | 'view' | 'create' | 'duplicate' | 'highlight';

/** Settings tab identifier. */
export type SettingsTabId = 'general' | 'appearance';

/**
 * Navigation intent sent with focusApp to tell the desktop UI which view
 * to show and what action to perform.
 */
export interface AppNavigationIntent {
  tab?: string;
  subTab?: string;
  action?: NavigationAction;
  itemId?: string;
  settingsTab?: SettingsTabId;
  /** Value for toggle actions — boolean via WebSocket, string via protocol URL. */
  value?: string | boolean;
}
