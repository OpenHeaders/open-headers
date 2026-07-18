/**
 * SecurityUpdateBanner — the loud tier's entry banner
 * (`docs/UPDATES_PLAN.md` §4). Renders only while the host's updater
 * reports `belowSafeFloor`: the running version is under the safe
 * floor a published security release named. In-flow under the top bar
 * so entering the workbench cannot miss it.
 *
 * Volume, not consent: the banner names the fix and routes to the
 * Settings update row — installing still takes the user's explicit
 * clicks there. Closable per session; it returns next session while
 * the exposure persists.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { Alert, Button } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

interface SecurityUpdateBannerProps {
  /** Route to the Settings update row, which owns download/install. */
  onOpenUpdates: () => void;
}

const SecurityUpdateBanner: React.FC<SecurityUpdateBannerProps> = ({ onOpenUpdates }) => {
  const t = useT();
  const [state, setState] = useState<AppUpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .call('oh.updates.getState')
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        // Host without the updater RPC — no banner.
      });
    const unsubscribe = bridge.subscribe('appUpdateState', setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (state === null || !state.belowSafeFloor || dismissed) return null;

  const message = state.availableVersion
    ? t('shared.notifications.securityBanner.messageWithVersion', {
        availableVersion: state.availableVersion,
        currentVersion: state.currentVersion,
      })
    : t('shared.notifications.securityBanner.messageNoVersion', { currentVersion: state.currentVersion });

  return (
    <Alert
      banner
      type="error"
      showIcon
      closable
      onClose={() => setDismissed(true)}
      data-testid="security-update-banner"
      message={message}
      action={
        <Button size="small" danger onClick={onOpenUpdates}>
          {t('shared.notifications.securityBanner.update')}
        </Button>
      }
    />
  );
};

export default SecurityUpdateBanner;
