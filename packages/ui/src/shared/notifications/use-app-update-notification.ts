/**
 * useAppUpdateNotification — bridges the host's `getAppUpdate`
 * capability into the notifications timeline.
 *
 * Probes once on mount; when the host reports a newer build (desktop
 * app only — extension surfaces never register the capability), pushes
 * an info entry with a Download action. Hosts with an in-app updater
 * also emit `appUpdateState`, so a check that finds an update
 * mid-session lands in the timeline too. Deduped per version so
 * re-mounts and repeat broadcasts don't stack entries.
 */

import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { pushNotification } from './store';

function pushAppUpdateEntry(version: string, url?: string): void {
  pushNotification({
    severity: 'info',
    title: `Open Headers ${version} available`,
    dedupeKey: `app-update:${version}`,
    // In-app updater hosts omit `url` — the gear dot + Settings update
    // row own the flow there, so the entry is informational.
    actions: url
      ? [
          {
            label: 'Download…',
            run: () => {
              const openUrl = getCapability('openExternalUrl');
              if (openUrl) void openUrl(url);
              else window.open(url, '_blank', 'noopener');
            },
          },
        ]
      : [],
  });
}

export function useAppUpdateNotification(): void {
  useEffect(() => {
    const probe = getCapability('getAppUpdate');
    if (!probe) return;
    let cancelled = false;
    void probe().then((info) => {
      if (cancelled || !info) return;
      pushAppUpdateEntry(info.version, info.url);
    });
    const unsubscribe = getHostBridge()?.subscribe('appUpdateState', (state) => {
      if (state.phase === 'available' && state.availableVersion !== null) {
        pushAppUpdateEntry(state.availableVersion);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
}
