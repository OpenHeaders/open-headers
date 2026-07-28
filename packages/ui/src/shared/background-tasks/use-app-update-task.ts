/**
 * useAppUpdateTask — feeds the updater's busy phases into the
 * background-tasks store: an indeterminate "Checking for updates" bar
 * while a check runs, a percent bar while a download stages, nothing
 * otherwise. Display only — the update service owns the work.
 *
 * No-op on hosts without an in-app updater (the bridge RPC rejects and
 * no `appUpdateState` ever arrives).
 */

import { getHostBridge } from '@openheaders/core/bridge';
import { useEffect } from 'react';
import { removeBackgroundTask, upsertBackgroundTask } from './store';

const TASK_ID = 'app-update';

export function useAppUpdateTask(): void {
  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    const apply = (state: { phase: string; availableVersion: string | null; progressPercent: number | null }): void => {
      switch (state.phase) {
        case 'checking':
          upsertBackgroundTask({ id: TASK_ID, title: 'Checking for updates', percent: null });
          break;
        case 'downloading':
          upsertBackgroundTask({
            id: TASK_ID,
            title: `Downloading ${state.availableVersion ?? 'update'}`,
            detail: 'Installs when you restart',
            percent: state.progressPercent ?? 0,
          });
          break;
        default:
          removeBackgroundTask(TASK_ID);
      }
    };
    let cancelled = false;
    void bridge
      .call('oh.updates.getState')
      .then((state) => {
        if (!cancelled) apply(state);
      })
      .catch(() => {
        // Host without the updater RPC — nothing to track.
      });
    const unsubscribe = bridge.subscribe('appUpdateState', apply);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
