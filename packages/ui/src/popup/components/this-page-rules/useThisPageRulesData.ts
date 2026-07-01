import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import type { TabTelemetrySnapshot as TelemetrySnapshot } from '@openheaders/core/types';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { EMPTY_SNAPSHOT } from './format';
import type { ActiveRule, CurrentTabInfo } from './types';

export interface ThisPageRulesData {
  currentTab: CurrentTabInfo | null;
  activeRules: ActiveRule[];
  setActiveRules: Dispatch<SetStateAction<ActiveRule[]>>;
  loading: boolean;
  snapshot: TelemetrySnapshot;
}

/**
 * Owns the This Page view's data plane: the active tab, its applicable
 * rules, and the live telemetry snapshot. Input-free — it reads the host
 * navigation / bridge seams directly and is the popup's pure reader (the
 * background auto-tracks the active tab in every window). `setActiveRules`
 * is exposed so optimistic row mutations can patch the list before the
 * next `getActiveRulesForTab` round-trip.
 */
export function useThisPageRulesData(): ThisPageRulesData {
  const [currentTab, setCurrentTab] = useState<CurrentTabInfo | null>(null);
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Full telemetry snapshot for the active tab, polled every 500ms from the
   * background tab-telemetry service. Single source of truth for per-rule
   * fire counts, unique URL records, and the page-wide unique request total.
   * The popup joins this with the applicable-rules list at render time.
   */
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    const fetchActiveRules = async () => {
      try {
        const tab = await hostNavigation.getActiveTab();
        if (tab) {
          // `tab.url` may be missing (loading), empty (untyped new tab),
          // or non-WHATWG-parseable on some browser-internal pages. The
          // popup never noticed because it closes on blur; the sidepanel
          // stays open across navigations and would log a TypeError every
          // time. Downstream code already handles missing/internal URLs
          // (see the chrome:/about: regex below), so leave `domain` empty
          // when the URL won't parse.
          let domain = '';
          if (tab.url) {
            try {
              domain = new URL(tab.url).hostname;
            } catch {
              /* internal scheme or unparseable — render with empty domain */
            }
          }
          const response = await hostBridge
            .call('getActiveRulesForTab', { tabId: tab.id, tabUrl: tab.url })
            .catch(() => ({
              activeRules: [] as ActiveRule[],
            }));
          setCurrentTab({ id: tab.id, url: tab.url ?? '', domain, title: tab.title || '' });
          setActiveRules(response.activeRules || []);
        }
      } catch (error) {
        console.error(new Date().toISOString(), 'ERROR', '[ThisPageRules]', 'Error getting active rules:', error);
        setActiveRules([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchActiveRules();

    // Re-query when the active tab navigates / switches or stored rule
    // state changes (host seam), and when the request monitor pushes new
    // tracked URLs from the background.
    const unobserveTabContext = hostNavigation.observeActiveTabContext(() => {
      void fetchActiveRules();
    });
    const unsubscribeTracked = hostBridge.subscribe('trackedUrlsUpdated', () => {
      void fetchActiveRules();
    });

    return () => {
      unobserveTabContext();
      unsubscribeTracked();
    };
  }, []);

  /**
   * Live tab-telemetry: polls `getTabTelemetry` every 500ms while this
   * component is mounted. The background auto-tracks the active tab in
   * every window (see tab-listeners.initializeActiveTabTracking), so the
   * popup is a pure reader — no tracking activation needed. This matters
   * because Chrome popups close on blur, making any popup-scoped tracking
   * window useless: fires happen during page load, *before* the popup opens.
   */
  useEffect(() => {
    if (!currentTab?.id) return;
    const tabId = currentTab.id;

    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      hostBridge
        .call('getTabTelemetry', { tabId })
        .then((snap) => {
          if (cancelled) return;
          setSnapshot({
            counters: snap?.counters ?? {},
            fires: snap?.fires ?? [],
            byRule: snap?.byRule ?? {},
            uniqueRequestCount: snap?.uniqueRequestCount ?? 0,
          });
        })
        .catch(() => {
          /* SW momentarily unavailable — next tick will retry */
        });
    };
    poll();
    const interval = setInterval(poll, 500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentTab?.id]);

  return { currentTab, activeRules, setActiveRules, loading, snapshot };
}
