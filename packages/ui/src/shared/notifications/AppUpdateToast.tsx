/**
 * AppUpdateToast — the one-time "Open Headers X available" balloon.
 *
 * Complements the timeline entry (`useAppUpdateNotification`) with a
 * floating corner toast the user can't miss: shown once per offered
 * version (acknowledged in localStorage, so re-mounts and later
 * sessions stay quiet), dismissible via the close affordance that
 * reveals on hover, with an Update… action that routes to wherever the
 * host's update flow lives — the Settings update row for in-app
 * updater hosts, the download URL otherwise.
 */

import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { App, Button } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';

const TOAST_ACK_KEY = 'oh.updateToastAck';

function readAck(): string | null {
  try {
    return window.localStorage.getItem(TOAST_ACK_KEY);
  } catch {
    return null;
  }
}

function writeAck(version: string): void {
  try {
    window.localStorage.setItem(TOAST_ACK_KEY, version);
  } catch {
    // Storage unavailable — the ref below still dedupes this session.
  }
}

/** Hover-reveal for the toast's close button, notification-balloon style. */
const HOVER_CLOSE_CSS =
  '.oh-update-toast .ant-notification-notice-close{opacity:0;transition:opacity 0.15s ease}' +
  '.oh-update-toast:hover .ant-notification-notice-close,' +
  '.oh-update-toast .ant-notification-notice-close:focus-visible{opacity:1}';

interface AppUpdateToastProps {
  /** Route to the Settings update row (in-app updater hosts). */
  onOpenAbout: () => void;
}

const AppUpdateToast: React.FC<AppUpdateToastProps> = ({ onOpenAbout }) => {
  const { notification } = App.useApp();
  // Session-level dedupe alongside the persisted ack — covers the
  // storage-unavailable case and same-session broadcast repeats.
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!getCapability('getAppUpdate')) return;

    const show = (version: string, url?: string): void => {
      if (shownRef.current === version || readAck() === version) return;
      shownRef.current = version;
      writeAck(version);
      const key = `oh-app-update-${version}`;
      notification.info({
        key,
        className: 'oh-update-toast',
        message: `Open Headers ${version} available`,
        description: (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => {
              notification.destroy(key);
              if (url) {
                const openUrl = getCapability('openExternalUrl');
                if (openUrl) void openUrl(url);
                else window.open(url, '_blank', 'noopener');
              } else {
                onOpenAbout();
              }
            }}
          >
            Update…
          </Button>
        ),
        placement: 'bottomRight',
        duration: 0,
      });
    };

    // Probe covers every host that reports updates; the broadcast below
    // additionally catches desktop checks that land mid-session.
    let cancelled = false;
    const probe = getCapability('getAppUpdate');
    if (probe) {
      void probe().then((info) => {
        if (!cancelled && info) show(info.version, info.url);
      });
    }
    const unsubscribe = getHostBridge()?.subscribe('appUpdateState', (state) => {
      if (state.phase === 'available' && state.availableVersion !== null) show(state.availableVersion);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [notification, onOpenAbout]);

  return <style>{HOVER_CLOSE_CSS}</style>;
};

export default AppUpdateToast;
