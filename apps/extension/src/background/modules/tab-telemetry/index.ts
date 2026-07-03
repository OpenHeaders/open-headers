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

export type { DeliveryMode, Evidence, RequestRecord, TabTelemetrySnapshot } from '@openheaders/core/types';
export { recordObservedFire, recordReportedFire, recordScriptableFire } from './ingestion';
export { onMainFrameError, onPageCommit, updateRequestDeliveryMode } from './page-context';
export { getTabSnapshot, getTabSnapshotForScope } from './reads';
export {
  __internals,
  __resetForTests,
  clearTab,
  isTracked,
  startTracking,
  stopTracking,
  subscribeFires,
  subscribeFiresAll,
} from './state';
export type { ObservedFireMeta, ScriptableFireMeta, TrackingReason } from './types';
