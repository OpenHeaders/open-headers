/**
 * useAppUpdateNotification — bridges the host's `getAppUpdate`
 * capability into the notifications timeline.
 *
 * On hosts with an in-app updater (bridge `oh.updates.*`) the entry
 * mirrors live state: hydrate from `getState` at mount, follow the
 * `appUpdateState` broadcast after. A release below the published
 * security floor escalates the entry — warning severity, copy naming
 * the fix (`docs/UPDATES_PLAN.md` §4). URL-reporting hosts without an
 * updater fall back to the one-shot capability probe. Deduped per
 * version so re-mounts and repeat broadcasts don't stack entries.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useEffect } from 'react';
import { readIgnoredVersion } from '../updates/release-notes';
import { pushNotification } from './store';

function pushAppUpdateEntry(t: Translate, version: string, options: { url?: string; security?: boolean } = {}): void {
  const { url, security } = options;
  pushNotification({
    severity: security ? 'warning' : 'info',
    title: security
      ? t('shared.notifications.appUpdate.securityTitle', { version })
      : t('shared.notifications.appUpdate.title', { version }),
    description: security ? t('shared.notifications.appUpdate.securityDescription') : undefined,
    // The escalated entry is a different fact than the plain one — a
    // check that learns the floor mid-session must still speak up.
    dedupeKey: security ? `app-update-security:${version}` : `app-update:${version}`,
    // In-app updater hosts omit `url` — the gear dot + Settings update
    // row own the flow there, so the entry is informational.
    actions: url
      ? [
          {
            label: t('shared.notifications.appUpdate.download'),
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

function pushFromState(t: Translate, state: AppUpdateState): void {
  const pending = state.phase === 'available' || state.phase === 'downloading' || state.phase === 'downloaded';
  if (pending && state.availableVersion !== null) {
    // An explicitly ignored version stays out of the timeline — unless
    // it's below the security floor, which always speaks.
    if (!state.belowSafeFloor && readIgnoredVersion() === state.availableVersion) return;
    pushAppUpdateEntry(t, state.availableVersion, { security: state.belowSafeFloor });
  }
}

export function useAppUpdateNotification(): void {
  const t = useT();
  useEffect(() => {
    const probe = getCapability('getAppUpdate');
    if (!probe) return;
    let cancelled = false;
    const bridge = getHostBridge();
    if (bridge) {
      // In-app updater host: state carries severity, so hydrate from it
      // instead of the probe (which cannot report escalation).
      void bridge
        .call('oh.updates.getState')
        .then((state) => {
          if (!cancelled) pushFromState(t, state);
        })
        .catch(() => {
          // Host without the updater RPC — fall back to the probe.
          void probe().then((info) => {
            if (cancelled || !info) return;
            pushAppUpdateEntry(t, info.version, { url: info.url });
          });
        });
      const unsubscribe = bridge.subscribe('appUpdateState', (state) => pushFromState(t, state));
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
    void probe().then((info) => {
      if (cancelled || !info) return;
      pushAppUpdateEntry(t, info.version, { url: info.url });
    });
    return () => {
      cancelled = true;
    };
  }, [t]);
}
