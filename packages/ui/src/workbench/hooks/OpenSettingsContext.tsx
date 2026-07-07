/**
 * OpenSettingsContext — hands the shell's `openSettings` action (open
 * the Settings surface navigated to a category or a specific setting,
 * which the pane scrolls to and highlights) to deep workbench
 * components without threading a prop through every layer.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (other surfaces, tests) and should degrade
 * to plain text instead of rendering a dead button.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type OpenSettings = (target?: { settingKey?: string; categoryId?: string }) => void;

const OpenSettingsContext = createContext<OpenSettings | null>(null);

export const OpenSettingsProvider: React.FC<{
  openSettings: OpenSettings;
  children: React.ReactNode;
}> = ({ openSettings, children }) => (
  <OpenSettingsContext.Provider value={openSettings}>{children}</OpenSettingsContext.Provider>
);

export function useOpenSettings(): OpenSettings | null {
  return useContext(OpenSettingsContext);
}
