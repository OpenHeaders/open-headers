/**
 * `useTabOverrides` — state + lifecycle for the panel's system-override
 * controls (CDP Control Plane, Phase F3). Surfaces the full override bag — the
 * UA triple (F3a) plus the `Emulation.*` facets locale / timezone / media (F3b).
 *
 * Like the throttle dropdown and unlike the cache toggle there is NO fallback,
 * so an override is operable only while the inspected tab is CDP-controlled
 * (`cdpOwned`). The service worker is authoritative: it stores the per-tab
 * overrides, persists them across panel close / SW eviction, and replays them on
 * every re-attach. This hook READS the SW's stored overrides on mount (so the
 * control shows the truth) and WRITES the whole bag through on change — it does
 * not clear on unmount, because overrides are meant to survive a panel close.
 *
 * The Overrides panel edits every facet in one draft and applies the whole bag,
 * so the hook exposes a single `setOverrides(next)` write rather than per-facet
 * setters: the draft (seeded from the current bag on open) is what prevents one
 * facet's edit from clobbering another. `setOverrides` normalizes through
 * {@link readTabSystemOverrides} so the optimistic state matches what the SW
 * will store (empty facets dropped, an all-empty bag collapsed to `null`).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import { readTabSystemOverrides, type TabSystemOverrides } from '@openheaders/core/types';
import { useCallback, useEffect, useState } from 'react';
import { useInspectedTabCdp } from './use-inspected-tab-cdp';

export interface UseTabOverridesResult {
  /** The active override bag, or `null` when the tab uses its real system. */
  overrides: TabSystemOverrides | null;
  /** Replace the whole override bag (or `null` to clear all). Writes through to the SW. */
  setOverrides: (next: TabSystemOverrides | null) => void;
  /** The inspected tab is CDP-controlled — overrides are operable (no fallback). */
  cdpOwned: boolean;
  /** Whether the Debug-mode master switch is on (for the dormant tooltip copy). */
  cdpEnabled: boolean;
  /** Whether the host supports CDP inspection (hides debug affordances when not). */
  hasCdpCapability: boolean;
}

export function useTabOverrides(): UseTabOverridesResult {
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [overrides, setOverridesState] = useState<TabSystemOverrides | null>(null);

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

  const setOverrides = useCallback((next: TabSystemOverrides | null) => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    // Collapse empties exactly as the SW will, so the optimistic state is the truth.
    const normalized = readTabSystemOverrides(next);
    setOverridesState(normalized);
    void hostBridge.call('setTabOverrides', { tabId, overrides: normalized }).catch(() => {});
  }, []);

  return {
    overrides,
    setOverrides,
    cdpOwned,
    cdpEnabled,
    hasCdpCapability,
  };
}
