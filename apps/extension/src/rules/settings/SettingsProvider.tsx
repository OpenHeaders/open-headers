/**
 * SettingsProvider — triggers schema registration and async store init.
 *
 * Importing `./schema` executes every schema file's top-level
 * `registerSetting` calls. The provider then kicks off store init and
 * renders children either way — settings UI that needs the ready flag
 * consumes `useSettingsReady()`.
 */

import type React from 'react';
import { useEffect } from 'react';
import './schema';
import { initSettingsStore } from './store';

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  useEffect(() => {
    void initSettingsStore();
  }, []);
  return <>{children}</>;
};
