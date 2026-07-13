/**
 * Debug mode category — the opt-in path that attaches the browser's
 * debugging protocol.
 *
 * `inspection.cdpEnabled` is the global master switch. It decides *whether*
 * the browser's debugging protocol is used; the developer-tools session on
 * each tab decides *when* it attaches. The service worker is the sole owner
 * of that protocol — every surface here only writes the setting to storage,
 * and the worker reconciles the attached set from it.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import type { CdpScopeMode } from '@openheaders/core/types';
import { cdpScopeModeSchema } from '@openheaders/core/types';
import * as v from 'valibot';
import { registerSetting } from '../registry';

registerSetting({
  key: 'inspection.cdpEnabled',
  type: 'boolean',
  default: true,
  // Host-aware: on by default only where the debugging protocol exists
  // (Chromium-family, signalled by the `cdpInspection` capability). On
  // Firefox / Safari the capability is absent, so the master switch
  // defaults — and reads — OFF rather than stranding tabs on a protocol
  // the runtime can't speak.
  getDefault: () => hasCapability('cdpInspection'),
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.inspection.cdpEnabled.label',
  descriptionKey: 'workbench.settings.def.inspection.cdpEnabled.description',
  category: 'inspection',
  tags: ['network', 'inspection', 'requests', 'debugging', 'devtools'],
  scope: 'user',
  requiresCapability: 'cdpInspection',
  capabilityUnavailableHintKey: 'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint',
});

registerSetting({
  key: 'inspection.cdpScope',
  type: 'enum',
  default: 'devtools',
  schema: cdpScopeModeSchema,
  labelKey: 'workbench.settings.def.inspection.cdpScope.label',
  descriptionKey: 'workbench.settings.def.inspection.cdpScope.description',
  category: 'inspection',
  tags: ['network', 'inspection', 'requests', 'debugging', 'devtools', 'scope'],
  scope: 'user',
  requiresCapability: 'cdpInspection',
  capabilityUnavailableHintKey: 'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint',
  enumOptions: [
    {
      value: 'devtools',
      labelKey: 'workbench.settings.def.inspection.cdpScope.option.devtools.label',
      descriptionKey: 'workbench.settings.def.inspection.cdpScope.option.devtools.description',
    },
    {
      value: 'active',
      labelKey: 'workbench.settings.def.inspection.cdpScope.option.active.label',
      descriptionKey: 'workbench.settings.def.inspection.cdpScope.option.active.description',
    },
    {
      value: 'both',
      labelKey: 'workbench.settings.def.inspection.cdpScope.option.both.label',
      descriptionKey: 'workbench.settings.def.inspection.cdpScope.option.both.description',
    },
  ],
});

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'inspection.cdpEnabled': boolean;
    'inspection.cdpScope': CdpScopeMode;
  }
}
