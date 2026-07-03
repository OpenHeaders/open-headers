/**
 * Test Runner — orchestrates a test run against a URL.
 *
 * ## Lifecycle
 *
 *   1. `startRun` snapshots the scope (and partitions it into runnable
 *      vs. skipped uids), opens a hidden tab on `about:blank`, registers
 *      tab-telemetry tracking, subscribes to in-scope fires, **awaits**
 *      `applyAllRulesAsync()` so DNR isolation is live in Chrome before
 *      navigation, then calls `tabs.update({ url, active: true })` —
 *      foreground activation and navigation happen in one update so the
 *      user never sees an `about:blank` flash.
 *   2. `tab-listeners` calls `onTabCommit(tabId, url)` for every main-frame
 *      `webNavigation.onCommitted`. We mount the in-page widget on every
 *      non-internal commit so a hard navigation during the capture window
 *      re-mounts the widget on the new document — the widget self-dedupes
 *      via a cleanup hook stored on its host element.
 *   3. The widget connects via `chrome.runtime.connect({ name })` on mount.
 *      `setupTestRunnerPorts` accepts that connection, posts a snapshot of
 *      the current `liveFireCount`, and registers the port for live
 *      delta broadcasts. FIFO ordering on the port guarantees the snapshot
 *      lands before any subsequent delta — fires that arrive before the
 *      widget exists are reflected in the snapshot, not lost.
 *   4. The capture timer fires `waitSeconds` after page load (or the hard
 *      ceiling fires if the page hangs). `finishRun` builds the result,
 *      persists it FIRST, then broadcasts `finished` to every connected
 *      port and disconnects them. The persist-before-broadcast order is
 *      critical: the widget's "View results" button immediately reads
 *      `getStoredRun`, so the broadcast cannot precede the storage
 *      write or the user could click into a "run not found" error.
 *
 * ## Isolation
 *
 *   - Dynamic rules are rewritten with `excludedTabIds: [...testTabIds]` while
 *     any run is active, so normal rules keep firing on every non-test
 *     tab but skip the test tabs.
 *   - Each active run installs its own **run ruleset** built from its
 *     scope snapshot, with `tabIds: [testTabId]` on every condition, applied
 *     via `chrome.declarativeNetRequest.updateRunRules`. Delay rules are
 *     dropped from the per-run compile while the test tab sits in
 *     `pendingDelayBypass` so the delay page's follow-up navigation can't
 *     loop on the rule it's currently testing.
 *   - inject-manager filters scriptable rules per-tab via
 *     `getTestScopeForTab`, so scriptable rules under test only run on their
 *     run's tab and don't leak into unrelated tabs.
 *
 * ## Telemetry
 *
 * Fires flow into the tab-telemetry service via the two always-on ingestion
 * paths (scriptable fire-bridge content script + DNR probable-fires derived
 * from the lifecycle pipeline's started updates via fire-recorder). The
 * runner subscribes to
 * `tab-telemetry.subscribeFires(tabId)` filtered to scope uids and updates
 * `liveFireCount`. There is no polling, no per-run bridge, no
 * `getMatchedRules` call.
 */

// ── Run-state re-exports (kept for existing importers) ──────────
// dnr-manager and inject-manager previously imported these from test-runner.
// They now live in test-run-state.ts; re-export here so the existing
// import sites don't have to move atomically.

export type { ActiveRunSnapshot } from '@openheaders/oracle/test-run/test-run-state';
export {
  getActiveRunSnapshots,
  getActiveTestTabIds,
  getTestScopeForTab,
  hasActiveRuns,
  isRuleUnderTest,
} from '@openheaders/oracle/test-run/test-run-state';
export type { TestFireEvent, TestRuleStatus, TestRun } from './run-registry';
export { type StartRunOptions, startRun } from './start';
export { onTabCommit, onTabError, onTabLoaded, onTabRemoved } from './tab-events';
export { type SetupTestRunnerPortsOptions, setupTestRunnerPorts } from './widget-ports';
