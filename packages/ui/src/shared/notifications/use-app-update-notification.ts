/**
 * useAppUpdateNotification — bridges the host's `getAppUpdate`
 * capability into the notifications timeline.
 *
 * Probes once on mount; when the host reports a newer build (desktop
 * app only — extension surfaces never register the capability), pushes
 * an info entry with a Download action. Deduped per version so
 * re-mounts don't stack entries.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { pushNotification } from './store';

export function useAppUpdateNotification(): void {
  useEffect(() => {
    const probe = getCapability('getAppUpdate');
    if (!probe) return;
    let cancelled = false;
    void probe().then((info) => {
      if (cancelled || !info) return;
      pushNotification({
        severity: 'info',
        title: `Open Headers ${info.version} available`,
        dedupeKey: `app-update:${info.version}`,
        actions: [
          {
            label: 'Download…',
            run: () => {
              const openUrl = getCapability('openExternalUrl');
              if (openUrl) void openUrl(info.url);
              else window.open(info.url, '_blank', 'noopener');
            },
          },
        ],
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
