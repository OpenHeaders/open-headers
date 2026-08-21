/**
 * AppUpdateToast — the corner balloon mirroring the host's update flow.
 *
 * Live mirror, not a one-shot announcement: on hosts with an in-app
 * updater (bridge `oh.updates.*`) the balloon follows the phase —
 * "available" with an Update… link, then "ready to install" with a
 * Restart action — so it can never contradict what the native menus /
 * Settings row show. Hosts that only report a download URL (no
 * updater) get the plain "available" balloon.
 *
 * Appearance rules:
 *   - "available" shows once per offered version (localStorage ack), so
 *     re-mounts and later sessions stay quiet.
 *   - the download phase shows NO toast — the footer's background-task
 *     bar owns that progress; an open balloon closes when the download
 *     starts.
 *   - "ready to install" opens once per session — it's the one phase
 *     with a pending action.
 *   - dismissing (hover-revealed ✕) silences the current phase; a phase
 *     change may speak again per the rules above.
 */

import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { App, Button, Dropdown, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { readIgnoredVersion, releasePageUrl, writeIgnoredVersion } from '../updates/release-notes';
import { openUpdateDialog } from '../updates/store';
import './corner-notifications.css';
import { pushNotification } from './store';

// Above the notification layer (antd notices sit at ~2050), so the ⋮
// dropdown and the tooltips paint over the balloon, not under it.
const OVERLAY_Z = 2100;

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

// Compact balloon shape (width, type scale, hover-revealed controls,
// instant motion) lives in `corner-notifications.css` and applies to
// every corner notice, not just the update balloons.
const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 13 };

// The ⋮ next to the ✕ — Settings… plus a per-version mute, so the
// balloon can be tamed without hunting through Settings. Own component
// (not built inline in the effect) so it can hold the menu-open state
// that suppresses the hover tooltip while the menu is showing — the
// pointer stays on the trigger after the click, so without the
// suppression the tooltip would sit over the opened menu.
const ToastCornerMenu: React.FC<{ onPick: (key: string) => void }> = ({ onPick }) => {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      overlayStyle={{ zIndex: OVERLAY_Z }}
      onOpenChange={setMenuOpen}
      menu={{
        items: [
          { key: 'settings', label: t('shared.notifications.toast.settings') },
          { key: 'ignore', label: t('shared.notifications.toast.dontShowAgain') },
        ],
        onClick: ({ key }) => onPick(key),
      }}
    >
      <Tooltip
        title={t('shared.notifications.toast.optionsTooltip')}
        zIndex={OVERLAY_Z}
        open={menuOpen ? false : undefined}
      >
        <button type="button" aria-label={t('shared.notifications.toast.optionsAria')} className="oh-update-toast-menu">
          <MoreOutlined />
        </button>
      </Tooltip>
    </Dropdown>
  );
};

interface AppUpdateToastProps {
  /** Route to the Settings update row (the ⋮ menu's Settings… item). */
  onOpenUpdateSettings: () => void;
  /**
   * Open the bundled What's New tab. When provided AND the host
   * registers `getWhatsNew`, the post-update "See what's new" actions
   * open it instead of the external release page — the notes ship in
   * the build, so staying in-app costs no request.
   */
  onOpenWhatsNew?: () => void;
}

const AppUpdateToast: React.FC<AppUpdateToastProps> = ({ onOpenUpdateSettings, onOpenWhatsNew }) => {
  const { notification } = App.useApp();
  const t = useT();
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

    const cornerMenu = (version: string): React.ReactNode => (
      <ToastCornerMenu
        onPick={(key) => {
          close();
          if (key === 'settings') onOpenUpdateSettings();
          else writeIgnoredVersion(version);
        }}
      />
    );

    const show = (marker: string | null, message: string, description: React.ReactNode, version?: string): void => {
      shownMarkerRef.current = marker;
      notification.info({
        key: TOAST_KEY,
        className: 'oh-update-toast',
        message,
        description: version ? (
          <>
            {description}
            {cornerMenu(version)}
          </>
        ) : (
          description
        ),
        closeIcon: (
          <Tooltip title={t('shared.notifications.toast.close')} zIndex={OVERLAY_Z}>
            <CloseOutlined />
          </Tooltip>
        ),
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
      releaseNotesUrl: string | null;
      progressPercent: number | null;
      errorMessage: string | null;
      lastCheckReason: 'manual' | 'scheduled' | null;
      installMethod: 'builtin' | 'packageManager';
    }): void => {
      const settledFrom = prevPhase;
      prevPhase = state.phase;
      const version = state.availableVersion;
      if (version === null || state.phase === 'idle' || state.phase === 'error' || state.phase === 'checking') {
        if (shownMarkerRef.current !== null) close();
        if (settledFrom === 'checking' && state.lastCheckReason === 'manual') {
          if (state.phase === 'idle') {
            showTransient(
              'info',
              t('shared.notifications.toast.upToDateTitle'),
              t('shared.notifications.toast.upToDateDescription', { version: state.currentVersion }),
            );
          } else if (state.phase === 'error') {
            showTransient('error', t('shared.notifications.toast.checkFailed'), state.errorMessage ?? undefined);
          }
        } else if (settledFrom === 'downloading' && state.phase === 'error') {
          // A download failure is always user-consented work — speak up.
          showTransient('error', t('shared.notifications.toast.downloadFailed'), state.errorMessage ?? undefined);
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
          if (state.installMethod === 'packageManager') {
            // deb/rpm installs: the package manager owns the install,
            // so the balloon informs and links the notes — no consent
            // dialog to open.
            const notesUrl = state.releaseNotesUrl ?? releasePageUrl(version);
            show(
              marker,
              t('shared.notifications.toast.available', { version }),
              <>
                <div>{t('shared.notifications.toast.packageManager')}</div>
                {updateLink(t('shared.notifications.toast.releaseNotes'), () => {
                  const openUrl = getCapability('openExternalUrl');
                  if (openUrl) void openUrl(notesUrl);
                  else window.open(notesUrl, '_blank', 'noopener');
                })}
              </>,
              version,
            );
            break;
          }
          show(
            marker,
            t('shared.notifications.toast.available', { version }),
            updateLink(t('shared.notifications.toast.update'), openUpdateDialog),
            version,
          );
          break;
        case 'downloading':
          // The footer's background-task bar owns download progress —
          // an open "available" balloon closes when the download
          // starts instead of morphing into a duplicate progress toast.
          if (isOpen) close();
          break;
        case 'downloaded':
          // The one phase with a pending action — once per session.
          if (!isOpen && announcedRef.current.has(marker)) return;
          announcedRef.current.add(marker);
          show(
            marker,
            t('shared.notifications.toast.readyToInstall', { version }),
            updateLink(t('shared.notifications.toast.restartToInstall'), () => {
              void bridge?.call('oh.updates.install');
            }),
            version,
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
        message: t('shared.notifications.toast.updatedTo', { version: currentVersion }),
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
            {t('shared.notifications.toast.seeWhatsNew')}
          </Button>
        ),
        placement: 'bottomRight',
        duration: 8,
      });
      pushNotification({
        severity: 'success',
        title: t('shared.notifications.toast.updatedTo', { version: currentVersion }),
        dedupeKey: `app-updated:${currentVersion}`,
        actions: [{ label: t('shared.notifications.toast.seeWhatsNew'), run: openReleasePage }],
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
          t('shared.notifications.toast.available', { version: info.version }),
          updateLink(t('shared.notifications.toast.update'), () => {
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
  }, [notification, onOpenUpdateSettings, onOpenWhatsNew, t]);

  return null;
};

export default AppUpdateToast;
