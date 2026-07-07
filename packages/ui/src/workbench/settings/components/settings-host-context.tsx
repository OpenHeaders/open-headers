/**
 * SettingsHostContext — lets content inside the settings shell dismiss
 * the surface hosting it. Actions that navigate elsewhere in the app
 * (e.g. the Backend pane's "Learn more" docs link) close a modal host
 * so the destination isn't left hidden behind it. Hosts where settings
 * live in a persistent surface (editor tab) simply don't mount the
 * provider and such actions leave the surface open.
 */

import { createContext, useContext } from 'react';

export interface SettingsHostContextValue {
  /** Dismiss the surface hosting the settings shell. */
  close: () => void;
}

export const SettingsHostContext = createContext<SettingsHostContextValue | null>(null);

export function useOptionalSettingsHost(): SettingsHostContextValue | null {
  return useContext(SettingsHostContext);
}
