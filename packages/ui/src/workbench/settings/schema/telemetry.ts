/**
 * Product telemetry — the one-switch anonymous usage counting toggle and
 * its inspector row (`TELEMETRY_PLAN.md` §2/§6). The two rows ship
 * together by law: the toggle never appears without the "view every
 * event" affordance beside it.
 *
 * Extension and desktop only — a workbench served by a daemon never
 * counts anything and shows no toggle (hard-off surfaces have no UI).
 * Desktop shows the rows once its host adapter lands; until then the
 * same host gate keeps them extension-only.
 */

import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

const ProductTelemetryEventsRow = lazy(() => import('../components/product-telemetry-events-row'));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'telemetry.enabled': boolean;
    'telemetry.viewEvents': string;
  }
}

registerSetting({
  key: 'telemetry.enabled',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Anonymous usage counting',
  description:
    'Count which features get used — nothing more. No URLs, no headers, no request or response data, no account identity, no persistent device id. Every event is visible byte for byte in "View telemetry events" below. Off means off: the channel goes completely silent.',
  category: 'general',
  tags: ['telemetry', 'privacy', 'analytics', 'usage', 'anonymous'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
});

registerSetting({
  key: 'telemetry.viewEvents',
  type: 'info',
  default: '',
  schema: v.string(),
  label: 'View telemetry events',
  description:
    'Every telemetry event of this session, exactly as sent — or as it would have been sent while the switch is off.',
  category: 'general',
  tags: ['telemetry', 'privacy', 'inspector', 'events', 'transparency'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
  customEditor: ProductTelemetryEventsRow,
});
