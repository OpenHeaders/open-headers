/**
 * Update preferences — the check-and-notify consent axes
 * (`docs/UPDATES_PLAN.md` §5). Two orthogonal choices: whether the app
 * LOOKS for updates, and whether a seen update DOWNLOADS by itself.
 * Installing is never automatic on either path — a downloaded update
 * applies only on the explicit restart action or the next natural app
 * quit.
 *
 * Desktop-only rows: the store updates the extension itself, and a web
 * tab updates with the daemon that serves it. The `security-only` tier
 * keys off the published severity manifest (`versions.json`): scheduled
 * checks stay silent unless a security release names a safe floor above
 * the running version.
 */

import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

const AppUpdateRow = lazy(() => import('../components/app-update-row'));

export const UPDATE_CHECK_TIERS = ['all', 'security-only', 'off'] as const;
export type UpdateCheckTier = (typeof UPDATE_CHECK_TIERS)[number];

export const UPDATE_CHANNELS = ['stable', 'beta'] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];

const checkTierSchema = v.picklist(UPDATE_CHECK_TIERS);
const channelSchema = v.picklist(UPDATE_CHANNELS);

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'updates.state': string;
    'updates.check': UpdateCheckTier;
    'updates.channel': UpdateChannel;
    'updates.autoDownload': boolean;
    'updates.showWhatsNew': boolean;
  }
}

registerSetting({
  key: 'updates.state',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.updates.state.label',
  descriptionKey: 'workbench.settings.def.updates.state.description',
  category: 'about',
  tags: ['update', 'version', 'download', 'install', 'restart'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  customEditor: AppUpdateRow,
});

registerSetting({
  key: 'updates.check',
  type: 'enum',
  default: 'all',
  schema: checkTierSchema,
  labelKey: 'workbench.settings.def.updates.check.label',
  descriptionKey: 'workbench.settings.def.updates.check.description',
  category: 'about',
  tags: ['update', 'version', 'release', 'notify', 'check'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  enumOptions: [
    { value: 'all', labelKey: 'workbench.settings.def.updates.check.option.all.label' },
    { value: 'security-only', labelKey: 'workbench.settings.def.updates.check.option.security-only.label' },
    { value: 'off', labelKey: 'workbench.settings.def.updates.check.option.off.label' },
  ],
});

registerSetting({
  key: 'updates.channel',
  type: 'enum',
  default: 'stable',
  schema: channelSchema,
  labelKey: 'workbench.settings.def.updates.channel.label',
  descriptionKey: 'workbench.settings.def.updates.channel.description',
  category: 'about',
  tags: ['update', 'channel', 'beta', 'stable', 'release', 'early'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  enumOptions: [
    { value: 'stable', labelKey: 'workbench.settings.def.updates.channel.option.stable.label' },
    { value: 'beta', labelKey: 'workbench.settings.def.updates.channel.option.beta.label' },
  ],
});

registerSetting({
  key: 'updates.showWhatsNew',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.updates.showWhatsNew.label',
  descriptionKey: 'workbench.settings.def.updates.showWhatsNew.description',
  category: 'about',
  tags: ['update', 'release', 'notes', 'whats new', 'changelog'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});

registerSetting({
  key: 'updates.autoDownload',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.updates.autoDownload.label',
  descriptionKey: 'workbench.settings.def.updates.autoDownload.description',
  category: 'about',
  tags: ['update', 'download', 'background', 'staged'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});
