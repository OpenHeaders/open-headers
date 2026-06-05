/**
 * Request Inspection category — the opt-in deep request-inspection path.
 *
 * `inspection.cdpEnabled` is the global master switch. It decides *whether*
 * the browser's debugging protocol is used; the developer-tools session on
 * each tab decides *when* it attaches. The service worker is the sole owner
 * of that protocol — every surface here only writes the setting to storage,
 * and the worker reconciles the attached set from it.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

registerSetting({
  key: 'inspection.cdpEnabled',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Deep request inspection',
  description:
    'Attach the browser’s debugging protocol to tabs with their developer tools open, capturing requests at creation with richer detail than the default path. The browser shows a debugging banner on each attached tab while this is on; it stays off by default.',
  category: 'inspection',
  tags: ['network', 'inspection', 'requests', 'debugging', 'devtools'],
  scope: 'user',
  requiresCapability: 'cdpInspection',
  capabilityUnavailableHint:
    'This browser doesn’t expose the debugging protocol, so deep request inspection isn’t available here.',
});

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'inspection.cdpEnabled': boolean;
  }
}
