/**
 * Update preferences — the check-and-notify consent axes
 * (`docs/UPDATES_PLAN.md` §5). Two orthogonal choices: whether the app
 * LOOKS for updates, and whether a seen update DOWNLOADS by itself.
 * Installing is never automatic on either path — a downloaded update
 * applies only on the explicit restart action or the next natural app
 * quit.
 *
 * Desktop-only rows: the store updates the extension itself, and a web
 * tab updates with the daemon that serves it. The tier vocabulary
 * already carries `security-only`; the UI exposes it in Phase 3, when
 * the severity manifest gives it meaning — shipping a selectable tier
 * that cannot fire yet would be dishonest UI.
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
    'Updates are never installed without your explicit action.',
  category: 'about',
  tags: ['update', 'version', 'release', 'notify', 'check'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
  enumOptions: [
    { value: 'all', label: 'All releases' },
    { value: 'off', label: 'Off' },
  ],
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
