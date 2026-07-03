/**
 * Fire ingestion — observed (webRequest) and scriptable (fire-bridge /
 * CDP binding) fire intake: dedup, the deferred-type fallback buffer,
 * scriptable-wins suppression, network-identity adoption, and the
 * append path that feeds counters + LRU uniques + the fire ring.
 */

import type { Evidence, RequestRecord } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { getResolvedRules } from '@openheaders/oracle/rule-engine/variables-resolver';
import { logger } from '@utils/logger';
import {
  emitFire,
  FALLBACK_WINDOW_MS,
  fallbackKey,
  MAX_FIRES_PER_TAB,
  MAX_UNIQUE_URLS_PER_RULE,
  normalizeForAttribution,
  type TabState,
  tabs,
} from './state';
import type { ObservedFireMeta, ScriptableFireMeta } from './types';

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

export function appendFire(state: TabState, record: RequestRecord): void {
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
