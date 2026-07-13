/**
 * Settings public API barrel — the core (headless) surface.
 *
 * This file exposes only the provider, hooks, store, registry, and
 * types — everything lightweight surfaces (popup, sidepanel, panel,
 * ThemeContext) need. Heavy UI components (Modal, Shell, Tab) live in
 * ./ui so tree-shaking can keep them out of surfaces that never render
 * the settings screen. Concrete schemas load as a side effect of
 * importing SettingsProvider (via ./schema).
 */

export { useIsModified, useResetSetting, useSetting, useSettingsReady, useSettingValue } from './hooks';
export {
  categoryNavLabel,
  resolveDescription,
  resolveLabel,
  resolveOptionalDescription,
  resolveSettingDef,
} from './localize';
export { allCategories, allDefs, byCategory, getDef } from './registry';
export { SettingsProvider } from './SettingsProvider';
export { searchSettings } from './search';
export { get as getSettingValue, reset as resetSetting, set as setSettingValue } from './store';

export type { CategoryDef, ResolvedSettingDef, SettingDef, SettingKey, SettingsMap, SettingType } from './types';
