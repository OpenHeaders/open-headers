/**
 * Run registry — the public result-shape aliases, the `ActiveRun`
 * record, and the `activeRuns` map every other test-runner module
 * coordinates through, plus the small id/reason/report-URL helpers
 * shared across the start, tab-event, and finish paths.
 */

import type { Rule } from '@openheaders/core/types';
import { intentToHash } from '@openheaders/core/workspace-intent';
import type {
  TestFireEvent as StoredTestFireEvent,
  TestRuleStatus as StoredTestRuleStatus,
  StoredTestRun,
  TestRunOwner,
} from '@openheaders/oracle/test-run/test-run-store';
import { runtime } from '@utils/browser-api';

// ── Public types ──────────────────────────────────────────────────

/** Per-rule status at the end of a run. Re-exported from store for callers. */
export type TestRuleStatus = StoredTestRuleStatus;

/** A single rule fire event captured during a run. Re-exported from store. */
export type TestFireEvent = StoredTestFireEvent;

/**
 * The result of a test run. Identical to the persisted shape from
 * test-run-store — keeping a single shape avoids the renderer and
 * background drifting on field names.
 */
export type TestRun = StoredTestRun;

// ── Internals ─────────────────────────────────────────────────────

export interface ActiveRun {
  id: string;
  owner: TestRunOwner;
  scopeLabel: string;
  /** rules snapshotted at run start — the scope under test. */
  scopeRules: Rule[];
  ruleUids: Set<string>;
  /**
   * Rules in the scope that won't actually run during this run — disabled,
   * incomplete, or under a paused group at run start. Marked 'skipped' in
   * the result rather than mislabelled as 'no-fire'.
   */
  skippedUids: Set<string>;
  url: string;
  waitSeconds: number;
  tabId: number | null;
  startedAt: number;
  /** Timer that fires when the capture window elapses after page load. */
  captureTimer: ReturnType<typeof setTimeout> | null;
  /** Hard-ceiling watchdog so a hung navigation doesn't pin the run. */
  ceilingTimer: ReturnType<typeof setTimeout> | null;
  /**
   * True once `webNavigation.onCommitted` has landed for this tab on a
   * non-internal URL. Distinct from `loaded` because Chrome reports
   * `tabs.onUpdated` `status: 'complete'` for its built-in error pages
   * (`chrome-error://chromewebdata/`) too — without this guard, an
   * errored navigation would falsely start the user's full-length
   * capture window and our `onTabError` grace path would never run.
   */
  committed: boolean;
  /** Set once the tab has reached the load event AND committed to a real URL. */
  loaded: boolean;
  /** Live count of in-scope fires — driven by the tab-telemetry subscriber. */
  liveFireCount: number;
  /** Disposer for the tab-telemetry fire subscription. */
  unsubscribeFires: (() => void) | null;
  /**
   * Long-lived ports opened by widget instances on the test tab. Multiple
   * may exist briefly after a re-injection during the capture window —
   * the runner posts to all of them and removes each on disconnect.
   */
  ports: Set<chrome.runtime.Port>;
  /**
   * True once any widget port has connected during this run. Tracked
   * separately from `ports.size` because ports can disconnect before
   * finish; we use this at finish time to decide whether to fall back to
   * navigating the test tab to the results page (no widget ever showed
   * up → user has no other way to reach the report — happens when the
   * target URL errors before commit, e.g. a block rule under test).
   */
  everHadPort: boolean;
  /**
   * Set in `onTabRemoved` before the cascading `finishRun` call, so
   * the post-persist fallback-navigate logic knows the tab is already
   * gone and skips trying to drive it. Without this we'd attempt to
   * `tabs.update` a closed tab AND — worse — re-open the workspace
   * results page on the user who deliberately closed the tab to bail.
   */
  tabClosed: boolean;
  /** Resolver for the start() promise — called with the final result. */
  resolve: (result: TestRun) => void;
}

export const activeRuns: Map<string, ActiveRun> = new Map();

export function newRunId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function trackingReason(runId: string): string {
  return `test:${runId}`;
}

export function buildReportUrl(runId: string): string {
  // Use the intent codec so the URL format stays in lockstep with the
  // workspace's router — if the encoding ever changes, the schema +
  // codec roll it forward together rather than this one hardcoded
  // string drifting silently.
  const hash = intentToHash({ kind: 'open-run-report', runId });
  try {
    return runtime.getURL(`workbench.html${hash}`);
  } catch {
    return `workbench.html${hash}`;
  }
}
