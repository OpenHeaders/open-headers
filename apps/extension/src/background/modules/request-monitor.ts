/**
 * Request Monitor — sets up webRequest monitoring to drive telemetry and
 * the badge. Two responsibilities:
 *
 *   1. Pattern-match observed requests against enabled V5 rules for badge /
 *      active-tab display (via request-tracker).
 *   2. Feed tab-telemetry's `recordObservedFire` so popup counters reflect
 *      every observed match. Every enabled rule whose URL conditions match
 *      the request is recorded; shadow arbitration runs over the full
 *      matching set before ingestion so records carry a `shadowedBy`
 *      attribution when a higher-priority terminal rule (currently: block)
 *      would have cancelled the request first.
 *
 * Main-frame requests are additionally tracked in tab-telemetry's redirect
 * chain so delay/redirect chains can attribute their fires to the
 * eventually-committed destination page instead of wiping them on commit.
 */

import { tabs } from '@utils/browser-api.js';
import { logger } from '@utils/logger';
import { get as getSetting } from '@/rules/settings/store';
import type { ObservationSource, PendingRequest, TrackedResourceType } from '@/types/browser';
import { getBrowserAPI } from '@/types/browser';
import { addTrackedUrl, checkIfUrlMatchesAnyRule, matchRulesToRequest, tabsWithActiveRules } from './request-tracker';
import { arbitrateWithStrategy } from './shadow-arbitration';
import {
  isTracked as isTabTracked,
  onMainFrameError,
  onMainFrameRedirect,
  onMainFrameRequest,
  recordObservedFire,
  recordObservedUrl,
  updateRequestDeliveryMode,
} from './tab-telemetry';
import { isTrackableUrl, normalizeUrlForTracking } from './url-utils';

/**
 * Set up request monitoring to track which domains tabs are making requests to
 */
export function setupRequestMonitoring(updateBadgeCallback: () => void): void {
  // Check if webRequest API is available
  const browserAPI = getBrowserAPI();
  const webRequestAPI = browserAPI.webRequest;

  if (!webRequestAPI) {
    logger.info('RequestMonitor', 'webRequest API not available');
    return;
  }

  logger.info('RequestMonitor', 'Setting up request monitoring for badge updates');

  // Track pending requests to handle failures
  const pendingRequests = new Map<string, PendingRequest>();

  // Monitor all outgoing requests
  webRequestAPI.onBeforeRequest.addListener(
    ((details: chrome.webRequest.WebRequestDetails) => {
      // Skip non-tab requests
      if (details.tabId === -1) return;

      // Skip non-trackable URLs
      if (!isTrackableUrl(details.url)) {
        return;
      }

      const normalizedUrl = normalizeUrlForTracking(details.url);

      // Check if this request URL matches any of our rules
      const matchesRule = checkIfUrlMatchesAnyRule(normalizedUrl);

      // Tab-telemetry ingestion for tracked tabs. Two separate concerns:
      //
      //   1. Main-frame chain tracking: start a chain for every main-frame
      //      request regardless of match, so if a redirect pushes it through
      //      a matching rule later we can still attribute the fire to the
      //      eventually-committed destination page.
      //   2. Observed-fire recording: for every matching rule, record the
      //      fire with this request's requestId. tab-telemetry dedupes by
      //      (ruleUid, requestId) so redirects don't double-count. No rule
      //      type whitelist — every enabled rule whose URL conditions match
      //      contributes a probable fire.
      if (isTabTracked(details.tabId)) {
        // Log every observed URL regardless of match so session-finish
        // arbitration can re-check no-fire rules against the full set.
        recordObservedUrl(details.tabId, normalizedUrl);
        if (details.type === 'main_frame') {
          onMainFrameRequest(details.tabId, details.requestId, normalizedUrl);
        }
        if (matchesRule) {
          const arbitrated = arbitrateWithStrategy(
            matchRulesToRequest(normalizedUrl),
            getSetting('rulesEngine.evaluationStrategy'),
          );
          const t = Date.now();
          for (const r of arbitrated) {
            recordObservedFire(details.tabId, r.uid, normalizedUrl, details.requestId, t, {
              resourceType: details.type as TrackedResourceType,
              pattern: r.pattern,
              deferred: r.deferred,
              shadowedBy: r.shadowedBy,
            });
          }
        }
      }

      // Track this request with whether headers were applied
      pendingRequests.set(details.requestId, {
        tabId: details.tabId,
        url: normalizedUrl,
        headersApplied: matchesRule,
        method: details.method,
      });

      // Clean up old pending requests periodically
      if (pendingRequests.size > 1000) {
        const oldRequests = Array.from(pendingRequests.keys()).slice(0, 500);
        oldRequests.forEach((id) => {
          pendingRequests.delete(id);
        });
      }

      // Collection is universal — every resource type is recorded into
      // both tab-telemetry and `tabsWithActiveRules`. Display filtering
      // is done at render time in the popup via
      // `rulesEngine.visibleResourceTypes`, which lets users toggle
      // which types show without losing the underlying data.
      if (matchesRule) {
        // Track this tab as having active rules
        addTrackedUrl(details.tabId, normalizedUrl, details.type as TrackedResourceType);

        // Update badge if this is the active tab
        tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
          if (tabsList[0] && tabsList[0].id === details.tabId) {
            updateBadgeCallback();
          }
        });
      }
    }) as Parameters<typeof webRequestAPI.onBeforeRequest.addListener>[0],
    { urls: ['<all_urls>'] },
  );

  // Handle completed requests (successful)
  if (webRequestAPI.onCompleted) {
    webRequestAPI.onCompleted.addListener(
      (details: chrome.webRequest.OnCompletedDetails) => {
        // Back-fill the delivery mode on every record that references
        // this requestId. Chrome only knows the cache verdict after the
        // response has started, so onCompleted is the first point where
        // `fromCache` is reliably set.
        if (details.tabId !== -1 && isTabTracked(details.tabId)) {
          const mode = details.fromCache ? 'cached' : 'network';
          updateRequestDeliveryMode(details.tabId, details.requestId, mode);
        }
        // Remove from pending - request succeeded
        pendingRequests.delete(details.requestId);
      },
      { urls: ['<all_urls>'] },
    );
  }

  // Handle errors - but DON'T remove tracking for requests where headers were applied
  if (webRequestAPI.onErrorOccurred) {
    webRequestAPI.onErrorOccurred.addListener(
      (details: chrome.webRequest.OnErrorOccurredDetails) => {
        // Release the main-frame chain slot so it doesn't leak into
        // tab-telemetry's state.
        if (details.type === 'main_frame') {
          onMainFrameError(details.tabId, details.requestId);
        }

        const pending = pendingRequests.get(details.requestId);

        if (pending) {
          // Determine the type of error
          const error = details.error || '';

          // List of errors that indicate the request was never sent
          const networkFailureErrors: string[] = [
            'net::ERR_CONNECTION_REFUSED',
            'net::ERR_CONNECTION_RESET',
            'net::ERR_CONNECTION_CLOSED',
            'net::ERR_NAME_NOT_RESOLVED',
            'net::ERR_INTERNET_DISCONNECTED',
            'net::ERR_ADDRESS_UNREACHABLE',
            'net::ERR_NETWORK_CHANGED',
            'net::ERR_DNS_TIMED_OUT',
            'net::ERR_TIMED_OUT',
            'net::ERR_CONNECTION_TIMED_OUT',
            'net::ERR_SOCKET_NOT_CONNECTED',
            'net::ERR_NETWORK_ACCESS_DENIED',
            'net::ERR_CERT_AUTHORITY_INVALID',
            'net::ERR_CERT_COMMON_NAME_INVALID',
            'net::ERR_CERT_DATE_INVALID',
            'net::ERR_SSL_PROTOCOL_ERROR',
            'net::ERR_BAD_SSL_CLIENT_AUTH_CERT',
            'net::ERR_CERT_REVOKED',
            'net::ERR_CERT_INVALID',
            'net::ERR_CERT_WEAK_SIGNATURE_ALGORITHM',
            'net::ERR_CERT_NON_UNIQUE_NAME',
            'net::ERR_CERT_WEAK_KEY',
            'net::ERR_CERT_NAME_CONSTRAINT_VIOLATION',
            'net::ERR_CERT_VALIDITY_TOO_LONG',
            'net::ERR_CERTIFICATE_TRANSPARENCY_REQUIRED',
            'net::ERR_CERT_SYMANTEC_LEGACY',
            'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH',
            'net::ERR_SSL_RENEGOTIATION_REQUESTED',
            'net::ERR_CT_CONSISTENCY_PROOF_PARSING_FAILED',
            'net::ERR_SSL_OBSOLETE_VERSION',
          ];

          if (pending.headersApplied && networkFailureErrors.includes(error)) {
            if (tabsWithActiveRules.has(pending.tabId)) {
              const tracked = tabsWithActiveRules.get(pending.tabId)!;
              if (tracked.has(pending.url)) {
                tracked.delete(pending.url);

                // If no more tracked URLs, remove the tab
                if (tracked.size === 0) {
                  tabsWithActiveRules.delete(pending.tabId);
                }

                // Update badge if this is the active tab
                tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
                  if (tabsList[0] && tabsList[0].id === pending.tabId) {
                    updateBadgeCallback();
                  }
                });
              }
            }
          }
        }

        pendingRequests.delete(details.requestId);
      },
      { urls: ['<all_urls>'] },
    );
  }

  // Also monitor response headers to detect CORS issues that don't trigger onErrorOccurred
  if (webRequestAPI.onResponseStarted) {
    webRequestAPI.onResponseStarted.addListener(
      (details: chrome.webRequest.OnResponseStartedDetails) => {
        const pending = pendingRequests.get(details.requestId);

        if (pending?.headersApplied) {
          if (!tabsWithActiveRules.has(details.tabId)) {
            tabsWithActiveRules.set(details.tabId, new Map());
          }

          const tracked = tabsWithActiveRules.get(details.tabId)!;
          if (!tracked.has(pending.url)) {
            const now = Date.now();
            tracked.set(pending.url, {
              firstSeenTs: now,
              lastSeenTs: now,
              timestamp: now,
              resourceType: details.type as TrackedResourceType,
              sources: new Set<ObservationSource>(['webRequest']),
            });
          }
        }
      },
      { urls: ['<all_urls>'] },
    );
  }

  // Monitor redirects to update tracking + extend the main-frame chain
  if (webRequestAPI.onBeforeRedirect) {
    webRequestAPI.onBeforeRedirect.addListener(
      ((details: chrome.webRequest.OnBeforeRedirectDetails) => {
        if (details.tabId === -1) return;

        if (!isTrackableUrl(details.redirectUrl)) return;

        const normalizedRedirectUrl = normalizeUrlForTracking(details.redirectUrl);

        // Log every observed URL (including redirect targets) so
        // session-finish arbitration has the full URL set.
        if (isTabTracked(details.tabId)) {
          recordObservedUrl(details.tabId, normalizedRedirectUrl);
        }

        // Extend the main-frame chain so when the final URL commits we can
        // recognize it as the same navigation and promote pending fires.
        if (details.type === 'main_frame' && isTabTracked(details.tabId)) {
          onMainFrameRedirect(details.tabId, details.requestId, normalizedRedirectUrl);
        }

        const matchesRule = checkIfUrlMatchesAnyRule(normalizedRedirectUrl);

        // Record any rule matches on the redirected URL so telemetry
        // captures fires that happen past the initial redirect hop.
        if (matchesRule && isTabTracked(details.tabId)) {
          const arbitrated = arbitrateWithStrategy(
            matchRulesToRequest(normalizedRedirectUrl),
            getSetting('rulesEngine.evaluationStrategy'),
          );
          const t = Date.now();
          for (const r of arbitrated) {
            recordObservedFire(details.tabId, r.uid, normalizedRedirectUrl, details.requestId, t, {
              resourceType: details.type as TrackedResourceType,
              pattern: r.pattern,
              deferred: r.deferred,
              shadowedBy: r.shadowedBy,
            });
          }
        }

        if (matchesRule) {
          addTrackedUrl(details.tabId, normalizedRedirectUrl, details.type as TrackedResourceType);

          tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
            if (tabsList[0] && tabsList[0].id === details.tabId) {
              updateBadgeCallback();
            }
          });
        }

        const pending = pendingRequests.get(details.requestId);
        if (pending) {
          pending.url = normalizedRedirectUrl;
          pending.headersApplied = matchesRule;
        }
      }) as Parameters<typeof webRequestAPI.onBeforeRedirect.addListener>[0],
      { urls: ['<all_urls>'] },
    );
  }

  // Clear tracking when tab navigates (main frame only)
  const webNavigationAPI = browserAPI.webNavigation;
  if (webNavigationAPI?.onBeforeNavigate) {
    webNavigationAPI.onBeforeNavigate.addListener(
      (details: chrome.webNavigation.WebNavigationBaseCallbackDetails & { frameId: number }) => {
        if (details.frameId === 0) {
          // Main frame
          tabsWithActiveRules.delete(details.tabId);

          // Also clean up any pending requests for this tab
          for (const [requestId, pending] of pendingRequests) {
            if (pending.tabId === details.tabId) {
              pendingRequests.delete(requestId);
            }
          }

          // Update badge if this is the active tab
          tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
            if (tabsList[0] && tabsList[0].id === details.tabId) {
              updateBadgeCallback();
            }
          });
        }
      },
    );
  }
}
