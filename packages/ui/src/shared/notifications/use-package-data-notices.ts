/**
 * usePackageDataNotices — what became of the data a move to the Windows
 * package handed over, said on the Notifications timeline of the package
 * that started (the `packageDataMove` capability; no other host has it).
 *
 * A start that took the data in says so once, with what a person has to
 * redo: it is an event of that start, and a later start has nothing to
 * say. Data that was not brought over is a standing fact — the host
 * reports it at every start while the classic folder still holds it — so
 * its card has no dismissal and no mute.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { useT } from '../../context/LocaleContext';
import { useSettingsReady } from '../../workbench/settings/hooks';
import { pushNotification } from './store';

export function usePackageDataNotices(): void {
  const t = useT();
  // Entries capture copy at push time — wait for the settings store so
  // the persisted locale is the one the cards are written in.
  const ready = useSettingsReady();
  useEffect(() => {
    if (!ready) return;
    const move = getCapability('packageDataMove')?.();
    if (!move) return;
    if (move.takenIn) {
      pushNotification({
        severity: 'success',
        title: t('shared.notifications.packageArrived.title'),
        description: t('shared.notifications.packageArrived.description'),
        dedupeKey: 'package-arrived',
      });
    }
    if (move.leftAt !== null) {
      pushNotification({
        severity: 'warning',
        title: t('shared.notifications.packageDataLeft.title'),
        description: t('shared.notifications.packageDataLeft.description', { path: move.leftAt }),
        dedupeKey: 'package-data-left',
        sticky: true,
      });
    }
  }, [ready, t]);
}
