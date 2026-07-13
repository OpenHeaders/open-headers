/**
 * DevPanel Initiator category — defaults for the Initiator tab inside
 * the browser DevTools panel. Persisted via the shared settings store
 * so preferences carry across panel close/reopen and every request
 * opened in the panel inherits the same defaults.
 *
 * The free-text filter input is NOT a setting — it's request-specific
 * scratch state owned by each InitiatorView instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sortSchema = v.picklist(['initiator', 'chronological', 'largest']);
export type DevpanelInitiatorSortSetting = v.InferOutput<typeof sortSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelInitiator.sortMode': DevpanelInitiatorSortSetting;
    'devpanelInitiator.showInsights': boolean;
    'devpanelInitiator.failuresOnly': boolean;
    'devpanelInitiator.thirdPartyOnly': boolean;
  }
}

// ── Sort ────────────────────────────────────────────────────────────

registerSetting({
  key: 'devpanelInitiator.sortMode',
  type: 'enum',
  default: 'initiator',
  schema: sortSchema,
  labelKey: 'workbench.settings.def.devpanelInitiator.sortMode.label',
  descriptionKey: 'workbench.settings.def.devpanelInitiator.sortMode.description',
  category: 'devpanelInitiator',
  subcategory: 'View',
  tags: ['initiator', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'initiator',
      labelKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label',
      descriptionKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description',
    },
    {
      value: 'chronological',
      labelKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label',
      descriptionKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description',
    },
    {
      value: 'largest',
      labelKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label',
      descriptionKey: 'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description',
    },
  ],
});

registerSetting({
  key: 'devpanelInitiator.showInsights',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelInitiator.showInsights.label',
  descriptionKey: 'workbench.settings.def.devpanelInitiator.showInsights.description',
  category: 'devpanelInitiator',
  subcategory: 'View',
  tags: ['initiator', 'insights', 'suggestions', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ────────────────────────────────────────────────

registerSetting({
  key: 'devpanelInitiator.failuresOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelInitiator.failuresOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelInitiator.failuresOnly.description',
  category: 'devpanelInitiator',
  subcategory: 'Filters',
  tags: ['initiator', 'failures', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelInitiator.thirdPartyOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label',
  descriptionKey: 'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description',
  category: 'devpanelInitiator',
  subcategory: 'Filters',
  tags: ['initiator', 'third-party', 'filter', 'devtools'],
  scope: 'user',
});
