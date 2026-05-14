/**
 * General category — app-wide behavior that doesn't belong to a more
 * specific area. Covers startup landing, confirmation prompts, and
 * locale.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const languageSchema = v.picklist(['auto', 'en']);
const settingsOpenModeSchema = v.picklist(['modal', 'modal-maximized', 'tab']);
const collectionEnvAutoSwitchSchema = v.picklist(['keep-selection', 'apply-defaults', 'follow-collection']);

export type Language = v.InferOutput<typeof languageSchema>;
export type SettingsOpenMode = v.InferOutput<typeof settingsOpenModeSchema>;
export type CollectionEnvAutoSwitch = v.InferOutput<typeof collectionEnvAutoSwitchSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'general.language': Language;
    'general.confirmOnDelete': boolean;
    'general.showEmptyStateHints': boolean;
    'general.restoreTabsOnStartup': boolean;
    'general.settingsOpenMode': SettingsOpenMode;
    'general.collectionEnvAutoSwitch': CollectionEnvAutoSwitch;
  }
}

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
  description: 'Show a confirmation dialog before deleting rules, folders, or collections.',
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
  key: 'general.collectionEnvAutoSwitch',
  type: 'enum',
  default: 'apply-defaults',
  schema: collectionEnvAutoSwitchSchema,
  label: 'Collection Environment Switching',
  description:
    'How the active environment changes as you move between collections and the entities inside them (rules, requests, folders). Applies to both rule collections and API request collections. Collections can carry a default environment and pin a short list of recommended environments; this setting controls whether those defaults take over automatically.',
  category: 'general',
  tags: ['environment', 'collection', 'auto-switch', 'workflow'],
  scope: 'user',
  enumOptions: [
    {
      value: 'keep-selection',
      label: 'Keep selected environment',
      description:
        "Whatever you have selected (including no environment) stays selected as you navigate between collections and their subfolders, rules, or requests. A collection's default only applies when no environment is selected.",
    },
    {
      value: 'apply-defaults',
      label: 'Apply collection defaults',
      description:
        "A collection's default takes over while you're inside it (or any subfolder, rule, or request within). Your last manual pick is the base environment — restored whenever you leave a collection or enter one without a default. No per-collection memory.",
    },
    {
      value: 'follow-collection',
      label: 'Follow each collection',
      description:
        "Opening a collection (or any subfolder, rule, or request inside it) with a default environment switches to that default. Picks you make inside a collection are remembered for that collection. Collections without a default don't auto-switch.",
    },
  ],
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
