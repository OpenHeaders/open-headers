/**
 * useUpdatedNotification — the post-update "Updated to X" timeline
 * entry for hosts WITHOUT an in-app updater: the platform applied the
 * update out-of-band (browser extension store), so the first surface
 * opened after the version changed announces it. Hosts that register
 * `getAppUpdate` are skipped entirely — their AppUpdateToast owns the
 * announcement (and the same `oh.lastRunVersion` latch), so the two
 * producers never race.
 *
 * The "See what's new" action appears only when the host bundles notes
 * (`getWhatsNew`) AND the surface supplies a destination — the
 * workbench opens its What's New tab, the devtools panel and popup
 * open the in-surface modal. Fresh installs (no recorded prior
 * version) stay quiet. The latch is origin-shared localStorage, so one
 * surface announces per bump; the keyed entry then arrives pre-seen on
 * other surfaces via the store's ack fan-out.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { useT } from '../../context/LocaleContext';
import { useSettingsReady } from '../../workbench/settings/hooks';
import { getBuildInfo } from '../build-info';
import { pushNotification } from './store';

const LAST_RUN_VERSION_KEY = 'oh.lastRunVersion';

export function useUpdatedNotification(onOpenWhatsNew?: () => void): void {
  const t = useT();
  // Entries capture copy at push time — hold the announcement until the
  // settings store resolves `general.language` (same rule as
  // useAppUpdateNotification); the latch stays untouched while waiting.
  const ready = useSettingsReady();
  useEffect(() => {
    if (!ready) return;
    if (getCapability('getAppUpdate')) return;
    const version = getBuildInfo().version;
    if (version === '0.0.0') return;
    let previous: string | null;
    try {
      previous = window.localStorage.getItem(LAST_RUN_VERSION_KEY);
      window.localStorage.setItem(LAST_RUN_VERSION_KEY, version);
    } catch {
      return;
    }
    if (previous === null || previous === version) return;
    const hasNotes = (getCapability('getWhatsNew')?.() ?? null) !== null;
    pushNotification({
      severity: 'success',
      title: t('shared.notifications.toast.updatedTo', { version }),
      dedupeKey: `app-updated:${version}`,
      actions:
        hasNotes && onOpenWhatsNew ? [{ label: t('shared.notifications.toast.seeWhatsNew'), run: onOpenWhatsNew }] : [],
    });
  }, [ready, t, onOpenWhatsNew]);
}
