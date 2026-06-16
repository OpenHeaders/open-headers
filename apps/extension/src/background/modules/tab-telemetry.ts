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

import type { DeliveryMode, Evidence, RequestRecord, TabTelemetrySnapshot } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { getResolvedRules } from '@openheaders/oracle/rule-engine/variables-resolver';
import { logger } from '@utils/logger';
import type { TrackedResourceType } from '@/types/browser';
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
   * response, inject, header with header-merge). Gates the 500ms buffer. Pure DNR
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
  pendingFallback: Map<string, PendingFallback>;
  /** Map<`${uid}:${normalizedUrl}`, expiryMs>. Suppresses late observed fires. */
  recentScriptable: Map<string, number>;
  /** `${uid}:${requestId}` — observed-fire dedup across redirect chains. */
  seen: Set<string>;
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

function emptyState(tabId: number): TabState {
  return {
    tabId,
    reasons: new Set(),
    currentPageUrl: null,
    fires: [],
    counters: new Map(),
    uniquesByRule: new Map(),
    pendingFires: [],
    pendingFallback: new Map(),
    recentScriptable: new Map(),
    seen: new Set(),
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
 * Network identity for a scriptable fire — the `requestId` (and the
 * observed resource type) of the webRequest/CDP observation the in-page
 * confirmation corresponds to. Looked up in adoption order: the drained
 * fallback record, the pending main-frame buffer, then the promoted fire
 * log (a confirmation arriving after the fallback window). Without it
 * the confirmed record has no row to attach to in the inspector; with
 * it, the panel-side merge upgrades the request's own fire to ground
 * truth. `null` when no observation exists for this (rule, url).
 */
function adoptNetworkIdentity(
  state: TabState,
  ruleUid: string,
  normalizedUrl: string,
  drained: RequestRecord | undefined,
): Pick<RequestRecord, 'requestId' | 'resourceType'> | null {
  if (drained?.requestId) return { requestId: drained.requestId, resourceType: drained.resourceType };
  for (const p of state.pendingFires) {
    if (p.record.ruleUid === ruleUid && normalizeForAttribution(p.record.url) === normalizedUrl) {
      return { requestId: p.requestId, resourceType: p.record.resourceType };
    }
  }
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const f = state.fires[i];
    if (f.ruleUid === ruleUid && f.requestId && normalizeForAttribution(f.url) === normalizedUrl) {
      return { requestId: f.requestId, resourceType: f.resourceType };
    }
  }
  return null;
}

/**
 * Record a scriptable fire reported by the in-page fire-bridge. Always
 * attributed to the current tab's page. If a matching observed fire is
 * currently buffered in `pendingFallback`, the scriptable drains it so the
 * same action isn't counted twice. A short suppression window is set so a
 * late observed fire for the same (rule, url) within the window is also
 * dropped. The confirmed record adopts the network identity of the
 * observation it corresponds to (see `adoptNetworkIdentity`). No-op for
 * untracked tabs.
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

  const identity = adoptNetworkIdentity(state, ruleUid, normalized, pending?.record);
  const record: RequestRecord = {
    ruleUid,
    url,
    pattern: meta.pattern,
    resourceType: identity?.resourceType ?? meta.resourceType,
    t,
    evidence: 'confirmed',
    ...(identity ? { requestId: identity.requestId } : {}),
  };
  appendFire(state, record);
}

/**
 * Record a scriptable fire reported by an in-page wrapper, resolving the URL
 * pattern it matched. The single intake for both delivery channels: the
 * `postMessage` fire-bridge (`tabFire`) on un-armed tabs, and the private
 * `Runtime.addBinding` channel (E4) on CDP-attached tabs. Always attributed
 * `xmlhttprequest` (these are fetch/XHR/ws/sse wrappers); a no-pattern match
 * falls back to `*`. No-op for untracked tabs.
 */
export function recordReportedFire(tabId: number, ruleUid: string, url: string, t: number): void {
  logger.info('TabFire', `tab ${tabId} scriptable ${ruleUid} ${url}`);
  const pattern = findMatchingPattern(ruleUid, url) ?? '*';
  recordScriptableFire(tabId, ruleUid, url, t, { pattern, resourceType: 'xmlhttprequest' });
}

/** Resolve the URL-condition pattern a scriptable rule matched against. Matches
 *  against the resolved rule — raw `{{VAR}}` URL tokens never match a real
 *  request URL — falling through to the raw store before the first compile. */
function findMatchingPattern(ruleUid: string, url: string): string | undefined {
  const resolved = getResolvedRules();
  const pool = resolved.length > 0 ? resolved : getRules();
  const rule = pool.find((r) => r.uid === ruleUid);
  if (!rule) return undefined;
  for (const entry of getRuleMatchPatterns(rule)) {
    if (doesUrlMatchEntry(url, entry)) return entry.pattern;
  }
  return undefined;
}

// ── Delivery-mode back-fill ─────────────────────────────────────────

/**
 * Back-fill the delivery mode on every record for a given requestId.
 * Called from the tab-telemetry-source projection once the lifecycle
 * pipeline reports whether the response was cache-served. Walks each
 * place a record can live (pending main-frame queue, pending fallback buffer,
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

/**
 * Called from tab-listeners on webNavigation.onCommitted (main frame only).
 *
 * Atomic page swap:
 *   - Promotes every pending main-frame fire whose requestId is in the
 *     caller-supplied `matchingRequestIds` set into the current page's
 *     state with evidence='matched'.
 *   - Drops every other pending fire and resets the rest of page state
 *     (uniquesByRule, counters, fires ring, scriptable suppression).
 *
 * The caller derives `matchingRequestIds` from the lifecycle store via
 * `mainFrameRequestIdsMatchingCommit` — this module no longer maintains
 * a parallel chain index. Extension-URL commits (chrome-extension://,
 * etc.) are handled inside that helper, which returns an empty set so
 * the promotion loop is a no-op while the rest of the reset proceeds.
 */
export function onPageCommit(tabId: number, committedUrl: string, matchingRequestIds: ReadonlySet<string>): void {
  const state = tabs.get(tabId);
  if (!state) return;

  const normalized = normalizeForAttribution(committedUrl);
  const promoted: PendingFire[] = state.pendingFires.filter((f) => matchingRequestIds.has(f.requestId));

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
 */
export function onMainFrameError(tabId: number, requestId: string): void {
  const state = tabs.get(tabId);
  if (!state) return;
  const promoted = state.pendingFires.filter((f) => f.requestId === requestId);
  state.pendingFires = state.pendingFires.filter((f) => f.requestId !== requestId);
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
