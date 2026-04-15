/**
 * Settings public API barrel — the only import surface for callers
 * outside the settings/ directory.
 *
 * The shell, modal, and provider live here. Concrete schemas load as
 * a side effect of importing SettingsProvider (via ./schema).
 */

export { SettingsProvider } from './SettingsProvider';
export { default as SettingsModal } from './components/SettingsModal';
export { default as SettingsShell } from './components/SettingsShell';
export { default as SettingsTab } from './components/SettingsTab';

export { useSetting, useSettingValue, useIsModified, useResetSetting, useSettingsReady } from './hooks';
export { get as getSettingValue, set as setSettingValue, reset as resetSetting } from './store';
export { allCategories, allDefs, byCategory, getDef } from './registry';
export { searchSettings } from './search';

export type { SettingDef, CategoryDef, SettingKey, SettingsMap, SettingType } from './types';
