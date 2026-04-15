/**
 * Settings public API barrel — the only import surface for callers
 * outside the settings/ directory.
 *
 * The shell, modal, and provider live here. Concrete schemas load as
 * a side effect of importing SettingsProvider (via ./schema).
 */

export { default as SettingsModal } from './components/SettingsModal';
export { default as SettingsShell } from './components/SettingsShell';
export { default as SettingsTab } from './components/SettingsTab';
export { useIsModified, useResetSetting, useSetting, useSettingsReady, useSettingValue } from './hooks';
export { allCategories, allDefs, byCategory, getDef } from './registry';
export { SettingsProvider } from './SettingsProvider';
export { searchSettings } from './search';
export { get as getSettingValue, reset as resetSetting, set as setSettingValue } from './store';

export type { CategoryDef, SettingDef, SettingKey, SettingsMap, SettingType } from './types';
