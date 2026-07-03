/**
 * Page-context attribution + delivery-mode back-fill — the atomic page
 * swap on commit, the failed-main-frame promotion path, and the
 * per-requestId delivery-mode update the lifecycle projection drives.
 */

import type { DeliveryMode } from '@openheaders/core/types';
import { appendFire } from './ingestion';
import { normalizeForAttribution, type PendingFire, tabs } from './state';

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
