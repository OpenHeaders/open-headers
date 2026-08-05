/**
 * Traffic Monitor category — the observe-gesture defaults and the
 * sessions archive's disk budget (AGENT_TRAFFIC_PLAN.md §11.1/§11.4).
 *
 * The two `observe*Default` rows seed the Advanced toggles of the
 * source rail's start-observing popover — the gesture itself can
 * override them per session. The retention row is mirrored into the
 * dotted-key user-settings record and read LIVE by the daemon's
 * sessions archive: a change applies to the next prune pass, no
 * restart. Only the desktop host runs the Traffic Monitor, so the
 * category is registered desktop-only in `../categories.tsx`.
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'trafficMonitor.observeDebugDefault': boolean;
    'trafficMonitor.observeSaveDefault': boolean;
    'trafficMonitor.sessionRetentionGiB': number;
  }
}

const desktopOnly = (): boolean => getCurrentHost() === 'desktop';

registerSetting({
  key: 'trafficMonitor.observeDebugDefault',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.trafficMonitor.observeDebugDefault.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.observeDebugDefault.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'observe', 'session', 'debug', 'cdp', 'fidelity', 'bodies'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'trafficMonitor.observeSaveDefault',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.trafficMonitor.observeSaveDefault.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.observeSaveDefault.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'observe', 'session', 'save', 'record', 'archive', 'disk'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'trafficMonitor.sessionRetentionGiB',
  type: 'number',
  default: 2,
  schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(256)),
  labelKey: 'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'session', 'archive', 'retention', 'disk', 'budget', 'prune'],
  scope: 'user',
  when: desktopOnly,
  numberRange: { min: 1, max: 256, step: 1 },
});
