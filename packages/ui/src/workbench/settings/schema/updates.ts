/**
 * Update preferences — the check-and-notify consent axes
 * (the updates plan §5). Two orthogonal choices: whether the app
 * LOOKS for updates, and whether a seen update DOWNLOADS by itself
 * (default on, so installing is a single Update & Restart and a natural
 * quit+relaunch opens the new version). A restart is never automatic on
 * either path — a staged update applies only on the explicit Update &
 * Restart action or the next natural app quit.
 *
 * Desktop-only rows: the store updates the extension itself, and a web
 * tab updates with the daemon that serves it. The `security-only` tier
 * keys off the published severity manifest (`versions.json`): scheduled
 * checks stay silent unless a security release names a safe floor above
 * the running version.
 */

import { getCapability, hasCapability } from '@openheaders/core/capabilities';
import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

const AppUpdateRow = lazy(() => import('../components/app-update-row'));
const PackageSwitchRow = lazy(() => import('../components/package-switch-row'));

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
    'updates.installType': string;
  }
}

registerSetting({
  key: 'updates.state',
  subcategory: 'status',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.updates.state.label',
  descriptionKey: 'workbench.settings.def.updates.state.description',
  category: 'updates',
  tags: ['update', 'version', 'download', 'install', 'restart'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  customEditor: AppUpdateRow,
});

registerSetting({
  key: 'updates.check',
  subcategory: 'behavior',
  type: 'enum',
  default: 'all',
  schema: checkTierSchema,
  labelKey: 'workbench.settings.def.updates.check.label',
  descriptionKey: 'workbench.settings.def.updates.check.description',
  category: 'updates',
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
  subcategory: 'behavior',
  type: 'enum',
  default: 'stable',
  // A build released on the Beta channel follows it until a channel is chosen.
  getDefault: () => getCapability('updateChannelDefault')?.() ?? 'stable',
  schema: channelSchema,
  labelKey: 'workbench.settings.def.updates.channel.label',
  descriptionKey: 'workbench.settings.def.updates.channel.description',
  category: 'updates',
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
  subcategory: 'behavior',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.updates.showWhatsNew.label',
  descriptionKey: 'workbench.settings.def.updates.showWhatsNew.description',
  category: 'updates',
  tags: ['update', 'release', 'notes', 'whats new', 'changelog'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});

registerSetting({
  key: 'updates.autoDownload',
  subcategory: 'behavior',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.updates.autoDownload.label',
  descriptionKey: 'workbench.settings.def.updates.autoDownload.description',
  category: 'updates',
  tags: ['update', 'download', 'background', 'staged'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop' && !hasCapability('updatesOnRequest'),
});

// An install that can change how it is installed names its install type
// and offers the switch: the desktop app installed by the classic Windows
// installer registers the capability, and no other host shows the row or
// its section. The row owns its dialog and what it says of a switch.
registerSetting({
  key: 'updates.installType',
  subcategory: 'installation',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.def.updates.installType.label',
  descriptionKey: 'workbench.settings.def.updates.installType.description',
  category: 'updates',
  tags: ['install', 'installer', 'windows', 'package', 'msix', 'switch', 'migrate'],
  scope: 'user',
  when: () => hasCapability('packageSwitch'),
  customEditor: PackageSwitchRow,
});
