/**
 * Requests category — behavior of the HTTP request executor (the
 * workbench Send path).
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'requests.responseBodyCapMB': number;
  }
}

registerSetting({
  key: 'requests.responseBodyCapMB',
  type: 'number',
  default: 2,
  // Validation admits the desktop ceiling everywhere so a synced value
  // never fails on the tighter host; the visible range is per host —
  // the extension holds response snapshots in service-worker messaging
  // and tab state, so its ceiling stays low, while the desktop app
  // keeps the body in local process memory.
  schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  labelKey: 'workbench.settings.def.requests.responseBodyCapMB.label',
  descriptionKey: 'workbench.settings.def.requests.responseBodyCapMB.description',
  category: 'requests',
  tags: ['response', 'body', 'truncate', 'limit', 'size', 'cap'],
  scope: 'user',
  numberRange: { min: 1, max: getCurrentHost() === 'desktop' ? 100 : 10, step: 1 },
});
