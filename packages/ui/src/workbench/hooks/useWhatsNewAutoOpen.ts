/**
 * useWhatsNewAutoOpen — the What's New tab's trigger
 * (`docs/UPDATES_PLAN.md`; design settled in `UPDATES_STATUS.md` S2).
 *
 * Fires on the first WORKBENCH OPEN after the app version changed —
 * not on app start: the desktop relaunches into the tray after an
 * update, so app-start would announce to an empty room. A stored
 * `lastSeenVersion` latch makes each bump announce once.
 *
 * Cadence gate: only year/month CalVer bumps auto-open the tab; patch
 * releases keep the notification-only path (a tab per patch would
 * train users to close it unread). The latch advances on every bump
 * regardless, so flipping the setting on later never dredges up an
 * old release, and a fresh install (no prior version) stays quiet.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useEffect } from 'react';
import { getBuildInfo } from '../../shared/build-info';
import { useSettingsReady, useSettingValue } from '../settings/hooks';

const LAST_SEEN_VERSION_KEY = 'oh.whatsNewLastSeenVersion';

/** True when the year or month CalVer segment moved (beta suffix ignored). */
export function isFeatureBump(previous: string, current: string): boolean {
  const segments = (v: string) =>
    v
      .replace(/-beta\.\d+$/, '')
      .split('.')
      .map(Number);
  const [prev, next] = [segments(previous), segments(current)];
  return prev[0] !== next[0] || prev[1] !== next[1];
}

export function useWhatsNewAutoOpen(openWhatsNew: () => void): void {
  // Settings hydrate async — deciding before readiness would read the
  // default and could auto-open against a persisted opt-out.
  const ready = useSettingsReady();
  const show = useSettingValue('updates.showWhatsNew');

  useEffect(() => {
    if (!ready) return;
    // Hosts without bundled notes (extension surfaces, a build with an
    // empty notes file) never latch and never open.
    if (!getCapability('getWhatsNew')?.()) return;
    const current = getBuildInfo().version;
    if (current === '0.0.0') return;
    let previous: string | null;
    try {
      previous = window.localStorage.getItem(LAST_SEEN_VERSION_KEY);
      window.localStorage.setItem(LAST_SEEN_VERSION_KEY, current);
    } catch {
      return;
    }
    if (previous === null || previous === current) return;
    if (!show || !isFeatureBump(previous, current)) return;
    openWhatsNew();
  }, [ready, show, openWhatsNew]);
}
