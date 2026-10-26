/**
 * Product telemetry — the two anonymous channels, one switch each (the
 * telemetry plan §2/§6; the error reports plan §5). Neither toggle ships
 * without the "view it byte for byte" affordance by law: each `(i)`
 * popover carries the action that opens the shared inspector modal on
 * its own section.
 *
 * Extension and desktop only — a workbench served by a daemon never
 * counts or reports anything and shows no toggle (hard-off surfaces
 * have no UI).
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
const ErrorReportsToggleRow = lazy(() => import('../components/error-reports-toggle-row'));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'telemetry.enabled': boolean;
    'telemetry.errorReports': boolean;
  }
}

registerSetting({
  key: 'telemetry.enabled',
  subcategory: 'privacy',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Anonymous usage counting',
  description:
    'Count which features get used. No URLs, no headers, no request or response data, no account identity, nothing derived from your device. A random install identifier groups the counts; it identifies this install, not you — turning the switch off deletes it, and a re-enable starts fresh. Every event is visible byte for byte in "View events" below. Off means off: the channel goes completely silent.',
  category: 'about',
  tags: ['telemetry', 'privacy', 'analytics', 'usage', 'anonymous', 'events', 'transparency', 'inspector'],
  scope: 'user',
  when: isCountingHost,
  customEditor: ProductTelemetryToggleRow,
});

registerSetting({
  key: 'telemetry.errorReports',
  subcategory: 'privacy',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Crash and error reports',
  description:
    'When Open Headers crashes or hits an error it did not expect, send what kind of error it was and where in the app\'s own code it happened — never the message, never your data. Reports carry only error class names, template ids, and positions in Open Headers\' own files; nothing from a request, a rule, a script, or a path on your machine can be expressed. No install identifier: a random per-launch session id is all that groups them. Every report is visible byte for byte in "View reports" below. Independent of usage counting — either switch can be off alone.',
  category: 'about',
  tags: ['telemetry', 'privacy', 'crash', 'error', 'reports', 'diagnostics', 'anonymous', 'transparency', 'inspector'],
  scope: 'user',
  when: isCountingHost,
  customEditor: ErrorReportsToggleRow,
});
