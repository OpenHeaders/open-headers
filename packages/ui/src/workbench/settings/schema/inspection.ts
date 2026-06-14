/**
 * Request Inspection category — the opt-in deep request-inspection path.
 *
 * `inspection.cdpEnabled` is the global master switch. It decides *whether*
 * the browser's debugging protocol is used; the developer-tools session on
 * each tab decides *when* it attaches. The service worker is the sole owner
 * of that protocol — every surface here only writes the setting to storage,
 * and the worker reconciles the attached set from it.
 */

import type { CdpScopeMode } from '@openheaders/core/types';
import { cdpScopeModeSchema } from '@openheaders/core/types';
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

registerSetting({
  key: 'inspection.cdpScope',
  type: 'enum',
  default: 'devtools',
  schema: cdpScopeModeSchema,
  label: 'Inspect which tabs',
  description:
    'Which tabs deep inspection attaches to while it’s on. “Where DevTools is open” attaches to browser tabs with their developer tools open. “The focused tab” follows the active browser tab without needing developer tools open — switching to a new-tab or internal page leaves the prior tab attached rather than thrashing. “Both” combines the two. Individual browser tabs can also be pinned in from the footer regardless of this choice.',
  category: 'inspection',
  tags: ['network', 'inspection', 'requests', 'debugging', 'devtools', 'scope'],
  scope: 'user',
  requiresCapability: 'cdpInspection',
  capabilityUnavailableHint:
    'This browser doesn’t expose the debugging protocol, so deep request inspection isn’t available here.',
  enumOptions: [
    {
      value: 'devtools',
      label: 'Where DevTools is open',
      description: 'Browser tabs with their developer tools open.',
    },
    {
      value: 'active',
      label: 'The focused tab',
      description: 'The active browser tab, following focus — no developer tools needed.',
    },
    { value: 'both', label: 'Both', description: 'DevTools tabs and the focused tab.' },
  ],
});

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'inspection.cdpEnabled': boolean;
    'inspection.cdpScope': CdpScopeMode;
  }
}
