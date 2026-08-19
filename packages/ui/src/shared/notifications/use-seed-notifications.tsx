/**
 * useSeedNotifications — baseline entries every surface starts its
 * notifications timeline with: the Help-Us-Grow nudge (star the repo)
 * and the Visit-Our-Website nudge, split so neither card gets heavy.
 * Copy mirrors the onboarding tour's final step; description icons are
 * neutral outlined glyphs, matching the suggestion cards.
 *
 * Both are sticky: no dismiss affordance, immune to Clear all. Each
 * retires itself permanently when its link is followed (persisted per
 * nudge), and dedupe keys keep re-mounts within a session from
 * stacking them.
 *
 * Standing nudges, not historical records: unlike event entries they
 * follow a live locale switch — the producer retires both cards and
 * reissues them under the new locale (push-time capture stays the
 * store's law; this is the sanctioned dismiss-and-reissue path).
 */

import { LikeOutlined, SmileOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { dismissByKey, pushNotification } from './store';

const GITHUB_URL = 'https://github.com/OpenHeaders/open-headers';
const WEBSITE_URL = 'https://openheaders.com';

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

function openExternal(url: string): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

// Locale the current cards were pushed under. Guards the retire-and-
// reissue below so re-mounts within a session leave timestamps alone —
// only an actual locale change reissues.
let pushedLocale: string | null = null;

/** Test hook — reset the pushed-locale guard between cases. */
export function __resetSeedNotificationsForTests(): void {
  pushedLocale = null;
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
      dismissByKey('visit-website');
      dismissByKey('help-us-grow');
    }
    pushedLocale = locale;
    // Pushed first so Help Us Grow lands on top of the timeline.
    if (!isDone('oh.websiteVisited')) {
      pushNotification({
        severity: 'info',
        title: t('shared.notifications.seed.website.title'),
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SmileOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
            {t('shared.notifications.seed.website.description')}
          </span>
        ),
        dedupeKey: 'visit-website',
        sticky: true,
        actions: [
          {
            label: t('shared.notifications.seed.website.action'),
            tooltip: t('shared.notifications.seed.website.tooltip'),
            run: () => {
              openExternal(WEBSITE_URL);
              rememberDone('oh.websiteVisited');
              dismissByKey('visit-website');
            },
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
            <LikeOutlined style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }} />
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
              openExternal(GITHUB_URL);
              rememberDone('oh.helpUsGrowStarred');
              dismissByKey('help-us-grow');
            },
          },
        ],
      });
    }
  }, [ready, locale, t]);
}
