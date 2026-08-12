/**
 * useDesktopAppSuggestion — a standing Suggestions card pitching the
 * companion desktop app to extension surfaces that don't have it.
 *
 * Host-gated on the `companionReveal` capability: only surfaces that
 * relay to a companion over the backend wire register it — the desktop
 * shell IS the companion and never does, so the card can't appear
 * inside the app it advertises.
 *
 * Retires permanently (persisted flag, same idiom as the seed nudges)
 * on the real completion signal, not just the click: the loopback
 * backend's sync slot going green — the desktop app is running and
 * connected here — or the native-messaging presence probe reporting an
 * install on this machine. Either way the pitch is moot. The download
 * action itself resolves this platform's latest installer from the
 * update feed (same single-flight fetch as the desktop teaser) with the
 * website's install section as fallback and secondary link.
 *
 * Standing advice, not a historical record: like the seed nudges it
 * follows a live locale switch via the sanctioned dismiss-and-reissue
 * path.
 */

import { BranchesOutlined, CodeOutlined, FundViewOutlined, RobotOutlined } from '@ant-design/icons';
import { ApiRequestsIcon } from '@openheaders/ui/shared/icons';
import { isLoopbackBackendUrl } from '@openheaders/core/backends';
import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { useBackends } from '../backend';
import { DESKTOP_DOWNLOAD_URL, fetchLatestDesktopInstaller } from '../desktop-teaser/update-feed';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { dismissSuggestionByKey, pushSuggestion } from './store';

const SUGGESTION_KEY = 'get-desktop-app';
const DONE_FLAG = 'oh.desktopAppNudgeDone';

function isDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_FLAG) === '1';
  } catch {
    return false;
  }
}

function rememberDone(): void {
  try {
    window.localStorage.setItem(DONE_FLAG, '1');
  } catch {
    // Storage unavailable — the nudge reappears next session.
  }
}

function openExternal(url: string): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

// Locale the current card was pushed under — same reissue guard as the
// seed nudges, so re-mounts within a session don't churn the card.
let pushedLocale: string | null = null;

/** Test hook — reset the pushed-locale guard between cases. */
export function __resetDesktopAppSuggestionForTests(): void {
  pushedLocale = null;
}

export function useDesktopAppSuggestion(): void {
  const { locale, t } = useLocale();
  // Copy is captured at push time — wait for the settings store so the
  // card can't bake the default locale in before `general.language`
  // hydrates (dedupe would drop the re-push).
  const ready = useSettingsReady();
  const backends = useBackends();
  const { snapshot: syncSlots, isReady: syncReady } = useBackendSyncStatus();

  const companion = getCapability('companionReveal') !== undefined;
  const loopback = backends.find((b) => isLoopbackBackendUrl(b.url));
  const connected = loopback !== undefined && loopback.enabled && syncSlots[loopback.id]?.state === 'green';

  useEffect(() => {
    if (!companion || isDone()) return undefined;
    if (connected) {
      // The desktop app is running right here — the pitch is moot, for
      // good. Also catches a connection landing while the card shows.
      rememberDone();
      dismissSuggestionByKey(SUGGESTION_KEY);
      return undefined;
    }
    // Decide from settled state only: pushing before the sync snapshot
    // hydrates would flash the card at an already-connected user.
    if (!ready || !syncReady) return undefined;
    if (pushedLocale !== null && pushedLocale !== locale) {
      dismissSuggestionByKey(SUGGESTION_KEY);
    }
    let alive = true;
    const probe = getCapability('nmHostPresence');
    void (probe ? probe() : Promise.resolve(null)).then((verdict) => {
      if (!alive || isDone()) return;
      if (verdict?.present) {
        // Installed on this machine (running or not) — they have the
        // app already; a download pitch would only condescend.
        rememberDone();
        return;
      }
      pushedLocale = locale;
      const retire = (): void => {
        rememberDone();
        dismissSuggestionByKey(SUGGESTION_KEY);
      };
      pushSuggestion({
        severity: 'info',
        title: t('shared.notifications.desktopApp.title'),
        // Row icons mirror the features' own registry glyphs (tool
        // windows / settings categories), in neutral text-secondary.
        description: (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CodeOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
              {t('shared.notifications.desktopApp.rowTerminal')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BranchesOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
              {t('shared.notifications.desktopApp.rowGit')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FundViewOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
              {t('shared.notifications.desktopApp.rowProxy')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RobotOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
              {t('shared.notifications.desktopApp.rowMcp')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ApiRequestsIcon style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
              {t('shared.notifications.desktopApp.rowRequests')}
            </span>
          </span>
        ),
        dedupeKey: SUGGESTION_KEY,
        // Sticky like the seed nudges: no mute menu, immune to Clear
        // all — the download action and the connect/install signals are
        // the only ways it retires.
        sticky: true,
        actions: [
          {
            label: t('shared.notifications.desktopApp.action'),
            tooltip: t('shared.notifications.desktopApp.tooltip'),
            variant: 'link',
            run: () => {
              retire();
              void fetchLatestDesktopInstaller().then((installer) => {
                openExternal(installer?.url ?? DESKTOP_DOWNLOAD_URL);
              });
            },
          },
        ],
      });
    });
    return () => {
      alive = false;
    };
  }, [companion, connected, ready, syncReady, locale, t]);
}
