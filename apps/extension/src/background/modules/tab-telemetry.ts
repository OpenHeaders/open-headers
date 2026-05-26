/**
 * Tab Telemetry — single source of truth for per-tab rule-match data.
 *
 * Owns every piece of state the popup's "This Page" view renders: per-rule
 * event counters, per-rule unique-URL maps, and a bounded chronological fire
 * log. Consumers (popup, test-runner) read one snapshot; there is no parallel
 * `matchedUrls` store in request-tracker anymore.
 *
 * ── Data model ─────────────────────────────────────────────────────
 *
 * Each tracked tab holds:
 *
 *   - `counters`          — events per rule. Every non-dropped fire increments.
 *                           Used by the popup tag.
 *   - `uniquesByRule`     — Map<ruleUid, Map<normalizedUrl, RequestRecord>>.
 *                           LRU-capped at MAX_UNIQUE_URLS_PER_RULE per rule.
 *                           Powers the expand badge and nested-table rows.
 *                           On re-observation, the record is re-inserted at
 *                           the tail and evidence may be upgraded.
 *   - `fires`             — chronological ring buffer (MAX_FIRES_PER_TAB).
 *                           Kept for test-runner's session result payload.
 *   - `mainFrameChains`   — per-requestId main-frame navigation chains used
 *                           to attribute pre-commit fires to the right page.
 *   - `pendingFires`      — observed main-frame fires awaiting commit.
 *   - `pendingFallback`   — observed sub-resource fires for rule types that
 *                           *might* also emit a scriptable fire. Buffered for
 *                           FALLBACK_WINDOW_MS, then either drained by a
 *                           matching scriptable fire (scriptable wins) or
 *                           promoted as evidence='matched-fallback'.
 *   - `recentScriptable`  — per-key suppression window so a late observed
 *                           fire doesn't double-count after scriptable wins.
 *   - `seen`              — (ruleUid, requestId) dedup for observed fires,
 *                           so redirect re-observation doesn't inflate counts.
 *
 * ── Evidence tiers ─────────────────────────────────────────────────
 *
 *   - `confirmed`       — fire-bridge reported from the in-page MAIN world.
 *                         Ground truth for the scriptable action having run.
 *   - `matched`         — webRequest observed a URL that satisfies the rule's
 *                         conditions. For pure DNR rules this is the best
 *                         evidence available (Chrome does not tell extensions
 *                         which rule wins arbitration in production).
 *   - `matched-fallback` — same as `matched`, but for a rule type that *could*
 *                         have emitted a scriptable fire and didn't within
 *                         FALLBACK_WINDOW_MS. Signals that the scriptable
 *                         reporter was unavailable (e.g. strict-CSP site
 *                         blocked the MAIN-world injection).
 *
 * ── Page-context attribution ───────────────────────────────────────
 *
 * `onPageCommit` is the atomic page swap. It promotes pending main-frame
 * fires whose requestId leads to the committed URL and drops everything else.
 * See the comment on `onPageCommit` for the delay-chain handling.
 */

import type { TrackedResourceType } from '@/types/browser';
import type { DeliveryMode, Evidence, RequestRecord, TabTelemetrySnapshot } from '@openheaders/core/types';
import type { ShadowAttribution } from './shadow-arbitration';

export type { DeliveryMode, Evidence, RequestRecord, TabTelemetrySnapshot } from '@openheaders/core/types';

// ── Tunables ────────────────────────────────────────────────────────

/** Ring buffer cap for the chronological fire log. Counters keep growing past this. */
const MAX_FIRES_PER_TAB = 1000;

/**
 * Soft cap on unique URLs tracked per rule per tab. LRU eviction — on overflow,
 * the oldest entry by last-touch order is dropped. A long-lived SPA hitting a
 * REST API with path parameters can easily accumulate thousands of unique
 * URLs for one rule; 10k covers any reasonable debugging session without
 * pathological memory growth. Tune here if needed.
 */
const MAX_UNIQUE_URLS_PER_RULE = 10_000;

/**
 * Buffer window for observed fires of "deferred" rule types (types that might
 * also emit a scriptable fire). Within this window:
 *   - a matching scriptable fire drains the buffer (scriptable wins, no count)
 *   - a late observed fire is suppressed if a scriptable already won
 *   - if neither happens, the observed fire is promoted as 'matched-fallback'
 * 500ms is the smallest value that comfortably covers the MAIN→ISOLATED
 * postMessage + runtime.sendMessage hops on slow pages.
 */
const FALLBACK_WINDOW_MS = 500;

// ── Public types ────────────────────────────────────────────────────

/** Metadata the caller supplies when reporting an observed (webRequest) fire. */
export interface ObservedFireMeta {
  resourceType: TrackedResourceType;
  pattern: string;
  /**
   * True if the rule's type can *also* emit a scriptable fire (delay, body,
   * mock, inject, header with header-merge). Gates the 500ms buffer. Pure DNR
   * types (block, redirect, query-param, plain header) pass false and are
   * recorded immediately.
   */
  deferred: boolean;
  /**
   * Shadow arbitration result for this rule on this request. Propagated
   * into `RequestRecord.shadowedBy` verbatim. Omit to signal "our arbitrator
   * has no confident claim about this rule's fate" — the UI treats that as
   * unshadowed, the same as when the experimental flag is off.
   */
  shadowedBy?: ShadowAttribution;
}

/** Metadata the caller supplies when reporting a scriptable (fire-bridge) fire. */
export interface ScriptableFireMeta {
  pattern: string;
  resourceType: TrackedResourceType;
}

export type TrackingReason = string;

// ── Internal state ──────────────────────────────────────────────────

interface PendingFire {
  requestId: string;
  record: RequestRecord;
}

interface MainFrameChain {
  requestId: string;
  urls: Set<string>;
}

interface PendingFallback {
  record: RequestRecord;
  timer: ReturnType<typeof setTimeout>;
}

interface TabState {
  tabId: number;
  reasons: Set<TrackingReason>;
  currentPageUrl: string | null;
  fires: RequestRecord[];
  counters: Map<string, number>;
  uniquesByRule: Map<string, Map<string, RequestRecord>>;
  pendingFires: PendingFire[];
  mainFrameChains: Map<string, MainFrameChain>;
  pendingFallback: Map<string, PendingFallback>;
  /** Map<`${uid}:${normalizedUrl}`, expiryMs>. Suppresses late observed fires. */
  recentScriptable: Map<string, number>;
  /** `${uid}:${requestId}` — observed-fire dedup across redirect chains. */
  seen: Set<string>;
  /**
   * Every normalized URL observed on this tab since tracking started —
   * main-frame navigations, redirects, sub-resources, XHRs, everything
   * request-monitor sees. Used at test-session-finish time to re-run
   * arbitration against the full observed-URL set, so no-fire rules can
   * be promoted to shadowed when a sibling rule (delay / redirect / block)
   * would have shadowed them on any URL the tab actually hit. This is
   * the static "arbitrate-against-everything-observed" pass that catches
   * shadows lost to the pre-commit pending-fires drop.
   */
  observedUrls: Set<string>;
}

const tabs: Map<number, TabState> = new Map();

/**
 * Per-tab fire subscribers. Notified for every record that lands in the
 * counters (post-fallback drain, post-promotion). Used by the test-runner
 * to push live fire counts into its in-page widget without polling. Listeners
 * MUST NOT call back into telemetry (no re-entrancy guard).
 */
type FireListener = (record: RequestRecord) => void;
const fireListeners: Map<number, Set<FireListener>> = new Map();

/**
 * Cross-tab fire subscribers. Notified for every fire on every tab. Used
 * by the rule-fire hub bridge to feed the per-tab broadcaster without
 * needing a per-tab subscription dance.
 */
type GlobalFireListener = (tabId: number, record: RequestRecord) => void;
const globalFireListeners: Set<GlobalFireListener> = new Set();

/**
 * Every request observed on a tracked tab — not just matches. Feeds the
 * DevTools Inspector panel's traffic list via the devtools-inspector port
 * handler, which correlates each observation against the DevTools HAR
 * stream using the `(method, url, timestamp)` bucketing strategy.
 *
 * Separate listener set from `fireListeners` so subscribers that only
 * care about matches don't pay for every observed URL on a noisy page.
 */
export interface RequestObservation {
  /** Canonical Chrome webRequest id. Join key for HAR correlation. */
  requestId: string;
  method: string;
  url: string;
  resourceType: TrackedResourceType;
  initiator?: string;
  /** Wall-clock ms at onBeforeRequest — `Date.now()`, matching record.t. */
  timestamp: number;
}

type RequestEventListener = (event: RequestObservation) => void;
const requestEventListeners: Map<number, Set<RequestEventListener>> = new Map();

/**
 * A 3xx hop seen by `chrome.webRequest.onBeforeRedirect`. Carries the
 * authoritative status code, which the panel uses to mint or upgrade
 * the source row — Chrome's HAR pipeline is unreliable for redirect
 * source hops (omits some statuses, mis-attributes others).
 */
export interface RequestRedirect {
  requestId: string;
  sourceUrl: string;
  method: string;
  resourceType: TrackedResourceType;
  statusCode: number;
  redirectUrl: string;
  timestamp: number;
}

type RequestRedirectListener = (event: RequestRedirect) => void;
const requestRedirectListeners: Map<number, Set<RequestRedirectListener>> = new Map();

function emptyState(tabId: number): TabState {
  return {
    tabId,
    reasons: new Set(),
    currentPageUrl: null,
    fires: [],
    counters: new Map(),
    uniquesByRule: new Map(),
    pendingFires: [],
    mainFrameChains: new Map(),
    pendingFallback: new Map(),
    recentScriptable: new Map(),
    seen: new Set(),
    observedUrls: new Set(),
  };
}

function emitFire(tabId: number, record: RequestRecord): void {
  const set = fireListeners.get(tabId);
  if (set && set.size > 0) {
    for (const fn of set) {
      try {
        fn(record);
      } catch {
        // Subscriber failures must never corrupt telemetry state.
      }
    }
  }
  for (const fn of globalFireListeners) {
    try {
      fn(tabId, record);
    } catch {
      // Subscriber failures must never corrupt telemetry state.
    }
  }
}

/**
 * Subscribe to every fire that lands in this tab's counters. Returns an
 * unsubscribe function. Listeners are independent of tracking reasons —
 * they fire as long as the tab has any tracking reason active. Used by
 * the test-runner to drive its in-page widget without polling.
 */
export function subscribeFiresAll(listener: GlobalFireListener): () => void {
  globalFireListeners.add(listener);
  return () => {
    globalFireListeners.delete(listener);
  };
}

export function subscribeFires(tabId: number, listener: FireListener): () => void {
  let set = fireListeners.get(tabId);
  if (!set) {
    set = new Set();
    fireListeners.set(tabId, set);
  }
  set.add(listener);
  return () => {
    const current = fireListeners.get(tabId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) fireListeners.delete(tabId);
  };
}

function emitRequestObservation(tabId: number, event: RequestObservation): void {
  const set = requestEventListeners.get(tabId);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch {
      // Listener failures must never corrupt telemetry state.
    }
  }
}

/**
 * Subscribe to every request observed on this tab, match or not. Used by
 * the DevTools Inspector panel to build its traffic list and correlate
 * rule fires with specific requests. Unlike `subscribeFires`, this fires
 * BEFORE any rule-matching work so the panel sees the full stream.
 */
export function subscribeRequestEvents(tabId: number, listener: RequestEventListener): () => void {
  let set = requestEventListeners.get(tabId);
  if (!set) {
    set = new Set();
    requestEventListeners.set(tabId, set);
  }
  set.add(listener);
  return () => {
    const current = requestEventListeners.get(tabId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) requestEventListeners.delete(tabId);
  };
}

/**
 * Record a raw request observation. Called from request-monitor's
 * `onBeforeRequest` listener for every tracked tab, regardless of rule
 * matching. Broadcasts to any `subscribeRequestEvents` listeners. This
 * is a thin pass-through — the state itself is not stored because the
 * request list is bounded by the panel's own retention policy, not
 * tab-telemetry's page-scoped state.
 */
export function recordRequestObservation(tabId: number, event: RequestObservation): void {
  emitRequestObservation(tabId, event);
}

function emitRequestRedirect(tabId: number, event: RequestRedirect): void {
  const set = requestRedirectListeners.get(tabId);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch {
      // Listener failures must never corrupt telemetry state.
    }
  }
}

/**
 * Subscribe to every redirect hop observed on this tab. The panel uses
 * this to synthesize source-hop rows the Chrome DevTools HAR pipeline
 * drops or mis-attributes.
 */
export function subscribeRequestRedirects(tabId: number, listener: RequestRedirectListener): () => void {
  let set = requestRedirectListeners.get(tabId);
  if (!set) {
    set = new Set();
    requestRedirectListeners.set(tabId, set);
  }
  set.add(listener);
  return () => {
    const current = requestRedirectListeners.get(tabId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) requestRedirectListeners.delete(tabId);
  };
}

/**
 * Record a redirect hop observation. Called from request-monitor's
 * `onBeforeRedirect` handler for every tracked tab. Broadcasts to any
 * `subscribeRequestRedirects` listeners; no state is stored here.
 */
export function recordRequestRedirect(tabId: number, event: RequestRedirect): void {
  emitRequestRedirect(tabId, event);
}

function normalizeForAttribution(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url;
    // Strip the fragment — Chrome drops it from DNR matching and we don't
    // want `/page#a` vs `/page#b` treated as different URLs.
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function fallbackKey(ruleUid: string, normalizedUrl: string): string {
  return `${ruleUid}:${normalizedUrl}`;
}

// ── Tracking lifecycle ──────────────────────────────────────────────

export function startTracking(tabId: number, reason: TrackingReason): void {
  let state = tabs.get(tabId);
  if (!state) {
    state = emptyState(tabId);
    tabs.set(tabId, state);
  }
  state.reasons.add(reason);
}

export function stopTracking(tabId: number, reason: TrackingReason): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.reasons.delete(reason);
  if (state.reasons.size === 0) {
    disposeTab(state);
    tabs.delete(tabId);
  }
}

export function isTracked(tabId: number): boolean {
  return tabs.has(tabId);
}

/** Fully remove all state for a tab — used on tab close. */
export function clearTab(tabId: number): void {
  const state = tabs.get(tabId);
  if (!state) return;
  disposeTab(state);
  tabs.delete(tabId);
  fireListeners.delete(tabId);
  requestEventListeners.delete(tabId);
}

function disposeTab(state: TabState): void {
  for (const entry of state.pendingFallback.values()) {
    clearTimeout(entry.timer);
  }
  state.pendingFallback.clear();
}

// ── Fire ingestion ──────────────────────────────────────────────────

function touchUnique(state: TabState, record: RequestRecord): void {
  let byUrl = state.uniquesByRule.get(record.ruleUid);
  if (!byUrl) {
    byUrl = new Map();
    state.uniquesByRule.set(record.ruleUid, byUrl);
  }
  const key = normalizeForAttribution(record.url);
  if (byUrl.has(key)) {
    // Re-insert to move to the tail of the LRU ordering. Upgrade evidence
    // to the highest tier we've seen for this (rule, url) pair.
    const existing = byUrl.get(key)!;
    const upgraded: RequestRecord = { ...record, evidence: upgradeEvidence(existing.evidence, record.evidence) };
    byUrl.delete(key);
    byUrl.set(key, upgraded);
    return;
  }
  byUrl.set(key, record);
  if (byUrl.size > MAX_UNIQUE_URLS_PER_RULE) {
    const oldest = byUrl.keys().next().value;
    if (oldest !== undefined) byUrl.delete(oldest);
  }
}

function upgradeEvidence(a: Evidence, b: Evidence): Evidence {
  // Ordering: confirmed > matched > matched-fallback > silent. Silent
  // records never reach this function today (they're populated outside
  // tab-telemetry via `ActiveRule.silentRecords`), but the map must
  // cover every `Evidence` value or TypeScript rejects the Record.
  const rank: Record<Evidence, number> = { confirmed: 3, matched: 2, 'matched-fallback': 1, silent: 0 };
  return rank[a] >= rank[b] ? a : b;
}

function appendFire(state: TabState, record: RequestRecord): void {
  state.fires.push(record);
  if (state.fires.length > MAX_FIRES_PER_TAB) {
    state.fires.shift();
  }
  state.counters.set(record.ruleUid, (state.counters.get(record.ruleUid) ?? 0) + 1);
  touchUnique(state, record);
  emitFire(state.tabId, record);
}

function isScriptableSuppressed(state: TabState, key: string, now: number): boolean {
  const expiry = state.recentScriptable.get(key);
  if (expiry === undefined) return false;
  if (expiry <= now) {
    state.recentScriptable.delete(key);
    return false;
  }
  return true;
}

/**
 * Record an observed (webRequest) fire. Gate behavior:
 *
 *   - Main-frame requests are buffered in `pendingFires` until
 *     `onPageCommit` lands with a matching requestId chain.
 *   - Sub-resource requests for non-deferred rule types are appended
 *     immediately with evidence='matched'.
 *   - Sub-resource requests for deferred rule types (rule types that might
 *     also emit a scriptable fire) are buffered for FALLBACK_WINDOW_MS. A
 *     matching scriptable fire drains the buffer (scriptable wins, no count).
 *     If the timer fires first, the record is promoted with
 *     evidence='matched-fallback'.
 *
 * Deduped by `(ruleUid, requestId)` so redirect re-observation doesn't
 * double-count. No-op for untracked tabs.
 */
export function recordObservedFire(
  tabId: number,
  ruleUid: string,
  url: string,
  requestId: string,
  t: number,
  meta: ObservedFireMeta,
): void {
  const state = tabs.get(tabId);
  if (!state) return;

  const dedupKey = `${ruleUid}:${requestId}`;
  if (state.seen.has(dedupKey)) return;
  state.seen.add(dedupKey);

  const record: RequestRecord = {
    ruleUid,
    url,
    pattern: meta.pattern,
    resourceType: meta.resourceType,
    t,
    evidence: 'matched',
    requestId,
    ...(meta.shadowedBy ? { shadowedBy: meta.shadowedBy } : {}),
  };

  // Main-frame requests flow through the chain buffer. The 500ms fallback
  // doesn't apply here — main-frame navigations are already gated by commit
  // attribution, which is a much stronger signal than a wall-clock timer.
  if (meta.resourceType === 'main_frame') {
    state.pendingFires.push({ requestId, record });
    return;
  }

  const normalized = normalizeForAttribution(url);
  const key = fallbackKey(ruleUid, normalized);

  // A scriptable fire already won for this (rule, url) — drop the observed.
  if (isScriptableSuppressed(state, key, t)) return;

  if (!meta.deferred) {
    // Pure-DNR rule type — no scriptable channel exists for it. Record now.
    appendFire(state, record);
    return;
  }

  // Deferred path — buffer the observed fire for up to FALLBACK_WINDOW_MS.
  // If a prior pending exists for the same key (unusual — same rule+URL
  // observed twice in <500ms without a scriptable drain), replace it so the
  // most recent record wins on promotion.
  const prior = state.pendingFallback.get(key);
  if (prior) clearTimeout(prior.timer);

  const timer = setTimeout(() => {
    const current = tabs.get(tabId);
    if (!current) return;
    const entry = current.pendingFallback.get(key);
    if (!entry) return;
    current.pendingFallback.delete(key);
    appendFire(current, { ...entry.record, evidence: 'matched-fallback' });
  }, FALLBACK_WINDOW_MS);

  state.pendingFallback.set(key, { record, timer });
}

/**
 * Record a scriptable fire reported by the in-page fire-bridge. Always
 * attributed to the current tab's page. If a matching observed fire is
 * currently buffered in `pendingFallback`, the scriptable drains it so the
 * same action isn't counted twice. A short suppression window is set so a
 * late observed fire for the same (rule, url) within the window is also
 * dropped. No-op for untracked tabs.
 */
export function recordScriptableFire(
  tabId: number,
  ruleUid: string,
  url: string,
  t: number,
  meta: ScriptableFireMeta,
): void {
  const state = tabs.get(tabId);
  if (!state) return;

  const normalized = normalizeForAttribution(url);
  const key = fallbackKey(ruleUid, normalized);

  // Drain any pending observed fallback for this key — scriptable is ground
  // truth for the action, so the observed shadow doesn't count.
  const pending = state.pendingFallback.get(key);
  if (pending) {
    clearTimeout(pending.timer);
    state.pendingFallback.delete(key);
  }

  // Suppress any late observed fire for this key within the window.
  state.recentScriptable.set(key, t + FALLBACK_WINDOW_MS);

  const record: RequestRecord = {
    ruleUid,
    url,
    pattern: meta.pattern,
    resourceType: meta.resourceType,
    t,
    evidence: 'confirmed',
  };
  appendFire(state, record);
}

// ── Delivery-mode back-fill ─────────────────────────────────────────

/**
 * Back-fill the delivery mode on every record for a given requestId.
 * Called from request-monitor's `onCompleted` listener once Chrome
 * reports whether the response was cache-served. Walks each place a
 * record can live (pending main-frame queue, pending fallback buffer,
 * chronological fire log, per-rule LRU maps) and updates in place.
 *
 * Safe no-op when the tab isn't tracked or no record exists yet for
 * this requestId — a scriptable-only fire has no requestId so its
 * deliveryMode stays undefined, which the UI renders as no tag.
 */
export function updateRequestDeliveryMode(tabId: number, requestId: string, mode: DeliveryMode): void {
  const state = tabs.get(tabId);
  if (!state) return;

  for (const pending of state.pendingFires) {
    if (pending.requestId === requestId) pending.record.deliveryMode = mode;
  }
  for (const entry of state.pendingFallback.values()) {
    if (entry.record.requestId === requestId) entry.record.deliveryMode = mode;
  }
  for (const fire of state.fires) {
    if (fire.requestId === requestId) fire.deliveryMode = mode;
  }
  for (const urlMap of state.uniquesByRule.values()) {
    for (const record of urlMap.values()) {
      if (record.requestId === requestId) record.deliveryMode = mode;
    }
  }
}

// ── Observed URL log ────────────────────────────────────────────────

/**
 * Record a URL that Chrome observed on this tab, regardless of whether
 * any rule matched. Called from request-monitor for every trackable
 * request (onBeforeRequest + onBeforeRedirect), so the session-end
 * arbitration pass can re-check every URL against the full rule scope.
 *
 * No-op for untracked tabs. Normalization is the caller's responsibility
 * so this stays a trivial set.add.
 */
export function recordObservedUrl(tabId: number, normalizedUrl: string): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.observedUrls.add(normalizedUrl);
}

/**
 * Read every URL the tab has seen since tracking started. Used by
 * test-runner at session finish to run static arbitration against
 * each observed URL and promote no-fire rules to shadowed where a
 * sibling rule would have shadowed them on ANY hit URL (even ones
 * whose fire records were dropped at commit time by the pending-fires
 * pipeline — e.g. the delay → delay.html case).
 */
export function getObservedUrls(tabId: number): string[] {
  const state = tabs.get(tabId);
  if (!state) return [];
  return [...state.observedUrls];
}

// ── Main-frame chain tracking ───────────────────────────────────────

export function onMainFrameRequest(tabId: number, requestId: string, url: string): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.mainFrameChains.set(requestId, { requestId, urls: new Set([normalizeForAttribution(url)]) });
}

export function onMainFrameRedirect(tabId: number, requestId: string, newUrl: string): void {
  const state = tabs.get(tabId);
  if (!state) return;
  const chain = state.mainFrameChains.get(requestId);
  if (!chain) return;
  chain.urls.add(normalizeForAttribution(newUrl));
}

/**
 * Extension page URL detection. Covers every MV3 browser we ship to:
 *   - Chrome / Opera / Brave: `chrome-extension://`
 *   - Edge: `extension://`
 *   - Firefox: `moz-extension://`
 *   - Safari: `safari-web-extension://`
 */
function isExtensionUrl(url: string): boolean {
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('safari-web-extension://')
  );
}

/**
 * Called from tab-listeners on webNavigation.onCommitted (main frame only).
 *
 * Atomic page swap:
 *   - Identifies in-flight requestIds whose chain contains the committed URL
 *     and promotes their `pendingFires` records into the current page's
 *     state with evidence='matched'.
 *   - Drops every other pending fire and resets the rest of page state
 *     (uniquesByRule, counters, fires ring, scriptable suppression).
 *
 * **Extension URL commits are a special case.** Intermediate commits to
 * chrome-extension:// pages (the delay.html page during the delay chain)
 * are transient — the final user-visible destination is whatever the
 * extension page navigates to next. Extension-URL commits reset the page
 * as normal but do NOT promote pending fires — they're abandoned along
 * with the previous page.
 */
export function onPageCommit(tabId: number, committedUrl: string): void {
  const state = tabs.get(tabId);
  if (!state) return;

  const normalized = normalizeForAttribution(committedUrl);
  const shouldPromote = !isExtensionUrl(normalized);

  const matchingRequestIds = new Set<string>();
  if (shouldPromote) {
    for (const [requestId, chain] of state.mainFrameChains) {
      if (chain.urls.has(normalized)) matchingRequestIds.add(requestId);
    }
  }

  const promoted: PendingFire[] = shouldPromote
    ? state.pendingFires.filter((f) => matchingRequestIds.has(f.requestId))
    : [];

  // Reset for the new page. Counters start fresh; the promoted fires
  // seed the new page. Cancel any in-flight fallback timers — the old
  // page's buffered observations are abandoned.
  for (const entry of state.pendingFallback.values()) {
    clearTimeout(entry.timer);
  }
  state.currentPageUrl = normalized;
  state.fires = [];
  state.counters.clear();
  state.uniquesByRule.clear();
  state.pendingFires = [];
  state.mainFrameChains.clear();
  state.pendingFallback.clear();
  state.recentScriptable.clear();
  state.seen.clear();

  for (const p of promoted) {
    appendFire(state, p.record);
    state.seen.add(`${p.record.ruleUid}:${p.requestId}`);
  }
}

/**
 * Called when a main-frame navigation fails (onErrorOccurred). The
 * request was observed by webRequest, and any rule that matched it had
 * its action applied by Chrome before the failure — the most common
 * case is `ERR_BLOCKED_BY_CLIENT`, where a DNR block rule cancelled
 * the request, but the same path covers DNS failures, TLS errors, and
 * any other terminal network error.
 *
 * The pending main-frame fires for this requestId are real — the matcher
 * ran, the rule's action was applied — so we PROMOTE them into the
 * tab's live fire log instead of dropping them. Otherwise a test session
 * with a block rule on the target URL would surface the block as
 * `no-fire` because no commit ever lands and `onPageCommit` never runs.
 *
 * The mainFrameChain entry is then released so the chain map doesn't
 * leak across the tab's lifetime.
 */
export function onMainFrameError(tabId: number, requestId: string): void {
  const state = tabs.get(tabId);
  if (!state) return;
  const promoted = state.pendingFires.filter((f) => f.requestId === requestId);
  state.pendingFires = state.pendingFires.filter((f) => f.requestId !== requestId);
  state.mainFrameChains.delete(requestId);
  for (const p of promoted) {
    appendFire(state, p.record);
    state.seen.add(`${p.record.ruleUid}:${p.requestId}`);
  }
}

// ── Reads ───────────────────────────────────────────────────────────

/**
 * Build an empty snapshot. Returned as a fresh object (not a shared frozen
 * singleton) so callers that shallow-mutate the response — e.g. pushing
 * into `fires` during unit tests — don't have to know whether they hit
 * the tracked or untracked path.
 */
function emptySnapshot(): TabTelemetrySnapshot {
  return { counters: {}, fires: [], byRule: {}, uniqueRequestCount: 0 };
}

/**
 * Full telemetry snapshot for a tab. Arrays and objects are shallow copies,
 * safe for the caller to mutate without affecting internal state.
 */
export function getTabSnapshot(tabId: number): TabTelemetrySnapshot {
  const state = tabs.get(tabId);
  if (!state) return emptySnapshot();

  const counters: Record<string, number> = {};
  for (const [uid, count] of state.counters) counters[uid] = count;

  const byRule: Record<string, RequestRecord[]> = {};
  const uniqueUrls = new Set<string>();
  for (const [uid, urlMap] of state.uniquesByRule) {
    const records: RequestRecord[] = [];
    for (const [normalized, record] of urlMap) {
      records.push(record);
      uniqueUrls.add(normalized);
    }
    byRule[uid] = records;
  }

  return {
    counters,
    fires: [...state.fires],
    byRule,
    uniqueRequestCount: uniqueUrls.size,
  };
}

/**
 * Filtered snapshot — fires and counters limited to the given rule uids.
 * Used by test-runner to build the result payload for a session.
 */
export function getTabSnapshotForScope(tabId: number, scopeUids: Set<string>): TabTelemetrySnapshot {
  const state = tabs.get(tabId);
  if (!state) return emptySnapshot();

  const fires = state.fires.filter((f) => scopeUids.has(f.ruleUid));
  const counters: Record<string, number> = {};
  const byRule: Record<string, RequestRecord[]> = {};
  const uniqueUrls = new Set<string>();
  for (const uid of scopeUids) {
    const count = state.counters.get(uid);
    if (count !== undefined) counters[uid] = count;
    const urlMap = state.uniquesByRule.get(uid);
    if (urlMap) {
      const records: RequestRecord[] = [];
      for (const [normalized, record] of urlMap) {
        records.push(record);
        uniqueUrls.add(normalized);
      }
      byRule[uid] = records;
    }
  }

  return { counters, fires, byRule, uniqueRequestCount: uniqueUrls.size };
}

// ── Test helpers ────────────────────────────────────────────────────

/** Reset all state — test-only. */
export function __resetForTests(): void {
  for (const state of tabs.values()) disposeTab(state);
  tabs.clear();
  fireListeners.clear();
  requestEventListeners.clear();
}

export const __internals = {
  get tabCount(): number {
    return tabs.size;
  },
  get MAX_FIRES_PER_TAB(): number {
    return MAX_FIRES_PER_TAB;
  },
  get MAX_UNIQUE_URLS_PER_RULE(): number {
    return MAX_UNIQUE_URLS_PER_RULE;
  },
  get FALLBACK_WINDOW_MS(): number {
    return FALLBACK_WINDOW_MS;
  },
  getState(tabId: number): TabState | undefined {
    return tabs.get(tabId);
  },
};
