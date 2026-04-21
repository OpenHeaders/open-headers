/**
 * Browser API helper types
 */

declare const browser: typeof chrome | undefined;

/** The cross-browser API object (Firefox `browser` or Chrome `chrome`) */
export type BrowserAPI = typeof chrome;

/**
 * Get the appropriate browser API object.
 * In Firefox, `browser` is defined globally; everywhere else we fall back to `chrome`.
 */
export function getBrowserAPI(): BrowserAPI {
  return typeof browser !== 'undefined' ? browser : chrome;
}

/** Callback used to send a response back through runtime.onMessage */
export type SendResponse = (response: unknown) => void;

/** Badge states used by the badge manager */
export type BadgeState = 'none' | 'active' | 'disconnected' | 'paused';

/** Pending request info tracked by the request monitor */
export interface PendingRequest {
  tabId: number;
  url: string;
  headersApplied: boolean;
  method: string;
}

/** Chrome resource type strings used for tracking. */
export type TrackedResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'xmlhttprequest'
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'media'
  | 'websocket'
  | 'ping'
  | 'other';

/**
 * Which extension API surfaced a given observation. `webRequest` is the
 * classic MV3 network-intercept signal; `perfObserver` is the in-page
 * PerformanceObserver content script that catches memory-cache hits and
 * SW-shortcutted responses that webRequest misses; `dnrFeedback` is
 * `declarativeNetRequest.onRuleMatchedDebug` (optional surface, only
 * wired in packaged builds for now).
 */
export type ObservationSource = 'webRequest' | 'perfObserver' | 'dnrFeedback';

/**
 * Tracked resource stored per-tab — URL + metadata. Provenance is
 * tracked as a set because a single URL can be observed through
 * multiple signals (e.g. a network-fresh request fires webRequest AND
 * surfaces in the page's Resource Timing list on reload).
 */
export interface TrackedResource {
  /** Wall-clock ms at first observation. Stable across re-observations. */
  firstSeenTs: number;
  /** Wall-clock ms at most-recent observation. Updated on every sighting. */
  lastSeenTs: number;
  /** Back-compat alias for lastSeenTs — retained so existing tests pass. */
  timestamp: number;
  resourceType: TrackedResourceType;
  /** Non-empty set — every source that has seen this URL. */
  sources: Set<ObservationSource>;
  /**
   * True when the response was served from the renderer's memory cache
   * or HTTP cache without a fresh network round-trip. Detected via
   * `transferSize === 0 && encodedBodySize > 0` in the Resource Timing
   * entry. Drives the "silent" verdict in the popup.
   */
  servedFromCache?: boolean;
}

/**
 * The verdict engine's categorical ruling for a rule, aggregated
 * across every observation attributed to the tab — main frame, same-
 * domain subresources, third-party subresources, iframes, and cache
 * signals. Modeled after rule-engine verdicts in SPF/DKIM/DMARC (email
 * auth), firewall packet-verdicts (pfSense, AWS WAF), and IDS/EDR scan
 * verdicts: each value is a categorical certainty about *what we saw*,
 * never a probability.
 *
 * Five ordered values, each with a distinct debugging meaning:
 *
 *   - `firing`    — a matching request fired the rule's action (counted
 *                   in tab-telemetry). Ground truth: the action ran.
 *   - `silent`    — pattern matched an observed URL but the response was
 *                   served from cache / a service worker / bfcache, so
 *                   the action could NOT run. There was no request for
 *                   DNR/webRequest to modify.
 *   - `page`      — pattern matches the tab URL itself with no matching
 *                   sub-resource observation yet. Typical on first paint
 *                   before the page finishes loading.
 *   - `related`   — pattern's registrable domain matches the tab's. No
 *                   direct URL match, but sibling workbench on this domain
 *                   are useful context for debugging.
 *   - `idle`      — enabled + complete + no verdict signal at all.
 *                   Never returned from `getActiveRulesForTab` today
 *                   (workbench without any signal are omitted); reserved
 *                   for future UIs that show idle workbench explicitly.
 *
 * Rank order (strongest signal first):
 *   firing > silent > page > related > idle
 */
export type RuleVerdict = 'firing' | 'silent' | 'page' | 'related' | 'idle';

/**
 * A silent match — a URL the tab loaded that matches a rule's pattern
 * but for which no webRequest fire happened (cache / SW / bfcache).
 * Surfaced to the popup's "This Page" sub-table with a CACHED chip so
 * users can see "the rule WOULD have fired on these resources, but
 * couldn't because the response bypassed the network."
 *
 * Distinct from `RequestRecord`: silent matches are not fires (the
 * rule's action did not run), so they don't live in tab-telemetry's
 * fire log or counters — only in `ActiveRule.silentRecords`.
 */
export interface SilentMatchRecord {
  url: string;
  pattern: string;
  resourceType: TrackedResourceType;
  /** Wall-clock ms at most-recent observation. */
  t: number;
  /** True when the resource was observed to be served from cache. */
  servedFromCache: boolean;
  /**
   * True when the only observation source for this URL was the
   * perf-observer content script (webRequest never fired). Typically
   * means the subresource was served by a service worker or restored
   * from bfcache.
   */
  perfOnly: boolean;
}

/**
 * Applicable rule returned by `getActiveRulesForTab`. "Applicable" means
 * the rule is worth showing in the popup for this page. The specific
 * reason lives in `verdict` — see the enum above.
 */
export interface ActiveRule {
  id: string;
  key: string;
  name: string;
  ruleType: string;
  summary: string;
  actionLabel: string;
  actionOperation?: string;
  actionTooltip: string;
  actionDirection?: string;
  actionValue: string;
  actionItems?: string[];
  isEnabled: boolean;
  domains: string[];
  /** Rule's path within the workspace (for collection/folder pause checks). */
  path: string;
  /**
   * Why this rule is in the popup. Drives the popup's primary sort
   * (firing > silent > page > related > idle) and the per-row chip.
   * `silent` can coexist with `firing` for different records of the
   * same rule — the rule's overall verdict is the strongest signal
   * observed across all of its records on this tab.
   */
  verdict: RuleVerdict;
  /**
   * Short human-readable explanation of why `verdict` is what it is —
   * e.g. "Matched cached request" or "Matches page URL, no requests
   * yet". Rendered as a tooltip / inline reason in the popup so users
   * can tell "would have fired but cached" apart from "no requests yet".
   */
  verdictReason: string;
  /**
   * URLs the tab loaded that match this rule's pattern but weren't
   * modified by DNR / scriptable injection because the response
   * bypassed the network (cache, SW shortcut, bfcache). Present even
   * when `verdict === 'firing'` — a rule can fire on some requests
   * and silently match others in the same page load. The popup
   * merges these with the telemetry fire records into the per-rule
   * sub-table.
   */
  silentRecords?: SilentMatchRecord[];
}

/** Context object passed to handleGeneralMessage */
export interface MessageHandlerContext {
  isWebSocketConnected: () => boolean;
  sendViaWebSocket: (data: Record<string, unknown>) => boolean;
  scheduleUpdate: (reason: string, options?: { immediate?: boolean }) => void;
  revalidateTrackedRequests: () => Promise<void>;
  updateBadgeCallback: () => void;
}

/** Hotkey command stored in local storage */
export interface HotkeyCommand {
  type: 'TOGGLE_RECORDING';
  timestamp: number;
}
