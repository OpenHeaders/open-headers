/**
 * useSeedNotifications — baseline entries every surface starts its
 * notifications timeline with: the Help-Us-Grow nudge (star the repo),
 * the Bug-Report-or-Feature-Request nudge (the Report Issue dialog)
 * and the Community-Chat nudge, split so no card gets heavy.
 * Description icons are neutral outlined glyphs, matching the
 * suggestion cards. A fourth card rides on top when the previous
 * document of this window died on the root fallback: the pending
 * crash, with Report Issue (the dialog seeded with that crash) and the
 * chat — so Reload on the crash page costs the person nothing.
 *
 * All are sticky: no dismiss affordance, immune to Clear all. Each
 * retires itself when its action is followed (the nudges permanently,
 * persisted per nudge; the crash card for the session), and dedupe
 * keys keep re-mounts within a session from stacking them.
 *
 * Standing nudges, not historical records: unlike event entries they
 * follow a live locale switch — the producer retires the cards and
 * reissues them under the new locale (push-time capture stays the
 * store's law; this is the sanctioned dismiss-and-reissue path).
 */

import { BugOutlined, ExclamationCircleOutlined, LikeOutlined, MessageOutlined } from '@ant-design/icons';
import { COMMUNITY_CHAT_URL, type IssueKind } from '@openheaders/core/diagnostics';
import { useEffect } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { openReportIssueDialog } from '@openheaders/ui/workbench/support/store';
import { type PendingCrash, takePendingCrash } from '../error-funnel';
import { openExternalLink } from '../open-external';
import { dismissByKey, pushNotification } from './store';

const GITHUB_URL = 'https://github.com/OpenHeaders/open-headers';

const ICON_STYLE = { fontSize: 13, color: 'var(--ant-color-text-secondary)' };

function isDone(flag: string): boolean {
  try {
    return window.localStorage.getItem(flag) === '1';
  } catch {
    return false;
  }
}

function rememberDone(flag: string): void {
  try {
    window.localStorage.setItem(flag, '1');
  } catch {
    // Storage unavailable — the nudge reappears next session.
  }
}

// Locale the current cards were pushed under. Guards the retire-and-
// reissue below so re-mounts within a session leave timestamps alone —
// only an actual locale change reissues.
let pushedLocale: string | null = null;

// The crash taken from session storage, held for the rest of the
// session so a locale reissue or a re-mount can push its card again.
let pendingCrash: PendingCrash | null = null;

/** Test hook — reset the pushed-locale guard and the held crash between cases. */
export function __resetSeedNotificationsForTests(): void {
  pushedLocale = null;
  pendingCrash = null;
}

export function useSeedNotifications(): void {
  const { locale, t } = useLocale();
  // Entries capture copy at push time, so the first push must wait for
  // the settings store — pushing before `general.language` hydrates
  // would bake the default locale in and dedupe drops the re-push.
  const ready = useSettingsReady();
  useEffect(() => {
    if (!ready) return;
    if (pushedLocale !== null && pushedLocale !== locale) {
      dismissByKey('community-chat');
      dismissByKey('report-issue');
      dismissByKey('help-us-grow');
      dismissByKey('pending-crash');
    }
    pushedLocale = locale;
    // Pushed bottom-up so Help Us Grow lands on top of the timeline.
    if (!isDone('oh.communityChatVisited')) {
      pushNotification({
        severity: 'info',
        title: t('shared.notifications.seed.community.title'),
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageOutlined style={ICON_STYLE} />
            {t('shared.notifications.seed.community.description')}
          </span>
        ),
        dedupeKey: 'community-chat',
        sticky: true,
        actions: [
          {
            label: t('shared.notifications.seed.community.action'),
            tooltip: t('shared.notifications.seed.community.tooltip'),
            run: () => {
              openExternalLink(COMMUNITY_CHAT_URL);
              rememberDone('oh.communityChatVisited');
              dismissByKey('community-chat');
            },
          },
        ],
      });
    }
    if (!isDone('oh.reportIssueOpened')) {
      // Either action opens the Report Issue dialog on its kind — the
      // dialog mounts on every surface that seeds the timeline.
      const report = (kind: IssueKind): void => {
        openReportIssueDialog(kind);
        rememberDone('oh.reportIssueOpened');
        dismissByKey('report-issue');
      };
      pushNotification({
        severity: 'info',
        title: t('shared.notifications.seed.report.title'),
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BugOutlined style={ICON_STYLE} />
            {t('shared.notifications.seed.report.description')}
          </span>
        ),
        dedupeKey: 'report-issue',
        sticky: true,
        actions: [
          {
            label: t('shared.notifications.seed.report.action.bug'),
            tooltip: t('shared.notifications.seed.report.tooltip.bug'),
            run: () => report('bug'),
          },
          {
            label: t('shared.notifications.seed.report.action.feature'),
            tooltip: t('shared.notifications.seed.report.tooltip.feature'),
            run: () => report('feature'),
          },
        ],
      });
    }
    if (!isDone('oh.helpUsGrowStarred')) {
      pushNotification({
        severity: 'info',
        title: t('shared.notifications.seed.star.title'),
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LikeOutlined style={ICON_STYLE} />
            {t('shared.notifications.seed.star.description')}
          </span>
        ),
        dedupeKey: 'help-us-grow',
        sticky: true,
        actions: [
          {
            label: t('shared.notifications.seed.star.action'),
            tooltip: t('shared.notifications.seed.star.tooltip'),
            run: () => {
              openExternalLink(GITHUB_URL);
              rememberDone('oh.helpUsGrowStarred');
              dismissByKey('help-us-grow');
            },
          },
        ],
      });
    }
    pendingCrash ??= takePendingCrash();
    if (pendingCrash) {
      const crash = pendingCrash;
      const retire = (): void => {
        pendingCrash = null;
        dismissByKey('pending-crash');
      };
      pushNotification({
        severity: 'warning',
        title: t('shared.notifications.crash.title'),
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ExclamationCircleOutlined style={ICON_STYLE} />
            {t('shared.notifications.crash.description')}
          </span>
        ),
        dedupeKey: 'pending-crash',
        sticky: true,
        actions: [
          {
            label: t('shared.errorBoundary.reportIssue'),
            tooltip: t('shared.notifications.crash.tooltip.report'),
            run: () => {
              openReportIssueDialog('bug', { title: crash.headline, description: crash.details });
              retire();
            },
          },
          {
            label: t('shared.errorBoundary.communityChat'),
            tooltip: t('shared.notifications.crash.tooltip.chat'),
            run: () => {
              openExternalLink(COMMUNITY_CHAT_URL);
              retire();
            },
          },
        ],
      });
    }
  }, [ready, locale, t]);
}
