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

const checkTierSchema = v.picklist(UPDATE_CHECK_TIERS);

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'updates.state': string;
    'updates.check': UpdateCheckTier;
    'updates.autoDownload': boolean;
    'updates.showWhatsNew': boolean;
  }
}

registerSetting({
  key: 'updates.state',
  type: 'info',
  default: '',
  schema: v.string(),
  label: 'Software update',
  description: 'Current update status. Downloading and installing always take your explicit click.',
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
  label: 'Check for updates',
  description:
    'Look for new versions once a day and show a notification dot when one is available. ' +
    'The check downloads nothing and sends nothing about you or this install — it reads a public version listing and compares locally. ' +
    '"Security fixes only" stays silent unless a release fixes a security issue affecting the version you are running. ' +
    'Updates are never installed without your explicit action.',
  category: 'about',
  tags: ['update', 'version', 'release', 'notify', 'check'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  enumOptions: [
    { value: 'all', label: 'All releases' },
    { value: 'security-only', label: 'Security fixes only' },
    { value: 'off', label: 'Off' },
  ],
});

registerSetting({
  key: 'updates.showWhatsNew',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: "Show What's New after updating",
  description:
    'Open a tab with the release highlights the first time you open the workbench after a feature release. ' +
    'Patch releases never open it — they stay in the notifications timeline. ' +
    'The notes ship inside the app; nothing is fetched.',
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
  label: 'Download updates automatically',
  description:
    'When an update is found, fetch it in the background right away so installing is a single restart — ' +
    'useful if you want fixes staged as fast as possible. ' +
    'Off means you click Download yourself. Either way, nothing installs until you restart the app or choose to.',
  category: 'about',
  tags: ['update', 'download', 'background', 'staged'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});
