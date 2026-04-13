/**
 * Tab Listeners - Handles all tab-related events
 */

import { runtime, tabs, webNavigation, windows } from '@utils/browser-api.js';
import { logger } from '@utils/logger';
import type { IRecordingService } from '@/types/recording';
import { checkIfUrlMatchesAnyRule, tabsWithActiveRules } from './request-tracker';
import {
  clearTab as tabTelemetryClearTab,
  onPageCommit as tabTelemetryOnPageCommit,
  startTracking as tabTelemetryStartTracking,
  stopTracking as tabTelemetryStopTracking,
} from './tab-telemetry';
import {
  onTabCommit as testRunnerOnTabCommit,
  onTabError as testRunnerOnTabError,
  onTabLoaded as testRunnerOnTabLoaded,
  onTabRemoved as testRunnerOnTabRemoved,
} from './test-runner';
import { isTrackableUrl, normalizeUrlForTracking } from './url-utils';

/**
 * Active-tab telemetry tracking.
 *
 * The tab-telemetry module's "only track tabs someone is watching" gate is
 * fundamentally incompatible with MV3 extension popups: Chrome closes the
 * popup on blur, so any popup-driven tracking window opens *after* the fires
 * have already happened. To make fire counts observable at all, the background
 * itself holds a tracking reason on whichever tab is currently active in each
 * window — for free, with no consumer required.
 *
 * `activeTabByWindow` is the background's bookkeeping so it can release the
 * previous tab's reason on `tabs.onActivated`. Test sessions stack their own
 * reason via `startTracking(tabId, 'test:<id>')`, so this coexists cleanly.
 */
const ACTIVE_TAB_REASON = 'active-tab';
const activeTabByWindow: Map<number, number> = new Map();

function setActiveTabForWindow(tabId: number, windowId: number): void {
  const prev = activeTabByWindow.get(windowId);
  if (prev === tabId) return;
  if (prev != null) tabTelemetryStopTracking(prev, ACTIVE_TAB_REASON);
  activeTabByWindow.set(windowId, tabId);
  tabTelemetryStartTracking(tabId, ACTIVE_TAB_REASON);
  logger.debug('TabListeners', `Active-tab telemetry: window ${windowId} -> tab ${tabId}`);
}

function releaseIfActive(tabId: number): void {
  for (const [windowId, activeTabId] of activeTabByWindow) {
    if (activeTabId === tabId) {
      activeTabByWindow.delete(windowId);
      break;
    }
  }
}

/**
 * Last main-frame URL observed per tab — used to distinguish "real" SPA
 * navigations (pushState that changes the URL) from framework router-init
 * churn (multiple pushStates firing within milliseconds of page load, all
 * landing on effectively the same URL). Only the former should reset the
 * fire counter; the latter would erase legitimate fires that happened in
 * the narrow window between onCommitted and the init burst.
 *
 * Cleared on tab close. Updated on onCommitted (authoritative main-frame
 * URL) and on every main-frame onHistoryStateUpdated after comparison.
 */
const lastMainFrameUrlByTab: Map<number, string> = new Map();

/**
 * Startup scan: mark the currently-active tab in every window as tracked.
 * Called once from `initializeExtension()`. Safe to re-invoke — stacking
 * the same (tabId, reason) is a no-op.
 */
export function initializeActiveTabTracking(): void {
  tabs.query({ active: true }, (tabList: chrome.tabs.Tab[]) => {
    for (const tab of tabList) {
      if (typeof tab.id === 'number' && typeof tab.windowId === 'number') {
        setActiveTabForWindow(tab.id, tab.windowId);
      }
    }
  });
}

/**
 * Set up all tab-related listeners
 */
export function setupTabListeners(updateBadgeCallback: () => void, recordingService: IRecordingService): void {
  // Listen for tab updates and activations
  tabs.onActivated?.addListener((activeInfo: { tabId: number; windowId: number }) => {
    // Hand telemetry tracking to the newly-active tab in this window.
    setActiveTabForWindow(activeInfo.tabId, activeInfo.windowId);

    // Update badge when user switches tabs
    setTimeout(() => {
      updateBadgeCallback();
    }, 100);
  });

  tabs.onUpdated?.addListener((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
    // Handle various state changes that might indicate navigation
    if (changeInfo.url || changeInfo.status === 'loading') {
      // For URL changes without full page load (History API)
      if (changeInfo.url && !changeInfo.status) {
        logger.info('TabListeners', `Detected potential SPA navigation in tab ${tabId}`);

        // Check if this is a significant navigation (different origin or path)
        if (tabsWithActiveRules.has(tabId)) {
          const trackedUrls = tabsWithActiveRules.get(tabId)!;
          const normalizedNewUrl = normalizeUrlForTracking(changeInfo.url);

          // Parse URLs to check if it's a significant navigation
          try {
            const newUrl = new URL(normalizedNewUrl);
            let significantChange = true;

            // Check if any tracked URL is from the same origin and path
            for (const trackedUrl of trackedUrls.keys()) {
              try {
                const oldUrl = new URL(trackedUrl);
                // If same origin and same pathname, it's not a significant change
                if (oldUrl.origin === newUrl.origin && oldUrl.pathname === newUrl.pathname) {
                  significantChange = false;
                  break;
                }
              } catch (_e) {
                // Invalid URL in tracking
              }
            }

            if (significantChange) {
              logger.info(
                'TabListeners',
                `Significant SPA navigation detected, clearing tracked requests for tab ${tabId}`,
              );
              tabsWithActiveRules.delete(tabId);
            }
          } catch (_e) {
            // If URL parsing fails, clear to be safe
            tabsWithActiveRules.delete(tabId);
          }
        }
      }

      // Clear tracking when URL changes (main navigation)
      if (changeInfo.url && tabsWithActiveRules.has(tabId)) {
        const trackedUrls = tabsWithActiveRules.get(tabId)!;
        if (trackedUrls && trackedUrls.size > 0) {
          // Check if new URL is different origin than tracked URLs
          try {
            const newOrigin = new URL(changeInfo.url).origin;
            let differentOrigin = true;

            for (const trackedUrl of trackedUrls.keys()) {
              try {
                const trackedOrigin = new URL(trackedUrl).origin;
                if (newOrigin === trackedOrigin) {
                  differentOrigin = false;
                  break;
                }
              } catch (_e) {
                // Invalid URL in tracking, ignore
              }
            }

            if (differentOrigin) {
              logger.info('TabListeners', `Tab ${tabId} navigated to different origin, clearing tracked requests`);
              tabsWithActiveRules.delete(tabId);
            }
          } catch (_e) {
            // Invalid URL, clear tracking to be safe
            tabsWithActiveRules.delete(tabId);
          }
        }
      }
    }

    // Update badge when tab URL changes or completes loading
    if ((changeInfo.url || changeInfo.status === 'complete') && tab.active) {
      setTimeout(() => {
        updateBadgeCallback();
      }, 100);
    }

    // Notify the test-runner when a test tab reaches load — starts the capture window.
    if (changeInfo.status === 'complete') {
      testRunnerOnTabLoaded(tabId);
    }
  });

  // Clean up tracking when tabs are closed
  tabs.onRemoved?.addListener((tabId: number) => {
    tabsWithActiveRules.delete(tabId);
    lastMainFrameUrlByTab.delete(tabId);
    releaseIfActive(tabId);
    tabTelemetryClearTab(tabId);
    if (recordingService) {
      recordingService.cleanupTab(tabId);
    }
    // If a test session was watching this tab, finish it so DNR session rules
    // clear and the pending promise resolves instead of waiting for ceiling.
    testRunnerOnTabRemoved(tabId);
    logger.info('TabListeners', `Cleaned up tracking for closed tab ${tabId}`);
  });

  // Clear tracking when tab is replaced (e.g., when navigating to a completely new site)
  tabs.onReplaced?.addListener((addedTabId: number, removedTabId: number) => {
    logger.info('TabListeners', `Tab ${removedTabId} replaced by ${addedTabId}, transferring tracking`);

    // Transfer tracking from old tab to new tab if any exists
    if (tabsWithActiveRules.has(removedTabId)) {
      const trackedUrls = tabsWithActiveRules.get(removedTabId)!;
      tabsWithActiveRules.set(addedTabId, trackedUrls);
      tabsWithActiveRules.delete(removedTabId);

      // Update badge if this is the active tab
      tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
        if (tabsList[0] && tabsList[0].id === addedTabId) {
          updateBadgeCallback();
        }
      });
    }
  });

  // Add handler for when browser starts with existing tabs
  tabs.onCreated?.addListener((tab: chrome.tabs.Tab) => {
    // When a new tab is created, check if it should be tracked
    if (tab.url && tab.id && isTrackableUrl(tab.url)) {
      if (checkIfUrlMatchesAnyRule(tab.url)) {
        if (!tabsWithActiveRules.has(tab.id!)) {
          tabsWithActiveRules.set(tab.id!, new Map());
        }
        tabsWithActiveRules
          .get(tab.id!)!
          .set(normalizeUrlForTracking(tab.url!), { timestamp: Date.now(), resourceType: 'main_frame' });
        logger.info('TabListeners', `New tab ${tab.id} created with URL that matches rules`);

        if (tab.active) {
          updateBadgeCallback();
        }
      }
    }
  });

  // Handle window focus changes
  windows?.onFocusChanged?.addListener((windowId: number) => {
    if (windowId === windows!.WINDOW_ID_NONE) return;

    // When window focus changes, update badge for the active tab in that window
    tabs.query({ active: true, windowId: windowId }, (tabsList: chrome.tabs.Tab[]) => {
      if (tabsList[0]) {
        logger.info('TabListeners', `Window focus changed, updating badge for tab ${tabsList[0].id}`);
        updateBadgeCallback();
      }
    });
  });

  // Handle extension suspend/resume
  runtime.onSuspend?.addListener(() => {
    logger.info('TabListeners', 'Extension suspending, clearing tracked requests');
    tabsWithActiveRules.clear();
  });

  // Add listener for when popup closes to ensure badge is updated
  runtime.onConnect?.addListener((port: chrome.runtime.Port) => {
    if (port.name === 'popup') {
      // Check if this is from an incognito context
      if (
        port.sender?.tab?.incognito ||
        (port.sender as chrome.runtime.MessageSender & { incognito?: boolean })?.incognito
      ) {
        logger.info('TabListeners', 'Popup opened in incognito mode');
      }

      port.onDisconnect.addListener(() => {
        // Check for errors when popup disconnects
        if (runtime.lastError) {
          logger.info(
            'TabListeners',
            'Popup disconnect error:',
            (runtime.lastError as chrome.runtime.LastError).message,
          );
        } else {
          logger.info('TabListeners', 'Popup closed, updating badge');
        }

        setTimeout(() => {
          updateBadgeCallback();
        }, 100);
      });
    }
  });

  // Handle navigation for recording
  if (webNavigation && recordingService) {
    logger.info('TabListeners', 'Setting up webNavigation listener');
    webNavigation.onCommitted?.addListener(
      async (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
        if (details.frameId !== 0) {
          logger.debug(
            'TabListeners',
            'Sub-frame navigation:',
            details.tabId,
            details.url,
            'frameId:',
            details.frameId,
          );
          return;
        }

        if (!isTrackableUrl(details.url)) {
          logger.debug('TabListeners', 'Internal navigation:', details.tabId, details.url);
        } else {
          logger.info('TabListeners', 'Navigation committed:', details.tabId, details.url);
        }

        // Page-context swap in tab-telemetry. onPageCommit promotes any
        // pending fires whose requestId led to this URL (e.g. delay chain
        // example.com → delay.html → example.com records a fire against
        // the initial example.com request, and the final commit of
        // example.com promotes it into the new page's bucket instead of
        // wiping it). Unrelated pending fires are dropped.
        tabTelemetryOnPageCommit(details.tabId, details.url);
        lastMainFrameUrlByTab.set(details.tabId, details.url);

        // If this is a test-session tab landing on its real target (not
        // about:blank, not delay.html), the test-runner mounts its in-page
        // widget here. No-op for non-test tabs and for internal commits.
        testRunnerOnTabCommit(details.tabId, details.url);

        await recordingService.handleNavigation(details.tabId, details.url);
      },
    );
  } else {
    logger.error(
      'TabListeners',
      'webNavigation or recordingService not available!',
      'webNavigation:',
      !!webNavigation,
      'recordingService:',
      !!recordingService,
    );
  }

  // Handle back/forward navigation by monitoring webNavigation API if available
  if (webNavigation) {
    webNavigation.onHistoryStateUpdated?.addListener(
      (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
        if (details.frameId === 0) {
          // Main frame only
          logger.info('TabListeners', `History state updated in tab ${details.tabId}`);

          // Skip non-trackable URLs
          if (!isTrackableUrl(details.url)) {
            return;
          }

          // SPA navigation (pushState/replaceState) — reset fire counters
          // so the popup's "fired N× on this page" reflects the user's
          // current perceived route. But ONLY if the URL actually changed:
          // frameworks like github.com's router fire multiple pushStates
          // within milliseconds of page load to canonicalize the URL, all
          // landing on the same effective location. Those shouldn't wipe
          // fires that may have happened in the narrow post-injection
          // window.
          //
          // We deliberately do NOT re-run the script injection path on
          // SPA nav: the document is the same DOM realm, the MAIN-world
          // monkey-patch installed on the initial onCommitted is still
          // live, and a second executeScript would wrap it a second time
          // (leaking a chained origFetch reference and producing double
          // fires). Inject-once-per-document is the correct model.
          const previousUrl = lastMainFrameUrlByTab.get(details.tabId);
          if (previousUrl !== details.url) {
            lastMainFrameUrlByTab.set(details.tabId, details.url);
            // SPA pushState/replaceState: no webRequest redirect chain to
            // promote from (the URL didn't go through the network) — just
            // swap the page context. Pending fires (if any) will be
            // dropped, which is correct for a pushState that replaces
            // the whole document.
            tabTelemetryOnPageCommit(details.tabId, details.url);
          }

          // Re-evaluate if this URL should be tracked
          const matches = checkIfUrlMatchesAnyRule(normalizeUrlForTracking(details.url));
          if (matches) {
            if (!tabsWithActiveRules.has(details.tabId)) {
              tabsWithActiveRules.set(details.tabId, new Map());
            }
            tabsWithActiveRules
              .get(details.tabId)!
              .set(normalizeUrlForTracking(details.url), { timestamp: Date.now(), resourceType: 'main_frame' });
          }

          // Update badge
          tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
            if (tabsList[0] && tabsList[0].id === details.tabId) {
              updateBadgeCallback();
            }
          });
        }
      },
    );

    // Main-frame navigation failures — typically `ERR_BLOCKED_BY_CLIENT`
    // (a DNR block rule cancelled the request), but also DNS / TLS / any
    // terminal navigation error. The widget can NEVER mount on Chrome's
    // error page (chrome-error://chromewebdata/ is a privileged surface
    // that rejects content scripts), so the test session has no in-page
    // UI path forward. Notify the test-runner so it can finish the
    // session promptly and fall back to navigating the test tab to the
    // workspace results page.
    webNavigation.onErrorOccurred?.addListener(
      (details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => {
        if (details.frameId !== 0) return; // sub-frame errors are not session-fatal
        testRunnerOnTabError(details.tabId);
      },
    );

    // Handle pre-rendered pages (Chrome)
    webNavigation.onTabReplaced?.addListener((details: { replacedTabId: number; tabId: number; timeStamp: number }) => {
      logger.info('TabListeners', `Tab ${details.replacedTabId} replaced with ${details.tabId} (likely pre-render)`);

      // Transfer any tracking from the old tab to the new one
      if (tabsWithActiveRules.has(details.replacedTabId)) {
        const trackedUrls = tabsWithActiveRules.get(details.replacedTabId)!;
        tabsWithActiveRules.set(details.tabId, trackedUrls);
        tabsWithActiveRules.delete(details.replacedTabId);

        logger.info('TabListeners', `Transferred ${trackedUrls.size} tracked URLs to new tab`);

        // Update badge if needed
        tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
          if (tabsList[0] && tabsList[0].id === details.tabId) {
            updateBadgeCallback();
          }
        });
      }
    });
  }
}

/**
 * Set up periodic cleanup of stale tab tracking
 */
export function setupPeriodicCleanup(): void {
  // Periodic cleanup of stale tab tracking (tabs that might have been closed without proper cleanup)
  setInterval(() => {
    if (tabsWithActiveRules.size > 0) {
      tabs.query({}, (allTabs: chrome.tabs.Tab[]) => {
        const activeTabIds = new Set(allTabs.map((tab) => tab.id));
        let cleaned = 0;

        for (const [tabId] of tabsWithActiveRules) {
          if (!activeTabIds.has(tabId)) {
            tabsWithActiveRules.delete(tabId);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          logger.info('TabListeners', `Cleaned up ${cleaned} stale tab tracking entries`);
        }
      });
    }
  }, 30000); // Every 30 seconds
}
