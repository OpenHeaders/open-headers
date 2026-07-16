/**
 * Product telemetry — the one-switch anonymous usage counting toggle
 * (`TELEMETRY_PLAN.md` §2/§6). The toggle never ships without the "view
 * every event" affordance by law: its `(i)` popover carries the "View
 * events" action that opens the byte-for-byte inspector modal.
 *
 * Extension and desktop only — a workbench served by a daemon never
 * counts anything and shows no toggle (hard-off surfaces have no UI).
 */

import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

const isCountingHost = (): boolean => {
  const host = getCurrentHost();
  return host === 'extension' || host === 'desktop';
};

const ProductTelemetryToggleRow = lazy(() => import('../components/product-telemetry-toggle-row'));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'telemetry.enabled': boolean;
  }
}

registerSetting({
  key: 'telemetry.enabled',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Anonymous usage counting',
  description:
    'Count which features get used — nothing more. No URLs, no headers, no request or response data, no account identity, nothing derived from your device. A random install identifier groups the counts; it identifies this install, not you — reset it anytime, and turning the switch off deletes it. Every event is visible byte for byte in "View events" below. Off means off: the channel goes completely silent.',
  category: 'general',
  tags: ['telemetry', 'privacy', 'analytics', 'usage', 'anonymous', 'events', 'transparency', 'inspector'],
  scope: 'user',
  when: isCountingHost,
  customEditor: ProductTelemetryToggleRow,
});
