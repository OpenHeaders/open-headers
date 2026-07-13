/**
 * DevPanel Timing category — defaults for the Timing tab inside the
 * browser DevTools panel. Persisted via the shared settings store so
 * preferences carry across panel close/reopen.
 *
 * The Timing tab has no filter input or sort axis — its View menu is
 * purely a set of visibility toggles over the optional bands
 * (insights, context strip, phase breakdown, timing bar, Server
 * Timing, repeats-in-session, transfer rate).
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelTiming.showInsights': boolean;
    'devpanelTiming.showContextStrip': boolean;
    'devpanelTiming.showPhaseGroups': boolean;
    'devpanelTiming.showTimingBar': boolean;
    'devpanelTiming.showServerTiming': boolean;
    'devpanelTiming.showRepeats': boolean;
    'devpanelTiming.showTransferRate': boolean;
  }
}

registerSetting({
  key: 'devpanelTiming.showInsights',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showInsights.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showInsights.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'insights', 'suggestions', 'warnings', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showContextStrip',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showContextStrip.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showContextStrip.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'context', 'chips', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showPhaseGroups',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showPhaseGroups.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showPhaseGroups.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'phases', 'breakdown', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showTimingBar',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showTimingBar.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showTimingBar.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'bar', 'waterfall', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showServerTiming',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showServerTiming.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showServerTiming.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'server-timing', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showRepeats',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showRepeats.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showRepeats.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'repeats', 'session', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelTiming.showTransferRate',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelTiming.showTransferRate.label',
  descriptionKey: 'workbench.settings.def.devpanelTiming.showTransferRate.description',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'transfer', 'throughput', 'devtools'],
  scope: 'user',
});
