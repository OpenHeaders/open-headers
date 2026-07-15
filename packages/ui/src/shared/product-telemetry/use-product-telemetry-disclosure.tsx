/**
 * First-run product-telemetry disclosure (`TELEMETRY_PLAN.md` §2/§8),
 * delivered as a sticky Notifications-panel card — the blocking-modal
 * form was live-tested and rejected for onboarding UX.
 *
 * Mounts beside `useSeedNotifications` on every primary surface (popup,
 * side panel, devtools panel, workbench). Disclosure means the copy was
 * on screen: closing the Notifications panel marks the card seen, which
 * sets `oh.productTelemetry.disclosed` — the flag the background client
 * gates queueing/sending on, so disclosure always precedes the first
 * event. The card itself stays (sticky, re-pushed each session) until
 * its action is clicked: the click deep-links to the Anonymous usage
 * counting row in Settings → General (scroll + flash via the settings
 * deep-link) and retires the card for good.
 *
 * The card body is the user-signed §8 copy, shipped verbatim, with the
 * lead-in sentence as the card title.
 *
 * Extension and desktop only; a workbench served by a daemon never
 * counts anything and never discloses.
 */

import { hostStorage, OH } from '@openheaders/core/storage';
import { dismissByKey, pushNotification, useNotifications } from '@openheaders/ui/shared/notifications';
import { Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { getCurrentHost } from '../host-vocabulary';

const { Link } = Typography;

export const PRODUCT_TELEMETRY_DISCLOSURE_KEY = 'product-telemetry-disclosure';

// Set when the card's action is followed — the card re-pushes every
// session until then, same convention as the seed nudges' done flags.
const REVIEWED_FLAG = 'oh.productTelemetryReviewed';

function isReviewed(): boolean {
  try {
    return window.localStorage.getItem(REVIEWED_FLAG) === '1';
  } catch {
    return false;
  }
}

function rememberReviewed(): void {
  try {
    window.localStorage.setItem(REVIEWED_FLAG, '1');
  } catch {
    // Storage unavailable — the card reappears next session.
  }
}

/**
 * Push the disclosure card and watch for it being seen. The caller
 * supplies the surface-appropriate way to land on the
 * `telemetry.enabled` setting row (SW navigator intent from system
 * surfaces, the local settings opener from the workbench).
 */
export function useProductTelemetryDisclosureNotification(openTelemetrySetting: () => void): void {
  const entries = useNotifications();
  // Latest opener behind a ref so the action closure pushed at mount
  // never goes stale across re-renders.
  const openSettingRef = useRef(openTelemetrySetting);
  openSettingRef.current = openTelemetrySetting;
  const [watchSeen, setWatchSeen] = useState(false);

  useEffect(() => {
    const host = getCurrentHost();
    if (host !== 'extension' && host !== 'desktop') return;
    if (isReviewed()) return;
    let cancelled = false;
    void hostStorage.get(OH.productTelemetryDisclosed).then((disclosed) => {
      if (cancelled) return;
      // Already-disclosed sessions keep the card purely as the pointer
      // to the setting — no seen-watch needed.
      if (disclosed !== true) setWatchSeen(true);
      pushNotification({
        severity: 'info',
        title: 'Anonymous usage counting',
        description: (
          <span data-testid="product-telemetry-notice">
            Open Headers counts which features get used — nothing more. No URLs, no headers, no request or response
            data, no account identity, no persistent device id. You can see every event it sends, byte for byte, in
            Settings → General → View telemetry events, and turn it off there with one switch.{' '}
            <Link href="https://openheaders.io/privacy" target="_blank" rel="noopener">
              Privacy policy
            </Link>
          </span>
        ),
        dedupeKey: PRODUCT_TELEMETRY_DISCLOSURE_KEY,
        sticky: true,
        actions: [
          {
            label: 'Review setting',
            tooltip: 'Open the setting and clear notification',
            run: () => {
              // A click proves the card was on screen even if the panel
              // never closed, so it counts as disclosure too.
              void hostStorage.set(OH.productTelemetryDisclosed, true);
              rememberReviewed();
              openSettingRef.current();
              dismissByKey(PRODUCT_TELEMETRY_DISCLOSURE_KEY);
            },
          },
        ],
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!watchSeen) return;
    const entry = entries.find((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY);
    if (!entry?.seen) return;
    setWatchSeen(false);
    void hostStorage.set(OH.productTelemetryDisclosed, true);
  }, [watchSeen, entries]);
}
