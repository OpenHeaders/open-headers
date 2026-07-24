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

import type { CdpScopeMode } from '@openheaders/core/types';
import { cdpScopeModeSchema } from '@openheaders/core/types';
import * as v from 'valibot';
import { registerSetting } from '../registry';

registerSetting({
  key: 'inspection.cdpEnabled',
  type: 'boolean',
  // OFF by default everywhere: attaching the debugging protocol shows the
  // browser's "started debugging this browser" banner on every inspected
  // tab, so the attach must be an explicit user choice. Where the protocol
  // doesn't exist at all (Firefox / Safari — no `cdpInspection` capability)
  // the switch also reads OFF and is gated by `requiresCapability`.
  default: false,
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
