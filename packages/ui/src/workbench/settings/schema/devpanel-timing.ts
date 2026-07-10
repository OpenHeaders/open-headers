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
  label: 'Show Suggestions',
  description:
    'Display the bottleneck + per-phase warning cards at the top of the Timing tab. Turn off for a numbers-only view.',
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
  label: 'Show Context Strip',
  description:
    'Show the protocol / connection / cache / priority / started / server-IP chip row above the phase breakdown.',
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
  label: 'Show Phase Breakdown',
  description:
    'Show the Resource Scheduling / Connection Start / Request-Response sections with per-phase millisecond rows.',
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
  label: 'Show Timing Bar',
  description: 'Show the proportional segmented bar with the per-phase legend (and the Total row beneath it).',
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
  label: 'Show Server-Timing',
  description: 'Show the parsed `Server-Timing` response-header metrics when the server sent any.',
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
  label: 'Show Repeats in Session',
  description:
    'Show the comparison against the fastest / median / slowest hit of this same URL within the current panel session.',
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
  label: 'Show Transfer Rate',
  description:
    'Show the effective Content-Download throughput (body bytes ÷ download time) when both the size and the receive leg are known.',
  category: 'devpanelTiming',
  subcategory: 'View',
  tags: ['timing', 'transfer', 'throughput', 'devtools'],
  scope: 'user',
});
