/**
 * `useNetworkConditions` — state + lifecycle for the panel's network-throttle
 * dropdown (CDP Control Plane, Phase F2).
 *
 * Unlike the cache toggle there is NO DNR fallback, so a throttle profile is
 * operable only while the inspected tab is CDP-controlled (`available`). The
 * service worker is authoritative: it stores the per-tab profile, persists it
 * across panel close / SW eviction, and replays it on every re-attach. This
 * hook therefore READS the SW's stored profile on mount (so the dropdown shows
 * the truth) and WRITES through on change — it does not clear on unmount the way
 * `useCacheBypass` does, because the profile is meant to survive a panel close.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import type { NetworkThrottleConditions } from '@openheaders/core/types';
import { useCallback, useEffect, useState } from 'react';
import { matchProfileKey, type ThrottleProfileKey } from './network-throttle-presets';
import { useInspectedTabCdp } from './use-inspected-tab-cdp';

export interface UseNetworkConditionsResult {
  conditions: NetworkThrottleConditions | null;
  profileKey: ThrottleProfileKey;
  /** Apply a profile, or `null` to lift throttling. Writes through to the SW. */
  setConditions: (conditions: NetworkThrottleConditions | null) => void;
  /** The inspected tab is CDP-controlled — throttle is operable (no DNR
   *  fallback), and the cache toggle is on its whole-tab CDP path. */
  cdpOwned: boolean;
  /** Whether the Debug-mode master switch is on (for the dormant tooltip copy). */
  cdpEnabled: boolean;
  /** Whether the host supports CDP inspection (hides debug affordances when not). */
  hasCdpCapability: boolean;
}

export function useNetworkConditions(): UseNetworkConditionsResult {
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [conditions, setConditionsState] = useState<NetworkThrottleConditions | null>(null);

  // Read the SW's stored profile once on mount — it is authoritative and
  // outlives this panel, so the dropdown must reflect it rather than reset.
  useEffect(() => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    let cancelled = false;
    void hostBridge
      .call('getNetworkConditions', { tabId })
      .then((res) => {
        if (!cancelled) setConditionsState(res?.conditions ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setConditions = useCallback((next: NetworkThrottleConditions | null) => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    setConditionsState(next); // optimistic — the SW echo is identical
    void hostBridge.call('setNetworkConditions', { tabId, conditions: next }).catch(() => {});
  }, []);

  return {
    conditions,
    profileKey: matchProfileKey(conditions),
    setConditions,
    cdpOwned,
    cdpEnabled,
    hasCdpCapability,
  };
}
