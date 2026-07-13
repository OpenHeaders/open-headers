/**
 * DevPanel Headers category — defaults for the Headers tab inside the
 * browser DevTools panel. Persisted via the shared settings store so
 * preferences carry across panel close/reopen and every request opened
 * in the panel inherits the same defaults (Chrome Network's pattern).
 *
 * The filter text input is deliberately NOT a setting — it's request-
 * specific scratch state owned by each `HeadersView` instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const layoutSchema = v.picklist(['grouped', 'flat']);
export type DevpanelHeadersLayoutSetting = v.InferOutput<typeof layoutSchema>;

const sortSchema = v.picklist(['original', 'az', 'rule-first']);
export type DevpanelHeadersSortSetting = v.InferOutput<typeof sortSchema>;

const nameCaseSchema = v.picklist(['train', 'original']);
export type DevpanelHeadersNameCaseSetting = v.InferOutput<typeof nameCaseSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelHeaders.layout': DevpanelHeadersLayoutSetting;
    'devpanelHeaders.sortMode': DevpanelHeadersSortSetting;
    'devpanelHeaders.nameCase': DevpanelHeadersNameCaseSetting;
    'devpanelHeaders.showInsights': boolean;
    'devpanelHeaders.hideNoise': boolean;
    'devpanelHeaders.ruleOnly': boolean;
    'devpanelHeaders.securityOnly': boolean;
    'devpanelHeaders.overridableOnly': boolean;
    'devpanelHeaders.showChips': boolean;
  }
}

// ── Layout / sort ────────────────────────────────────────────────────

registerSetting({
  key: 'devpanelHeaders.layout',
  type: 'enum',
  default: 'flat',
  schema: layoutSchema,
  labelKey: 'workbench.settings.def.devpanelHeaders.layout.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.layout.description',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'layout', 'grouped', 'flat', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'grouped',
      labelKey: 'workbench.settings.def.devpanelHeaders.layout.option.grouped.label',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.layout.option.grouped.description',
    },
    {
      value: 'flat',
      labelKey: 'workbench.settings.def.devpanelHeaders.layout.option.flat.label',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.layout.option.flat.description',
    },
  ],
});

registerSetting({
  key: 'devpanelHeaders.sortMode',
  type: 'enum',
  default: 'original',
  schema: sortSchema,
  labelKey: 'workbench.settings.def.devpanelHeaders.sortMode.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.sortMode.description',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'sort', 'order', 'devtools'],
  scope: 'user',
  // The `A → Z` label is a literal glyph pair, not translatable text.
  enumOptions: [
    {
      value: 'original',
      labelKey: 'workbench.settings.def.devpanelHeaders.sortMode.option.original.label',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.sortMode.option.original.description',
    },
    {
      value: 'az',
      label: 'A → Z',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.sortMode.option.az.description',
    },
    {
      value: 'rule-first',
      labelKey: 'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description',
    },
  ],
});

registerSetting({
  key: 'devpanelHeaders.nameCase',
  type: 'enum',
  default: 'train',
  schema: nameCaseSchema,
  labelKey: 'workbench.settings.def.devpanelHeaders.nameCase.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.nameCase.description',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'case', 'train-case', 'display', 'devtools'],
  scope: 'user',
  // Train-Case option stays literal: its label names the casing style
  // and its description is a header-name format example (plan §3).
  enumOptions: [
    { value: 'train', label: 'Train-Case', description: 'Content-Type, Set-Cookie, ETag (Chrome-style).' },
    {
      value: 'original',
      labelKey: 'workbench.settings.def.devpanelHeaders.nameCase.option.original.label',
      descriptionKey: 'workbench.settings.def.devpanelHeaders.nameCase.option.original.description',
    },
  ],
});

registerSetting({
  key: 'devpanelHeaders.showChips',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.showChips.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.showChips.description',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'tags', 'chips', 'view', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.showInsights',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.showInsights.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.showInsights.description',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'insights', 'suggestions', 'warnings', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ─────────────────────────────────────────────────

registerSetting({
  key: 'devpanelHeaders.hideNoise',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.hideNoise.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.hideNoise.description',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'noise', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.ruleOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.ruleOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.ruleOnly.description',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'rule', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.securityOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.securityOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.securityOnly.description',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'security', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.overridableOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelHeaders.overridableOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelHeaders.overridableOnly.description',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'overridable', 'protected', 'filter', 'devtools'],
  scope: 'user',
});
