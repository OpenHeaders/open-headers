/**
 * `useTabOverrides` — state + lifecycle for the panel's environment-override
 * controls (CDP Control Plane, Phase F3). F3a surfaces the User-Agent facet;
 * the `Emulation.*` facets (locale / timezone / media) join in F3b.
 *
 * Like the throttle dropdown and unlike the cache toggle there is NO fallback,
 * so an override is operable only while the inspected tab is CDP-controlled
 * (`cdpOwned`). The service worker is authoritative: it stores the per-tab
 * overrides, persists them across panel close / SW eviction, and replays them on
 * every re-attach. This hook READS the SW's stored overrides on mount (so the
 * control shows the truth) and WRITES through on change — it does not clear on
 * unmount, because overrides are meant to survive a panel close.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import type { TabEnvironmentOverrides } from '@openheaders/core/types';
import { useCallback, useEffect, useState } from 'react';
import { useInspectedTabCdp } from './use-inspected-tab-cdp';

export interface UseTabOverridesResult {
  overrides: TabEnvironmentOverrides | null;
  /** The active User-Agent override, or `null` when the tab uses its real UA. */
  userAgent: string | null;
  /** Pin a User-Agent string, or `null` to restore the real UA. Writes through to the SW. */
  setUserAgent: (userAgent: string | null) => void;
  /** The inspected tab is CDP-controlled — overrides are operable (no fallback). */
  cdpOwned: boolean;
  /** Whether the Debug-mode master switch is on (for the dormant tooltip copy). */
  cdpEnabled: boolean;
  /** Whether the host supports CDP inspection (hides debug affordances when not). */
  hasCdpCapability: boolean;
}

export function useTabOverrides(): UseTabOverridesResult {
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [overrides, setOverridesState] = useState<TabEnvironmentOverrides | null>(null);

  // Read the SW's stored overrides once on mount — they are authoritative and
  // outlive this panel, so the control must reflect them rather than reset.
  useEffect(() => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    let cancelled = false;
    void hostBridge
      .call('getTabOverrides', { tabId })
      .then((res) => {
        if (!cancelled) setOverridesState(res?.overrides ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // F3a manages only the UA facet, so a UA write fully describes the bag: a
  // string pins it, `null` clears it. (F3b's fuller panel will merge facets.)
  const setUserAgent = useCallback((userAgent: string | null) => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    const next = userAgent ? { userAgent } : null;
    setOverridesState(next); // optimistic — the SW echo is identical
    void hostBridge.call('setTabOverrides', { tabId, overrides: next }).catch(() => {});
  }, []);

  return {
    overrides,
    userAgent: overrides?.userAgent ?? null,
    setUserAgent,
    cdpOwned,
    cdpEnabled,
    hasCdpCapability,
  };
}
