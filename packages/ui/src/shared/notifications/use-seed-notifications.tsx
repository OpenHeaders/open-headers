/**
 * useSeedNotifications — baseline entries every surface starts its
 * notifications timeline with: the Help-Us-Grow nudge (star the repo)
 * and the Visit-Our-Website nudge, split so neither card gets heavy.
 * Copy and icons mirror the onboarding tour's final step.
 *
 * Both are sticky: no dismiss affordance, immune to Clear all. Each
 * retires itself permanently when its link is followed (persisted per
 * nudge), and dedupe keys keep re-mounts within a session from
 * stacking them.
 */

import { LikeTwoTone, SmileTwoTone } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { dismissByKey, pushNotification } from './store';

const GITHUB_URL = 'https://github.com/OpenHeaders/open-headers-releases';
const WEBSITE_URL = 'https://openheaders.io';

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

export function useSeedNotifications(): void {
  useEffect(() => {
    // Pushed first so Help Us Grow lands on top of the timeline.
    if (!isDone('oh.websiteVisited')) {
      pushNotification({
        severity: 'info',
        title: 'Discover Open Headers',
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SmileTwoTone style={{ fontSize: 13 }} />
            See all our features interactively, plus the latest updates.
          </span>
        ),
        dedupeKey: 'visit-website',
        sticky: true,
        actions: [
          {
            label: 'Visit our website',
            tooltip: 'Open website and clear notification',
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
        title: 'Help Us Grow',
        description: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LikeTwoTone style={{ fontSize: 13 }} />
            Recommend us to your friends &amp; colleagues
          </span>
        ),
        dedupeKey: 'help-us-grow',
        sticky: true,
        actions: [
          {
            label: 'Give us a star on GitHub',
            tooltip: 'Open github and clear notification',
            run: () => {
              openExternal(GITHUB_URL);
              rememberDone('oh.helpUsGrowStarred');
              dismissByKey('help-us-grow');
            },
          },
        ],
      });
    }
  }, []);
}
