/**
 * useSeedNotifications — baseline entries every surface starts its
 * notifications timeline with. Currently one: the Help-Us-Grow nudge
 * (same copy as the onboarding tour's final step). Deduped by key so
 * re-mounts within a session never stack it.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { pushNotification } from './store';

const GITHUB_URL = 'https://github.com/OpenHeaders/open-headers-app';

export function useSeedNotifications(): void {
  useEffect(() => {
    pushNotification({
      severity: 'info',
      title: 'Help Us Grow',
      description: 'Help us grow and reach more developers — recommend us to your friends & colleagues.',
      dedupeKey: 'help-us-grow',
      actions: [
        {
          label: 'Give us a star on GitHub',
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
