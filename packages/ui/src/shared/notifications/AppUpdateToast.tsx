/**
 * AppUpdateToast — the corner balloon mirroring the host's update flow.
 *
 * Live mirror, not a one-shot announcement: on hosts with an in-app
 * updater (bridge `oh.updates.*`) the balloon follows the phase —
 * "available" with an Update… link, download progress, then "ready to
 * install" with a Restart action — so it can never contradict what the
 * native menus / Settings row show. Hosts that only report a download
 * URL (no updater) get the plain "available" balloon.
 *
 * Appearance rules:
 *   - "available" shows once per offered version (localStorage ack), so
 *     re-mounts and later sessions stay quiet.
 *   - progress only UPDATES an already-open balloon — a window opened
 *     mid-download doesn't get an uninvited toast (the gear dot and
 *     Settings row carry that state).
 *   - "ready to install" opens once per session — it's the one phase
 *     with a pending action.
 *   - dismissing (hover-revealed ✕) silences the current phase; a phase
 *     change may speak again per the rules above.
 */

import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { App, Button, Progress } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { readIgnoredVersion, releasePageUrl } from '../updates/release-notes';
import { openUpdateDialog } from '../updates/store';
import { pushNotification } from './store';

const TOAST_ACK_KEY = 'oh.updateToastAck';
const TOAST_KEY = 'oh-app-update';
const LAST_RUN_VERSION_KEY = 'oh.lastRunVersion';

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
    // Storage unavailable — the session refs below still dedupe.
  }
}

/**
 * Compact balloon shape: narrow card, small type, close
 * affordance revealed on hover.
 */
const TOAST_CSS =
  '.oh-update-toast.ant-notification-notice{width:272px;padding:8px 12px}' +
  '.oh-update-toast .ant-notification-notice-message{font-size:12px;line-height:1.4;margin-bottom:0}' +
  '.oh-update-toast .ant-notification-notice-description{font-size:11px;line-height:1.4}' +
  '.oh-update-toast .ant-notification-notice-icon{font-size:13px;line-height:1.4}' +
  '.oh-update-toast .ant-notification-notice-with-icon .ant-notification-notice-message,' +
  '.oh-update-toast .ant-notification-notice-with-icon .ant-notification-notice-description{margin-inline-start:20px}' +
  '.oh-update-toast .ant-notification-notice-close{top:8px;inset-inline-end:8px;width:16px;height:16px;font-size:11px;opacity:0;transition:opacity 0.15s ease}' +
  '.oh-update-toast:hover .ant-notification-notice-close,' +
  '.oh-update-toast .ant-notification-notice-close:focus-visible{opacity:1}';

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 11 };

interface AppUpdateToastProps {
  /**
   * Open the bundled What's New tab. When provided AND the host
   * registers `getWhatsNew`, the post-update "See what's new" actions
   * open it instead of the external release page — the notes ship in
   * the build, so staying in-app costs no request.
   */
  onOpenWhatsNew?: () => void;
}

const AppUpdateToast: React.FC<AppUpdateToastProps> = ({ onOpenWhatsNew }) => {
  const { notification } = App.useApp();
  // `${version}:${phase}` whose balloon closed — that phase stays
  // quiet. Any close counts: a ✕ is a dismissal, an action click means
  // the user already acted, a programmatic close precedes a quiet
  // phase.
  const dismissedRef = useRef<string | null>(null);
  // Marker currently on screen; null when closed. Progress only
  // updates an open balloon, never conjures one.
  const shownMarkerRef = useRef<string | null>(null);
  // Phases announced this session, `${version}:${phase}`.
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!getCapability('getAppUpdate')) return;

    const close = (): void => {
      notification.destroy(TOAST_KEY);
    };

    const show = (marker: string | null, message: string, description: React.ReactNode): void => {
      shownMarkerRef.current = marker;
      notification.info({
        key: TOAST_KEY,
        className: 'oh-update-toast',
        message,
        description,
        placement: 'bottomRight',
        duration: 0,
        onClose: () => {
          dismissedRef.current = shownMarkerRef.current;
          shownMarkerRef.current = null;
        },
      });
    };

    const updateLink = (label: string, run: () => void): React.ReactNode => (
      <Button
        type="link"
        size="small"
        style={LINK_STYLE}
        onClick={() => {
          close();
          run();
        }}
      >
        {label}
      </Button>
    );

    const bridge = getHostBridge();
    // Previous phase — a manual check's settle (checking → idle/error)
    // gets a transient result toast; scheduled checks stay silent.
    let prevPhase: string | null = null;

    const showTransient = (severity: 'info' | 'error', message: string, description?: string): void => {
      notification[severity]({
        key: 'oh-update-check-result',
        className: 'oh-update-toast',
        message,
        description,
        placement: 'bottomRight',
        duration: severity === 'info' ? 4 : 6,
      });
    };

    const renderPhase = (state: {
      phase: string;
      currentVersion: string;
      availableVersion: string | null;
      progressPercent: number | null;
      errorMessage: string | null;
      lastCheckReason: 'manual' | 'scheduled' | null;
    }): void => {
      const settledFrom = prevPhase;
      prevPhase = state.phase;
      const version = state.availableVersion;
      if (version === null || state.phase === 'idle' || state.phase === 'error' || state.phase === 'checking') {
        if (shownMarkerRef.current !== null) close();
        if (settledFrom === 'checking' && state.lastCheckReason === 'manual') {
          if (state.phase === 'idle') {
            showTransient('info', "You're up to date", `Open Headers ${state.currentVersion} is the latest version.`);
          } else if (state.phase === 'error') {
            showTransient('error', 'Update check failed', state.errorMessage ?? undefined);
          }
        } else if (settledFrom === 'downloading' && state.phase === 'error') {
          // A download failure is always user-consented work — speak up.
          showTransient('error', 'Update download failed', state.errorMessage ?? undefined);
        }
        return;
      }
      const marker = `${version}:${state.phase}`;
      const isOpen = shownMarkerRef.current !== null;
      if (dismissedRef.current === marker) return;

      switch (state.phase) {
        case 'available':
          // Announce once per version, ever — and never for a version
          // the user chose to ignore in the update dialog.
          if (readIgnoredVersion() === version) return;
          if (!isOpen && (announcedRef.current.has(marker) || readAck() === version)) return;
          announcedRef.current.add(marker);
          writeAck(version);
          show(marker, `Open Headers ${version} available`, updateLink('Update…', openUpdateDialog));
          break;
        case 'downloading':
          // Only keep an open balloon in sync — never conjure one.
          if (!isOpen) return;
          show(
            marker,
            `Downloading Open Headers ${version}…`,
            <Progress percent={state.progressPercent ?? 0} size="small" style={{ marginTop: 2 }} />,
          );
          break;
        case 'downloaded':
          // The one phase with a pending action — once per session.
          if (!isOpen && announcedRef.current.has(marker)) return;
          announcedRef.current.add(marker);
          show(
            marker,
            `Open Headers ${version} ready to install`,
            updateLink('Restart to install', () => {
              void bridge?.call('oh.updates.install');
            }),
          );
          break;
      }
    };

    // Post-update announcement: the version changed since the last run
    // of this surface, so the restart-to-install (or quit-applied
    // staging) landed. Once per bump; silent on a fresh install (no
    // prior version recorded).
    const announceUpdated = (currentVersion: string): void => {
      let previous: string | null;
      try {
        previous = window.localStorage.getItem(LAST_RUN_VERSION_KEY);
        window.localStorage.setItem(LAST_RUN_VERSION_KEY, currentVersion);
      } catch {
        return;
      }
      if (previous === null || previous === currentVersion) return;
      const url = releasePageUrl(currentVersion);
      const whatsNewTab = onOpenWhatsNew && getCapability('getWhatsNew')?.() ? onOpenWhatsNew : null;
      const openReleasePage = (): void => {
        if (whatsNewTab) {
          whatsNewTab();
          return;
        }
        const openUrl = getCapability('openExternalUrl');
        if (openUrl) void openUrl(url);
        else window.open(url, '_blank', 'noopener');
      };
      notification.success({
        key: 'oh-updated-to',
        className: 'oh-update-toast',
        message: `Updated to Open Headers ${currentVersion}`,
        description: (
          <Button
            type="link"
            size="small"
            style={LINK_STYLE}
            onClick={() => {
              notification.destroy('oh-updated-to');
              openReleasePage();
            }}
          >
            See what's new
          </Button>
        ),
        placement: 'bottomRight',
        duration: 8,
      });
      pushNotification({
        severity: 'success',
        title: `Updated to Open Headers ${currentVersion}`,
        dedupeKey: `app-updated:${currentVersion}`,
        actions: [{ label: "See what's new", run: openReleasePage }],
      });
    };

    // In-app updater host: hydrate from live state and mirror every
    // transition. The capability probe would collapse downloading/
    // downloaded into "available" — exactly the staleness this avoids.
    if (bridge) {
      let cancelled = false;
      void bridge
        .call('oh.updates.getState')
        .then((state) => {
          if (cancelled) return;
          renderPhase(state);
          announceUpdated(state.currentVersion);
        })
        .catch(() => {
          // Host without the updater RPC — nothing to mirror.
        });
      const unsubscribe = bridge.subscribe('appUpdateState', renderPhase);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    // URL-reporting host (no in-app updater): one-time announcement.
    let cancelled = false;
    const probe = getCapability('getAppUpdate');
    if (probe) {
      void probe().then((info) => {
        if (cancelled || !info || readAck() === info.version) return;
        writeAck(info.version);
        const { url } = info;
        show(
          `${info.version}:available`,
          `Open Headers ${info.version} available`,
          updateLink('Update…', () => {
            if (!url) return;
            const openUrl = getCapability('openExternalUrl');
            if (openUrl) void openUrl(url);
            else window.open(url, '_blank', 'noopener');
          }),
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [notification, onOpenWhatsNew]);

  return <style>{TOAST_CSS}</style>;
};

export default AppUpdateToast;
