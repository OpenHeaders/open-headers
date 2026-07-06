/**
 * useSeedNotifications — baseline entries every surface starts its
 * notifications timeline with. Currently one: the Help-Us-Grow nudge
 * (same copy and icons as the onboarding tour's final step). Deduped
 * by key so re-mounts within a session never stack it.
 */

import { LikeTwoTone, SmileTwoTone, StarTwoTone } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { pushNotification } from './store';

const GITHUB_URL = 'https://github.com/OpenHeaders/open-headers-app';

export function useSeedNotifications(): void {
  useEffect(() => {
    pushNotification({
      severity: 'info',
      title: 'Help Us Grow',
      description: (
        <>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SmileTwoTone style={{ fontSize: 13 }} />
            Help us grow and reach more developers.
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <LikeTwoTone style={{ fontSize: 13 }} />
            Recommend us to your friends &amp; colleagues
          </span>
        </>
      ),
      dedupeKey: 'help-us-grow',
      actions: [
        {
          label: 'Give us a star on GitHub',
          icon: <StarTwoTone style={{ fontSize: 13 }} />,
          run: () => {
            const openUrl = getCapability('openExternalUrl');
            if (openUrl) void openUrl(GITHUB_URL);
            else window.open(GITHUB_URL, '_blank', 'noopener');
          },
        },
      ],
    });
  }, []);
}
