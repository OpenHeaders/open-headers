/**
 * General category — app-wide behavior that doesn't belong to a more
 * specific area. Covers startup landing, confirmation prompts, and
 * locale. Definition text lives in the `workbench.settings.def.*`
 * catalog namespace (keys derived from the setting key).
 */

import { LOCALES } from '@openheaders/i18n';
import * as v from 'valibot';
import { registerSetting } from '../registry';
import type { EnumOption } from '../types';

// The picker derives from the i18n locale registry — adding a language
// there grows this setting automatically.
const languageSchema = v.picklist(['auto', ...LOCALES.map((l) => l.code)] as [string, ...string[]]);
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
    'general.settingsShowCategoryLabels': boolean;
    'general.collectionEnvAutoSwitch': CollectionEnvAutoSwitch;
  }
}

registerSetting({
  key: 'general.language',
  type: 'enum',
  default: 'auto',
  schema: languageSchema,
  labelKey: 'workbench.settings.def.general.language.label',
  descriptionKey: 'workbench.settings.def.general.language.description',
  category: 'general',
  tags: ['locale', 'i18n', 'translation', 'language', 'display'],
  scope: 'user',
  enumOptions: [
    {
      value: 'auto',
      labelKey: 'workbench.settings.def.general.language.option.auto.label',
      descriptionKey: 'workbench.settings.def.general.language.option.auto.description',
    },
    // Locale rows keep their raw registry text: `nativeName` is each
    // language's self-designation and `englishName` a proper noun —
    // neither translates. Only pseudo's QA blurb is a catalog key.
    ...LOCALES.map(
      (l): EnumOption<Language> =>
        l.synthetic
          ? {
              value: l.code,
              label: l.nativeName,
              descriptionKey: 'workbench.settings.def.general.language.option.pseudo.description',
            }
          : { value: l.code, label: l.nativeName, description: l.englishName },
    ),
  ],
});

registerSetting({
  key: 'general.confirmOnDelete',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.general.confirmOnDelete.label',
  descriptionKey: 'workbench.settings.def.general.confirmOnDelete.description',
  category: 'general',
  tags: ['safety', 'prompt', 'dialog'],
  scope: 'user',
});

registerSetting({
  key: 'general.showEmptyStateHints',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.general.showEmptyStateHints.label',
  descriptionKey: 'workbench.settings.def.general.showEmptyStateHints.description',
  category: 'general',
  tags: ['tips', 'onboarding', 'hints', 'help'],
  scope: 'user',
});

registerSetting({
  key: 'general.restoreTabsOnStartup',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.general.restoreTabsOnStartup.label',
  descriptionKey: 'workbench.settings.def.general.restoreTabsOnStartup.description',
  category: 'general',
  tags: ['session', 'tabs', 'restore', 'persistence'],
  scope: 'user',
});

registerSetting({
  key: 'general.collectionEnvAutoSwitch',
  type: 'enum',
  default: 'apply-defaults',
  schema: collectionEnvAutoSwitchSchema,
  labelKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.label',
  descriptionKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.description',
  category: 'general',
  tags: ['environment', 'collection', 'auto-switch', 'workflow'],
  scope: 'user',
  enumOptions: [
    {
      value: 'keep-selection',
      labelKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label',
      descriptionKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description',
    },
    {
      value: 'apply-defaults',
      labelKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label',
      descriptionKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description',
    },
    {
      value: 'follow-collection',
      labelKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label',
      descriptionKey: 'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description',
    },
  ],
});

registerSetting({
  key: 'general.settingsOpenMode',
  type: 'enum',
  default: 'modal-maximized',
  schema: settingsOpenModeSchema,
  labelKey: 'workbench.settings.def.general.settingsOpenMode.label',
  descriptionKey: 'workbench.settings.def.general.settingsOpenMode.description',
  category: 'general',
  tags: ['settings', 'modal', 'tab', 'layout'],
  scope: 'user',
  enumOptions: [
    {
      value: 'modal',
      labelKey: 'workbench.settings.def.general.settingsOpenMode.option.modal.label',
      descriptionKey: 'workbench.settings.def.general.settingsOpenMode.option.modal.description',
    },
    {
      value: 'modal-maximized',
      labelKey: 'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label',
      descriptionKey: 'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description',
    },
    {
      value: 'tab',
      labelKey: 'workbench.settings.def.general.settingsOpenMode.option.tab.label',
      descriptionKey: 'workbench.settings.def.general.settingsOpenMode.option.tab.description',
    },
  ],
});

registerSetting({
  key: 'general.settingsShowCategoryLabels',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.general.settingsShowCategoryLabels.label',
  descriptionKey: 'workbench.settings.def.general.settingsShowCategoryLabels.description',
  category: 'general',
  tags: ['settings', 'sidebar', 'labels', 'compact'],
  scope: 'user',
});
