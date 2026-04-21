/**
 * General category — app-wide behavior that doesn't belong to a more
 * specific area. Covers startup landing, confirmation prompts, and
 * locale.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const openToSchema = v.picklist(['last', 'home', 'rules', 'collections']);
const languageSchema = v.picklist(['auto', 'en']);
const settingsOpenModeSchema = v.picklist(['modal', 'modal-maximized', 'tab']);

export type OpenTo = v.InferOutput<typeof openToSchema>;
export type Language = v.InferOutput<typeof languageSchema>;
export type SettingsOpenMode = v.InferOutput<typeof settingsOpenModeSchema>;

declare module '../types' {
  interface SettingsMap {
    'general.openTo': OpenTo;
    'general.language': Language;
    'general.confirmOnDelete': boolean;
    'general.showEmptyStateHints': boolean;
    'general.restoreTabsOnStartup': boolean;
    'general.settingsOpenMode': SettingsOpenMode;
  }
}

registerSetting({
  key: 'general.openTo',
  type: 'enum',
  default: 'last',
  schema: openToSchema,
  label: 'Open To',
  description: 'Which screen is shown when the workbench window opens.',
  category: 'general',
  tags: ['startup', 'landing', 'home'],
  scope: 'user',
  enumOptions: [
    { value: 'last', label: 'Last session', description: 'Whatever was open when you closed it' },
    { value: 'home', label: 'Home' },
    { value: 'rules', label: 'Rules' },
    { value: 'collections', label: 'Collections' },
  ],
});

registerSetting({
  key: 'general.language',
  type: 'enum',
  default: 'auto',
  schema: languageSchema,
  label: 'Language',
  description: 'Display language for the interface.',
  category: 'general',
  tags: ['locale', 'i18n', 'translation'],
  scope: 'user',
  enumOptions: [
    { value: 'auto', label: 'Follow system' },
    { value: 'en', label: 'English' },
  ],
});

registerSetting({
  key: 'general.confirmOnDelete',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Confirm Before Deleting',
  description: 'Show a confirmation dialog before deleting workbench, folders, or collections.',
  category: 'general',
  tags: ['safety', 'prompt', 'dialog'],
  scope: 'user',
});

registerSetting({
  key: 'general.showEmptyStateHints',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Empty-State Hints',
  description: 'Render guidance and tips in empty panels and onboarding areas.',
  category: 'general',
  tags: ['tips', 'onboarding', 'hints', 'help'],
  scope: 'user',
});

registerSetting({
  key: 'general.restoreTabsOnStartup',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Restore Tabs on Startup',
  description: 'Re-open the editor tabs that were open at the end of the previous session.',
  category: 'general',
  tags: ['session', 'tabs', 'restore', 'persistence'],
  scope: 'user',
});

registerSetting({
  key: 'general.settingsOpenMode',
  type: 'enum',
  default: 'modal',
  schema: settingsOpenModeSchema,
  label: 'Settings Open Mode',
  description: 'How the Settings page opens when launched from the toolbar, popup, or command palette.',
  category: 'general',
  tags: ['settings', 'modal', 'tab', 'layout'],
  scope: 'user',
  enumOptions: [
    { value: 'modal', label: 'Modal', description: 'Overlay centered on the current page' },
    { value: 'modal-maximized', label: 'Modal (maximized)', description: 'Overlay that fills most of the viewport' },
    { value: 'tab', label: 'Editor tab', description: 'Open as a full editor tab in the workspace' },
  ],
});
