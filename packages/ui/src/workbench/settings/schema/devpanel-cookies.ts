/**
 * DevPanel Cookies category — defaults for the Cookies tab inside the
 * browser DevTools panel. Persisted via the shared settings store so
 * preferences carry across panel close/reopen and every request opened
 * in the panel inherits the same defaults.
 *
 * The filter text input is NOT a setting — it's request-specific
 * scratch state owned by each CookiesView instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sortSchema = v.picklist(['original', 'az', 'size', 'expires']);
export type DevpanelCookiesSortSetting = v.InferOutput<typeof sortSchema>;

const expiresFormatSchema = v.picklist(['relative', 'absolute']);
export type DevpanelCookiesExpiresFormatSetting = v.InferOutput<typeof expiresFormatSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelCookies.sortMode': DevpanelCookiesSortSetting;
    'devpanelCookies.expiresFormat': DevpanelCookiesExpiresFormatSetting;
    'devpanelCookies.showInsights': boolean;
    'devpanelCookies.showFilteredOut': boolean;
    'devpanelCookies.decodeValues': boolean;
    'devpanelCookies.problemsOnly': boolean;
    'devpanelCookies.thirdPartyOnly': boolean;
    'devpanelCookies.ruleOnly': boolean;
    'devpanelCookies.groupByRole': boolean;
    'devpanelCookies.showChips': boolean;
  }
}

// ── Sort / format ───────────────────────────────────────────────────

registerSetting({
  key: 'devpanelCookies.sortMode',
  type: 'enum',
  default: 'az',
  schema: sortSchema,
  labelKey: 'workbench.settings.def.devpanelCookies.sortMode.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.sortMode.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'sort', 'order', 'devtools'],
  scope: 'user',
  // The `A → Z` label is a literal glyph pair, not translatable text.
  enumOptions: [
    {
      value: 'original',
      labelKey: 'workbench.settings.def.devpanelCookies.sortMode.option.original.label',
      descriptionKey: 'workbench.settings.def.devpanelCookies.sortMode.option.original.description',
    },
    {
      value: 'az',
      label: 'A → Z',
      descriptionKey: 'workbench.settings.def.devpanelCookies.sortMode.option.az.description',
    },
    {
      value: 'size',
      labelKey: 'workbench.settings.def.devpanelCookies.sortMode.option.size.label',
      descriptionKey: 'workbench.settings.def.devpanelCookies.sortMode.option.size.description',
    },
    {
      value: 'expires',
      labelKey: 'workbench.settings.def.devpanelCookies.sortMode.option.expires.label',
      descriptionKey: 'workbench.settings.def.devpanelCookies.sortMode.option.expires.description',
    },
  ],
});

registerSetting({
  key: 'devpanelCookies.expiresFormat',
  type: 'enum',
  default: 'relative',
  schema: expiresFormatSchema,
  labelKey: 'workbench.settings.def.devpanelCookies.expiresFormat.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.expiresFormat.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'expires', 'format', 'devtools'],
  scope: 'user',
  // The relative-format description is a literal format example
  // (plan §3) — never keyed.
  enumOptions: [
    {
      value: 'relative',
      labelKey: 'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label',
      description: 'in 2d / 30s ago / Session.',
    },
    {
      value: 'absolute',
      labelKey: 'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label',
      descriptionKey: 'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description',
    },
  ],
});

registerSetting({
  key: 'devpanelCookies.showChips',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.showChips.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.showChips.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'tags', 'chips', 'view', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.showInsights',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.showInsights.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.showInsights.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'insights', 'suggestions', 'warnings', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.decodeValues',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.decodeValues.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.decodeValues.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'decode', 'url-encoding', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.groupByRole',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.groupByRole.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.groupByRole.description',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'group', 'role', 'auth', 'tracking', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ─────────────────────────────────────────────────

registerSetting({
  key: 'devpanelCookies.showFilteredOut',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.showFilteredOut.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.showFilteredOut.description',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'filtered-out', 'jar', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.problemsOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.problemsOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.problemsOnly.description',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'problems', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.thirdPartyOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.thirdPartyOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.thirdPartyOnly.description',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'third-party', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.ruleOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelCookies.ruleOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelCookies.ruleOnly.description',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'rule', 'filter', 'devtools'],
  scope: 'user',
});
