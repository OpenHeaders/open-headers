/**
 * Request Tracker — tracks which tabs have requests matching rules.
 *
 * Used for badge display and the Active tab in the popup.
 * Reads rules from the in-memory rule store (no storage reads in hot
 * paths). Pattern matching always uses the resolved-rule snapshot from
 * `variables-resolver` — rules with `{{VAR}}` in URL conditions only
 * match against the real, interpolated value. Falls back to the raw
 * rule-store view until the first DNR compile populates the snapshot.
 */

import type { HeaderOperation, HeaderRule, Rule } from '@openheaders/core/types';
import {
  doesUrlMatchEntry as coreDoesUrlMatchEntry,
  getActionDetail,
  getRuleMatchPatterns,
  isRuleComplete,
  type MatchPattern,
} from '@openheaders/core/utils';
import { broadcast } from '@utils/bridge';
import { tabs } from '@utils/browser-api';
import { computeVerdict } from '@/shared/verdict';
import type { ActiveRule, ObservationSource, TrackedResource, TrackedResourceType } from '@/types/browser';
import { getRules as getRawRules } from '@openheaders/oracle/entity/rule-store';
import { getResolvedRules, getUnresolvableRuleUids } from '@openheaders/oracle/rule-engine/variables-resolver';
import {
  clearAllTracking as clearAllTrackingState,
  setTrackedResource,
  tabsWithActiveRules as oracleTabsWithActiveRules,
} from '@openheaders/oracle/tracking/tab-tracking-store';

/** Read the current rule list in resolved form, falling back to the
 *  raw rule-store view before the first compile has populated the
 *  resolver snapshot. Every call site in this file that matches URL
 *  patterns goes through this helper. */
function getRules(): Rule[] {
  const resolved = getResolvedRules();
  return resolved.length > 0 ? resolved : getRawRules();
}

import { getTabSnapshot } from './tab-telemetry';
import {
  clearPatternCache,
  doesUrlMatchPattern,
  isTrackableUrl,
  normalizeUrlForTracking,
  precompileAllPatterns,
} from './url-utils';

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Test if a URL matches a MatchPattern. Thin wrapper around core's
 * matcher that routes 'url-filter' patterns through the extension's
 * compiled-regex cache (`doesUrlMatchPattern`) for hot-path perf. The
 * match semantics are identical to core — the cache is pure memoization.
 */
function doesUrlMatchEntry(url: string, entry: MatchPattern): boolean {
  if (entry.kind === 'url-filter') {
    return doesUrlMatchPattern(url, entry.pattern);
  }
  return coreDoesUrlMatchEntry(url, entry);
}

// ── Tracked state ─────────────────────────────────────────────────

const REVALIDATION_QUEUE = new Set<number>();
let isRevalidating = false;

/**
 * Per-tab tracked-resource attribution. The Map itself lives in
 * `@openheaders/oracle/tracking/tab-tracking-store` so the FE-thin-
 * subscriber invariant holds (oracle owns the state, the host owns
 * the chrome bindings that mutate it). Re-exported here under the
 * historical name so existing call sites in this module and in
 * sibling modules (request-monitor, tab-listeners) keep working.
 */
export const tabsWithActiveRules = oracleTabsWithActiveRules;

// ── Pattern precompilation ────────────────────────────────────────

/**
 * Precompile URL patterns from all rules for fast matching.
 * Called when rules change.
 */
export function precompileRulePatterns(): void {
  clearPatternCache();
  const compilablePatterns: string[] = [];
  for (const rule of getRules()) {
    for (const entry of getRuleMatchPatterns(rule)) {
      // url-regex patterns are used as-authored; only url-filter goes
      // through the cached urlFilter compiler.
      if (entry.kind === 'url-filter') {
        compilablePatterns.push(entry.pattern);
      }
    }
  }
  if (compilablePatterns.length > 0) {
    precompileAllPatterns(compilablePatterns);
  }
}

// ── Matching ──────────────────────────────────────────────────────

/**
 * Check if a URL matches any rule's URL conditions (request-domains,
 * url-filter, url-regex). A complete rule without any URL conditions
 * is never considered a match — rules that don't declare where they
 * apply don't fire anywhere.
 */
export function checkIfUrlMatchesAnyRule(url: string): boolean {
  const normalizedUrl = normalizeUrlForTracking(url);
  const unresolvable = getUnresolvableRuleUids();
  for (const rule of getRules()) {
    if (!isRuleComplete(rule)) continue;
    if (unresolvable.has(rule.uid)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A single header operation as seen by arbitration. Normalized away from
 * the wire shape (`override`/`add` collapsed into set/append) because
 * the arbitrator only cares about the *effective semantics* on Chrome's
 * side, not the UX labels. The name is lowercased — HTTP header names are
 * case-insensitive and Chrome collapses them internally.
 */
export interface MatchingRuleHeaderOp {
  side: 'request' | 'response';
  /**
   * Effective operation:
   *   - 'set'     — override an existing value (Chrome 'set'; previously 'override')
   *   - 'append'  — add a new header entry alongside any existing ('add')
   *   - 'remove'  — delete all instances of the header
   *   - 'merge'   — scriptable read-modify-write, not a DNR operation
   */
  operation: 'set' | 'append' | 'remove' | 'merge';
  /** Lowercased header name. */
  name: string;
}

/**
 * A single rule that matched a request — the minimum info request-monitor
 * needs to drive tab-telemetry ingestion AND shadow arbitration.
 */
export interface MatchingRule {
  uid: string;
  name: string;
  type: Rule['type'];
  pattern: string;
  /**
   * True when the rule has a scriptable channel that *might* emit a fire
   * via the in-page fire-bridge. Gates the 500ms fallback buffer in
   * tab-telemetry. See `computeDeferred` below for the per-type rules —
   * notably, header rules are only deferred when they have `merge`
   * operations, because plain override/set/remove operations run through
   * pure DNR and never emit a scriptable fire.
   */
  deferred: boolean;
  /**
   * Populated only for `header` rules. Used by shadow arbitration to
   * detect header-stacking ambiguity and mock-intercept on response-side
   * modifications. Normalized away from the wire shape.
   */
  headerOps?: MatchingRuleHeaderOp[];
}

/**
 * Decide whether a specific rule instance can emit a scriptable fire. This
 * is per-rule, not per-type, because `header` rules are split: merge-type
 * operations flow through the MAIN-world fire-bridge, but plain
 * override/set/remove operations stay pure DNR. Passing the wrong flag
 * would strand plain header rules in the fallback buffer and surface them
 * as `matched-fallback` evidence, which is factually wrong.
 */
function computeDeferred(rule: Rule): boolean {
  switch (rule.type) {
    case 'delay':
    case 'body':
    case 'mock':
    case 'inject':
      return true;
    case 'header':
      return hasHeaderMergeAction(rule);
    default:
      return false;
  }
}

function hasHeaderMergeAction(rule: HeaderRule): boolean {
  const req = rule.action.requestHeaders ?? [];
  const res = rule.action.responseHeaders ?? [];
  for (const h of req) if (h.operation === 'merge') return true;
  for (const h of res) if (h.operation === 'merge') return true;
  return false;
}

/**
 * Normalize a header rule's action into the arbitration-facing shape.
 * the model'ss `override` is Chrome's `set`; the model'ss `add` is Chrome's `append`;
 * `remove` and `merge` pass through. Names are lowercased because HTTP
 * header matching is case-insensitive. Empty output means "header rule
 * with no modifications" — callers should treat that the same as a
 * non-header rule for arbitration purposes.
 */
function extractHeaderOps(rule: HeaderRule): MatchingRuleHeaderOp[] {
  const out: MatchingRuleHeaderOp[] = [];
  const convert = (op: HeaderOperation): MatchingRuleHeaderOp['operation'] => {
    if (op === 'override') return 'set';
    if (op === 'add') return 'append';
    return op; // 'remove' | 'merge'
  };
  for (const h of rule.action.requestHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'request', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  for (const h of rule.action.responseHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'response', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  return out;
}

/**
 * Return every enabled, complete rule whose URL conditions match this URL.
 * Used by the tab-telemetry ingestion path in request-monitor to attribute
 * each observed request to the specific rule uids that would have matched.
 * The `pattern` field is the literal pattern string from the first matching
 * condition — callers pass it through to tab-telemetry so the expand panel
 * can highlight which condition matched. `name` is included so shadow
 * arbitration can surface the shadowing rule's name in tooltips. `deferred`
 * is computed per-rule so header rules without merge operations don't end
 * up stranded in the scriptable fallback buffer.
 */
export function matchRulesToRequest(url: string): MatchingRule[] {
  const normalizedUrl = normalizeUrlForTracking(url);
  const unresolvable = getUnresolvableRuleUids();
  const out: MatchingRule[] = [];
  for (const rule of getRules()) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    // Rules with unresolved `{{ref}}`s aren't in Chrome's DNR set
    // (see `dnr-manager.rebuildAll`), so they don't participate in
    // arbitration either. Skipping here means shadow-warnings stay
    // honest — we don't report a "shadowed by X" conflict against a
    // rule that isn't actually active on the wire.
    if (unresolvable.has(rule.uid)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        const matching: MatchingRule = {
          uid: rule.uid,
          name: rule.name,
          type: rule.type,
          pattern: entry.pattern,
          deferred: computeDeferred(rule),
        };
        if (rule.type === 'header') {
          const ops = extractHeaderOps(rule);
          if (ops.length > 0) matching.headerOps = ops;
        }
        out.push(matching);
        break;
      }
    }
  }
  return out;
}

export interface ActiveRulesResult {
  activeRules: ActiveRule[];
}

/**
 * Get all rules applicable to a specific tab — rules whose URL conditions
 * match either the tab URL itself or a previously-tracked sub-resource URL.
 * Returns both enabled and disabled rules so the popup can show toggles.
 *
 * Per-request firing data (counts, unique URLs, evidence tier) is NOT
 * returned here — the popup reads it separately from tab-telemetry via
 * `getTabTelemetry`. This module is only responsible for deciding which
 * rules are applicable to a given page.
 */
export function getActiveRulesForTab(tabId: number | undefined, tabUrl: string): ActiveRulesResult {
  if (!tabUrl || !isTrackableUrl(tabUrl)) {
    return { activeRules: [] };
  }

  const trackedResources: Map<string, TrackedResource> = new Map();
  if (tabId && tabsWithActiveRules.has(tabId)) {
    for (const [url, res] of tabsWithActiveRules.get(tabId)!) {
      trackedResources.set(url, res);
    }
  }

  // Fire-confirmed rule set for this tab. Joining against telemetry
  // here (rather than the popup join-at-render-time) keeps the popup
  // query single-round-trip and centralizes the "what firing means"
  // definition in one place.
  const firingUids = new Set<string>();
  if (typeof tabId === 'number') {
    const snapshot = getTabSnapshot(tabId);
    for (const uid of Object.keys(snapshot.counters)) firingUids.add(uid);
  }

  const activeRules: ActiveRule[] = [];
  const rules = getRules();
  const unresolvable = getUnresolvableRuleUids();

  const extensionTypes = new Set(['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock']);

  const normalizedTabUrl = normalizeUrlForTracking(tabUrl);

  for (const rule of rules) {
    if (!extensionTypes.has(rule.type)) continue;
    if (!isRuleComplete(rule)) continue;
    // Skip unresolved rules — they never compile to DNR so they
    // can't be "active" on a tab. The sidebar's `unresolved` badge
    // explains their absence to the user.
    if (unresolvable.has(rule.uid)) continue;

    const patterns = getRuleMatchPatterns(rule);
    const result = computeVerdict({
      rule,
      patterns,
      normalizedTabUrl,
      trackedResources,
      firing: firingUids.has(rule.uid),
      normalizeUrl: normalizeUrlForTracking,
    });

    if (!result) continue;

    const detail = getActionDetail(rule);
    const domains = rule.conditions
      .filter((c) => c.type === 'request-domains')
      .flatMap((c) => c.values)
      .filter((v) => v.trim());
    activeRules.push({
      id: rule.uid,
      key: rule.uid,
      name: rule.name,
      ruleType: rule.type,
      summary: detail.label ? `${detail.label}: ${detail.value}` : detail.value || detail.tooltip,
      actionLabel: detail.label,
      actionOperation: detail.operation,
      actionTooltip: detail.tooltip,
      actionDirection: detail.direction,
      actionValue: detail.value,
      actionItems: detail.items,
      isEnabled: rule.enabled,
      domains,
      path: rule.path,
      verdict: result.verdict,
      verdictReason: result.reason,
      // Only include when non-empty so the serialized payload stays
      // lean for the 99% of rules that have no silent matches.
      ...(result.silentRecords.length > 0 ? { silentRecords: result.silentRecords } : {}),
    });
  }

  return { activeRules };
}

// ── Revalidation ──────────────────────────────────────────────────

/**
 * Re-evaluate tracked requests when rules change.
 */
export async function revalidateTrackedRequests(): Promise<void> {
  if (isRevalidating) {
    REVALIDATION_QUEUE.add(Date.now());
    return;
  }

  isRevalidating = true;

  try {
    const rules = getRules();

    if (rules.length === 0) {
      tabsWithActiveRules.clear();
      return;
    }

    for (const [tabId, trackedUrls] of tabsWithActiveRules.entries()) {
      const validUrls = new Map<string, TrackedResource>();

      for (const [url, res] of trackedUrls) {
        let stillMatches = false;
        const normalizedUrl = normalizeUrlForTracking(url);
        for (const rule of rules) {
          for (const entry of getRuleMatchPatterns(rule)) {
            if (doesUrlMatchEntry(normalizedUrl, entry)) {
              stillMatches = true;
              break;
            }
          }
          if (stillMatches) break;
        }
        if (stillMatches) {
          validUrls.set(url, res);
        }
      }

      if (validUrls.size > 0) {
        tabsWithActiveRules.set(tabId, validUrls);
      } else {
        tabsWithActiveRules.delete(tabId);
      }
    }
  } finally {
    isRevalidating = false;

    if (REVALIDATION_QUEUE.size > 0) {
      REVALIDATION_QUEUE.clear();
      setTimeout(() => revalidateTrackedRequests(), 100);
    }
  }
}

// ── Tracking state ────────────────────────────────────────────────

export async function restoreTrackingState(updateBadgeCallback: () => void): Promise<void> {
  tabs.query({}, async (allTabs: chrome.tabs.Tab[]) => {
    for (const tab of allTabs) {
      if (tab.url && tab.id && isTrackableUrl(tab.url)) {
        if (checkIfUrlMatchesAnyRule(tab.url)) {
          if (!tabsWithActiveRules.has(tab.id)) {
            tabsWithActiveRules.set(tab.id, new Map());
          }
          const normalized = normalizeUrlForTracking(tab.url);
          const now = Date.now();
          tabsWithActiveRules.get(tab.id)!.set(normalized, {
            firstSeenTs: now,
            lastSeenTs: now,
            timestamp: now,
            resourceType: 'main_frame',
            sources: new Set<ObservationSource>(['webRequest']),
          });
        }
      }
    }
    if (updateBadgeCallback) updateBadgeCallback();
  });
}

/**
 * Extra metadata the caller supplies when reporting an observation.
 * `source` defaults to `'webRequest'` so existing callers don't need to
 * thread a source through; `servedFromCache` is only meaningful for
 * PerformanceObserver-sourced observations.
 */
export interface AddTrackedUrlOptions {
  source?: ObservationSource;
  servedFromCache?: boolean;
}

export function addTrackedUrl(
  tabId: number,
  url: string,
  resourceType: TrackedResourceType = 'other',
  options: AddTrackedUrlOptions = {},
): void {
  const source = options.source ?? 'webRequest';
  const servedFromCache = options.servedFromCache ?? false;
  // setTrackedResource owns the in-memory state mutation; the host-only
  // side effects (broadcast + debounced session-storage flush) stay
  // here because they reach chrome.runtime and chrome.storage.session.
  // Returns true only on first insert — re-observations don't broadcast
  // (the popup already knows about this URL; per-request broadcast
  // storms on noisy pages would wake it for no new information).
  const inserted = setTrackedResource(tabId, url, resourceType, source, servedFromCache);
  if (inserted) {
    broadcast('trackedUrlsUpdated', { tabId });
  }
  scheduleTabTrackingPersist();
}

export function clearAllTracking(): void {
  clearAllTrackingState();
}

// ── Session persistence ────────────────────────────────────────────
//
// MV3 terminates the service worker after ~30s of inactivity. The
// `tabsWithActiveRules` Map lives in module-level state that dies with
// the worker, so every wake would drop the subresource attribution we
// built up on prior requests — rules targeting cached subresources
// would disappear from the popup until the user reloaded the page.
//
// We persist to `chrome.storage.session` (scoped to the browser
// session, partitioned per profile, auto-cleaned on incognito close)
// with a debounced writer so noisy pages don't spam the store. On SW
// wake we rehydrate BEFORE any popup query could observe an empty map,
// then reconcile against the current tab set so closed-tab entries
// don't leak. The fire-bridge and perf-observer content scripts are
// already persisted across the SW's lifetime, so new observations
// after wake arrive naturally; session persistence only backfills what
// we learned before the worker slept.
//
// Bounds: we keep at most 500 URLs per tab in the persisted payload
// (LRU by lastSeenTs). This caps storage at ~5MB even with 50 active
// tabs — well under `chrome.storage.session`'s 10MB quota, with
// headroom for the rule-state observer and other consumers.

const SESSION_STORAGE_KEY = 'tabTracker.tabsWithActiveRules';
const PERSIST_DEBOUNCE_MS = 250;
const MAX_PERSISTED_URLS_PER_TAB = 500;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

interface PersistedResource {
  firstSeenTs: number;
  lastSeenTs: number;
  resourceType: TrackedResourceType;
  sources: ObservationSource[];
  servedFromCache?: boolean;
}

type PersistedPayload = Record<string /* tabId */, Record<string /* url */, PersistedResource>>;

interface SessionStorageApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getSessionStorage(): SessionStorageApi | null {
  const c = globalThis as unknown as {
    chrome?: { storage?: { session?: SessionStorageApi } };
    browser?: { storage?: { session?: SessionStorageApi } };
  };
  return c.chrome?.storage?.session ?? c.browser?.storage?.session ?? null;
}

export function scheduleTabTrackingPersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistTabTracking();
  }, PERSIST_DEBOUNCE_MS);
}

async function persistTabTracking(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  const payload: PersistedPayload = {};
  for (const [tabId, urlMap] of tabsWithActiveRules) {
    // LRU-bound the per-tab payload by lastSeenTs so a long-lived SPA
    // doesn't balloon the persisted blob past the storage quota.
    const entries = [...urlMap.entries()]
      .sort((a, b) => b[1].lastSeenTs - a[1].lastSeenTs)
      .slice(0, MAX_PERSISTED_URLS_PER_TAB);
    const tabPayload: Record<string, PersistedResource> = {};
    for (const [url, res] of entries) {
      tabPayload[url] = {
        firstSeenTs: res.firstSeenTs,
        lastSeenTs: res.lastSeenTs,
        resourceType: res.resourceType,
        sources: [...res.sources],
        servedFromCache: res.servedFromCache,
      };
    }
    payload[String(tabId)] = tabPayload;
  }
  try {
    await session.set({ [SESSION_STORAGE_KEY]: payload });
  } catch {
    /* Storage may be full or the API may be unavailable — non-fatal. */
  }
}

function isPersistedPayload(raw: unknown): raw is PersistedPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  for (const tabMap of Object.values(raw as Record<string, unknown>)) {
    if (!tabMap || typeof tabMap !== 'object') return false;
    for (const res of Object.values(tabMap as Record<string, unknown>)) {
      if (!res || typeof res !== 'object') return false;
      const r = res as Record<string, unknown>;
      if (typeof r.firstSeenTs !== 'number') return false;
      if (typeof r.lastSeenTs !== 'number') return false;
      if (typeof r.resourceType !== 'string') return false;
      if (!Array.isArray(r.sources)) return false;
    }
  }
  return true;
}

/**
 * Rehydrate `tabsWithActiveRules` from `chrome.storage.session`. Call
 * once at SW init, before anything else could observe an empty map.
 * Safe to call multiple times; subsequent calls merge with whatever
 * state was already built up since startup.
 *
 * Reconciliation happens lazily: we hydrate everything, and a periodic
 * tab cleanup (already scheduled by `setupPeriodicCleanup`) prunes
 * entries for tabs that were closed during the SW's sleep.
 */
export async function rehydrateTabTracking(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  try {
    const result = await session.get(SESSION_STORAGE_KEY);
    const raw = result[SESSION_STORAGE_KEY];
    if (!isPersistedPayload(raw)) return;
    for (const [tabIdStr, urlMap] of Object.entries(raw)) {
      const tabId = Number(tabIdStr);
      if (!Number.isFinite(tabId)) continue;
      if (!tabsWithActiveRules.has(tabId)) {
        tabsWithActiveRules.set(tabId, new Map());
      }
      const dest = tabsWithActiveRules.get(tabId)!;
      for (const [url, res] of Object.entries(urlMap)) {
        if (dest.has(url)) continue;
        dest.set(url, {
          firstSeenTs: res.firstSeenTs,
          lastSeenTs: res.lastSeenTs,
          timestamp: res.lastSeenTs,
          resourceType: res.resourceType,
          sources: new Set<ObservationSource>(res.sources),
          servedFromCache: res.servedFromCache,
        });
      }
    }
  } catch {
    /* Bad payload — skip rehydration, the SW will rebuild from scratch. */
  }
}

// ── PerformanceObserver ingestion ──────────────────────────────────

/**
 * Map a Resource Timing `initiatorType` onto our `TrackedResourceType`
 * enum, which is modeled on webRequest's resource taxonomy. The Resource
 * Timing spec uses DOM-element names ("img", "script") rather than
 * webRequest's categorical names ("image", "script"); most line up 1:1
 * but a handful need translation. Anything unrecognized lands in
 * 'other', which the popup's filter row treats as a valid category.
 */
function perfInitiatorToResourceType(initiatorType: string): TrackedResourceType {
  switch (initiatorType) {
    case 'img':
    case 'image':
      return 'image';
    case 'script':
      return 'script';
    case 'css':
    case 'link':
      return 'stylesheet';
    case 'xmlhttprequest':
    case 'fetch':
      return 'xmlhttprequest';
    case 'iframe':
    case 'frame':
      return 'sub_frame';
    case 'beacon':
    case 'ping':
      return 'ping';
    case 'video':
    case 'audio':
      return 'media';
    case 'navigation':
      return 'main_frame';
    default:
      return 'other';
  }
}

/**
 * Ingest a batch of Resource Timing entries observed by the
 * perf-observer content script. For each entry whose URL matches any
 * rule, the URL is added to `tabsWithActiveRules` with
 * `source='perfObserver'` and the cache flag from the timing entry.
 *
 * Unlike webRequest ingestion, this does NOT count as a "fire" — the
 * rule's action couldn't have run on a cache-served response because
 * there was no request to modify. Instead, the popup surfaces these as
 * a `silent` verdict (applicable but no fire). Callers feed fire-level
 * telemetry through `recordObservedFire` separately when webRequest
 * also sees the same request.
 *
 * Returns the count of URLs that matched a rule for the caller's
 * bookkeeping (currently unused, but useful for debugging).
 */
export function ingestPerfEntries(
  tabId: number,
  entries: ReadonlyArray<{ url: string; initiatorType: string; servedFromCache: boolean }>,
): number {
  if (!tabId || tabId < 0) return 0;
  let matched = 0;
  for (const entry of entries) {
    if (!isTrackableUrl(entry.url)) continue;
    if (!checkIfUrlMatchesAnyRule(entry.url)) continue;
    const normalized = normalizeUrlForTracking(entry.url);
    addTrackedUrl(tabId, normalized, perfInitiatorToResourceType(entry.initiatorType), {
      source: 'perfObserver',
      servedFromCache: entry.servedFromCache,
    });
    matched++;
  }
  return matched;
}
