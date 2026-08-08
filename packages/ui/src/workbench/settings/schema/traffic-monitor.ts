/**
 * Traffic Monitor category — the capture-gesture defaults, the
 * sessions archive's disk budget, and the agent raw-read grant
 * (AGENT_TRAFFIC_PLAN.md §11.1/§11.4/§11.5).
 *
 * The two `capture*Default` rows seed the Advanced toggles of the
 * source rail's start-capturing popover — the gesture itself can
 * override them per session. The retention row and the raw-read grant
 * are mirrored into the dotted-key user-settings record and read LIVE
 * by the daemon: a retention change applies to the next prune pass, a
 * grant flip to the next agent session read — no restart. The grant
 * defaults OFF, and every read made under it lands in the Activity
 * Feed flagged unredacted. Only the desktop host runs the Traffic
 * Monitor, so the category is registered desktop-only in
 * `../categories.tsx`.
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

const railSideSchema = v.picklist(['left', 'right']);
export type TrafficMonitorRailSide = v.InferOutput<typeof railSideSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'trafficMonitor.captureDebugDefault': boolean;
    'trafficMonitor.captureSaveDefault': boolean;
    'trafficMonitor.sessionRetentionGiB': number;
    'trafficMonitor.sessionAgentRawReads': boolean;
    'trafficMonitor.railSide': TrafficMonitorRailSide;
  }
}

const desktopOnly = (): boolean => getCurrentHost() === 'desktop';

// The panel header's layout button flips this too — the row and the
// button are the same preference.
registerSetting({
  key: 'trafficMonitor.railSide',
  type: 'enum',
  default: 'left',
  schema: railSideSchema,
  labelKey: 'workbench.settings.def.trafficMonitor.railSide.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.railSide.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'sources', 'rail', 'side', 'layout', 'left', 'right'],
  scope: 'user',
  when: desktopOnly,
  enumOptions: [
    {
      value: 'left',
      labelKey: 'workbench.settings.def.trafficMonitor.railSide.option.left.label',
      descriptionKey: 'workbench.settings.def.trafficMonitor.railSide.option.left.description',
    },
    {
      value: 'right',
      labelKey: 'workbench.settings.def.trafficMonitor.railSide.option.right.label',
      descriptionKey: 'workbench.settings.def.trafficMonitor.railSide.option.right.description',
    },
  ],
});

registerSetting({
  key: 'trafficMonitor.captureDebugDefault',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.trafficMonitor.captureDebugDefault.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.captureDebugDefault.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'capture', 'session', 'debug', 'cdp', 'fidelity', 'bodies'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'trafficMonitor.captureSaveDefault',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.trafficMonitor.captureSaveDefault.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.captureSaveDefault.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'capture', 'session', 'save', 'record', 'archive', 'disk'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'trafficMonitor.sessionAgentRawReads',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label',
  descriptionKey: 'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description',
  category: 'trafficMonitor',
  tags: ['traffic', 'session', 'archive', 'agent', 'mcp', 'redaction', 'raw', 'secrets', 'grant'],
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
