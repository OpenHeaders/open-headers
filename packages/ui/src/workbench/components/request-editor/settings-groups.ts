/**
 * Topical group vocabulary of the request Settings tab — shared by the
 * live knob sections, the runtime-managed fact sheet, and each row's
 * info-popover kicker, so all three read in the same order with the
 * same labels.
 */

import type { MessageKey } from '@openheaders/i18n';

export type SettingsGroupKey = 'connection' | 'tls' | 'redirects' | 'cookies' | 'execution';

export const GROUP_ORDER: SettingsGroupKey[] = ['connection', 'tls', 'redirects', 'cookies', 'execution'];

export const GROUP_LABEL_KEY: Record<SettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.request.settings.group.connection',
  tls: 'workbench.editors.request.settings.group.tls',
  redirects: 'workbench.editors.request.settings.group.redirects',
  cookies: 'workbench.editors.request.settings.group.cookies',
  execution: 'workbench.editors.request.settings.group.execution',
};
