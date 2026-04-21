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
 *   - Dynamic workbench are rewritten with `excludedTabIds: [...testTabIds]` while
 *     any run is active, so normal workbench keep firing on every non-test
 *     tab but skip the test tabs.
 *   - Each active run installs its own **run ruleset** built from its
 *     scope snapshot, with `tabIds: [testTabId]` on every condition, applied
 *     via `chrome.declarativeNetRequest.updateRunRules`. Delay workbench are
 *     dropped from the per-run compile while the test tab sits in
 *     `pendingDelayBypass` so the delay page's follow-up navigation can't
 *     loop on the rule it's currently testing.
 *   - inject-manager filters scriptable workbench per-tab via
 *     `getTestScopeForTab`, so scriptable workbench under test only run on their
 *     run's tab and don't leak into unrelated tabs.
 *
 * ## Telemetry
 *
 * Fires flow into the tab-telemetry service via the two always-on ingestion
 * paths (scriptable fire-bridge content script + DNR probable-fires derived
 * from webRequest matching in request-monitor). The runner subscribes to
 * `tab-telemetry.subscribeFires(tabId)` filtered to scope uids and updates
 * `liveFireCount`. There is no polling, no per-run bridge, no
 * `getMatchedRules` call.
 */

import type { V5 } from '@openheaders/core/types';
import { isRuleComplete, parseTestTargetUrl, resolvePauseState } from '@openheaders/core/utils';
import { intentToHash } from '@openheaders/core/workspace-intent';
import { broadcast } from '@utils/bridge';
import { runtime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applyAllRules, applyAllRulesAsync } from '../dnr-manager';
import { getPauseMarkers } from './pause-markers-store';
import { matchRulesToRequest } from './request-tracker';
import { getRules } from './rule-store';
import { arbitrate, type ShadowAttribution } from './shadow-arbitration';
import {
  getObservedUrls,
  getTabSnapshotForScope,
  type RequestRecord,
  startTracking,
  stopTracking,
  subscribeFires,
} from './tab-telemetry';
import { registerRun, setRunTabId, unregisterRun } from './test-run-state';
import {
  computeOwnerHash,
  persistTestRun,
  type TestFireEvent as StoredTestFireEvent,
  type TestRuleStatus as StoredTestRuleStatus,
  type StoredTestRun,
  type TestRunOwner,
} from './test-run-store';
import {
  injectTestWidget,
  type PortFinishedPayload,
  type PortMessage,
  parseTestRunPortName,
  testRunPortName,
} from './test-run-widget';

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

interface ActiveRun {
  id: string;
  owner: TestRunOwner;
  scopeLabel: string;
  /** V5 workbench snapshotted at run start — the scope under test. */
  scopeRules: V5.Rule[];
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

const activeRuns: Map<string, ActiveRun> = new Map();

/**
 * Hard wall-clock ceiling beyond the configured wait window. Covers slow page
 * loads + a generous slack so the watchdog only kicks in for truly hung tabs,
 * never to truncate a legitimate capture window.
 */
const HARD_CEILING_SLACK_MS = 20_000;

function newRunId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trackingReason(runId: string): string {
  return `test:${runId}`;
}

// ── Run-state re-exports (kept for existing importers) ──────────
// dnr-manager and inject-manager previously imported these from test-runner.
// They now live in test-run-state.ts; re-export here so the existing
// import sites don't have to move atomically.

export type { ActiveRunSnapshot } from './test-run-state';
export {
  getActiveRunSnapshots,
  getActiveTestTabIds,
  getTestScopeForTab,
  hasActiveRuns,
  isRuleUnderTest,
} from './test-run-state';

// ── Persistence ───────────────────────────────────────────────────
//
// Read/write of stored test runs now lives in test-run-store.ts — it
// owns the owner-keyed bucket layout, stale-detection hashing, and the
// storage-lock chain. The runner only calls persistTestRun and the
// store handles the rest. Listing / getById / deleting individual runs
// is exposed by message-handler directly through the store.

async function persistAndAnnounce(result: TestRun): Promise<void> {
  await persistTestRun(result);
  broadcast('testRunFinished', {
    runId: result.id,
    ownerType: result.ownerType,
    ownerId: result.ownerId,
  });
}

// ── Public start/stop API ─────────────────────────────────────────

export interface StartRunOptions {
  /** Owner of this test result — single rule, folder, or collection. */
  owner: TestRunOwner;
  /** Human-readable label for the scope — shown in the in-page widget and stored on the result. */
  scopeLabel: string;
  /** Snapshot of the rule uids in scope at the moment the test was launched. */
  ruleUids: string[];
  url: string;
  waitSeconds: number;
}

/**
 * Start a test run. Returns a promise that resolves with the final result
 * when the capture window closes.
 *
 * Setup sequence:
 *
 *   1. Snapshot scope workbench and partition them into "will execute" vs
 *      "skipped" (disabled / incomplete / paused-by-ancestor) so the result
 *      can label them honestly instead of all-or-nothing "no-fire".
 *   2. Create the tab with about:blank in the **foreground** so the user
 *      gets visual feedback. The widget will mount as soon as the real URL
 *      commits.
 *   3. Register the tab with tab-telemetry under the run tracking reason.
 *      This must happen before any request fires, so telemetry ingestion
 *      starts counting as soon as the page begins to load.
 *   4. Subscribe to tab-telemetry's fire stream filtered to scope uids, so
 *      every in-scope fire pushes a live count into the in-page widget.
 *   5. **Await** `applyAllRulesAsync()` — dynamic workbench gain
 *      `excludedTabIds:[testTabId]` and run workbench with `tabIds:[testTabId]`
 *      are installed. The await is critical: a fire-and-forget `applyAllRules`
 *      can race the navigation and let non-scope workbench fire on the test tab.
 *   6. Navigate the tab to the target URL via `tabs.update`.
 *   7. Arm a hard-ceiling watchdog tuned to `waitSeconds + slack` so a hung
 *      tab can't pin the run forever, but a legitimate slow load doesn't
 *      get truncated mid-capture.
 *
 * If any step fails, the run is torn down and the promise resolves with
 * an empty result.
 */
export function startRun(opts: StartRunOptions): Promise<TestRun> {
  return new Promise((resolve) => {
    const id = newRunId();

    // Defense-in-depth URL validation — same `parseTestTargetUrl` the
    // launcher modal uses, so a caller bypassing the modal (programmatic
    // `runtime.sendMessage`, future CLI, misbehaving E2E test) can't
    // open a tab on a malformed URL and strand the run on
    // about:blank until the hard ceiling fires. We resolve with an
    // empty result rather than throwing so the caller's promise chain
    // stays well-behaved.
    const urlResult = parseTestTargetUrl(opts.url);
    if (!urlResult.ok) {
      logger.info('TestRunner', `startRun rejected: ${urlResult.error} (input: ${opts.url})`);
      resolve(buildRejectedRun(opts, urlResult.error));
      return;
    }
    const targetUrl = urlResult.url;

    const allRules = getRules();
    const wanted = new Set(opts.ruleUids);
    const scopeRules = allRules.filter((r) => wanted.has(r.uid));

    // Step 1: identify workbench in scope that simply cannot fire — they're
    // marked 'skipped' in the result so the user understands the difference
    // between "DNR ran the rule but no request matched" and "we never tried".
    const pauseMarkers = getPauseMarkers();
    const skippedUids = new Set<string>();
    for (const rule of scopeRules) {
      if (!rule.enabled || !isRuleComplete(rule) || resolvePauseState(rule.path, pauseMarkers)) {
        skippedUids.add(rule.uid);
      }
    }
    // Clamp to the same bounds the launcher modal enforces. Defensive:
    // any caller bypassing the modal (programmatic CLI, misbehaving
    // message) still can't pin a run for an unbounded duration. The
    // hard-ceiling watchdog adds its own slack on top.
    const waitSeconds = Math.max(1, Math.min(opts.waitSeconds, 300));

    const run: ActiveRun = {
      id,
      owner: opts.owner,
      scopeLabel: opts.scopeLabel || 'rules',
      scopeRules,
      ruleUids: wanted,
      skippedUids,
      url: targetUrl,
      waitSeconds,
      tabId: null,
      startedAt: Date.now(),
      captureTimer: null,
      ceilingTimer: null,
      committed: false,
      loaded: false,
      liveFireCount: 0,
      unsubscribeFires: null,
      ports: new Set(),
      everHadPort: false,
      tabClosed: false,
      resolve,
    };
    activeRuns.set(id, run);
    registerRun({ id, scopeRules, ruleUids: wanted, tabId: null });

    // Step 2: open the tab in the BACKGROUND on about:blank. We'll activate
    // it together with the navigation to the real target in step 6 — this
    // avoids the white about:blank flash the user would otherwise see if we
    // opened active. By the time the tab is brought to the foreground, the
    // DNR isolation is already live and the navigation is in flight.
    tabs.create({ url: 'about:blank', active: false }, (tab: chrome.tabs.Tab) => {
      void launchAfterTabCreated(run, tab, targetUrl);
    });
  });
}

/**
 * Second half of `startRun` — async because we need to **await**
 * `applyAllRulesAsync()` before navigating, otherwise the first request can
 * hit the test tab before its DNR isolation has been committed by Chrome
 * (which would let unrelated user workbench fire on the test tab — exactly what
 * the scope under test should be insulated from).
 */
async function launchAfterTabCreated(run: ActiveRun, tab: chrome.tabs.Tab, targetUrl: string): Promise<void> {
  const id = run.id;
  if (!tab || typeof tab.id !== 'number') {
    logger.info('TestRunner', `Failed to open test tab for run ${id}`);
    activeRuns.delete(id);
    unregisterRun(id);
    run.resolve(buildEmptyRun(run));
    return;
  }
  const tabId = tab.id;

  run.tabId = tabId;
  setRunTabId(id, tabId);
  logger.info('TestRunner', `Run ${id} started — tab ${tabId}, url ${targetUrl}`);

  // Step 3: telemetry tracking before any request fires.
  startTracking(tabId, trackingReason(id));

  // Step 4: subscribe to in-scope fires so we can push live counts to the
  // widget over its port. The subscription persists across page commits
  // because tab-telemetry resets state on commit but keeps the listener
  // registry. Fires that arrive BEFORE any widget port has connected still
  // bump `run.liveFireCount` — the widget catches up via the
  // `snapshot` message that the port handler sends on `onConnect`.
  run.unsubscribeFires = subscribeFires(tabId, (record: RequestRecord) => {
    if (!run.ruleUids.has(record.ruleUid)) return;
    run.liveFireCount += 1;
    broadcastToRunPorts(run, { type: 'update', fires: run.liveFireCount });
  });

  // Step 5: arm the hard-ceiling watchdog BEFORE the await so a hung
  // `applyAllRulesAsync` can't pin the run forever. Tuned so the
  // worst-case (slow page + full capture window) lands well within budget.
  run.ceilingTimer = setTimeout(
    () => {
      if (activeRuns.has(id)) {
        logger.info('TestRunner', `Run ${id} hit hard ceiling`);
        finishRun(id);
      }
    },
    run.waitSeconds * 1000 + HARD_CEILING_SLACK_MS,
  );

  // Step 6: install DNR isolation and WAIT for it to be live in Chrome
  // before kicking off the navigation. Audit bug #1 fix — without the
  // await, the first request on the test tab can race the rule install
  // and let non-scope workbench fire on the test tab.
  try {
    await applyAllRulesAsync();
  } catch (err) {
    logger.info('TestRunner', `applyAllRulesAsync failed for run ${id}: ${(err as Error).message}`);
    finishRun(id);
    return;
  }

  // The user may have closed the test tab while we were waiting for the
  // DNR install. `tabs.onRemoved` → `onTabRemoved` already finalised the
  // run via `finishRun`, so don't navigate a dead tab or arm
  // anything else.
  if (!activeRuns.has(id)) return;

  // Step 7: navigate AND bring the tab to the foreground in a single
  // update. By the time the user sees the test tab pop into focus, it's
  // already navigating to the target — no white about:blank flash.
  tabs.update(tabId, { url: targetUrl, active: true }, () => {
    if (runtime.lastError) {
      logger.info('TestRunner', `Failed to navigate test tab to ${targetUrl}: ${runtime.lastError.message}`);
    }
  });
}

/**
 * Called from tab-listeners on every main-frame `webNavigation.onCommitted`.
 * Mounts the in-page widget on every commit that lands on the actual test
 * target — `about:blank` and `chrome-extension://` (e.g. delay.html during
 * a delay-rule test) commits are skipped because they don't host the page
 * the user is testing.
 *
 * We re-inject on EVERY non-internal commit (not just the first) so that a
 * hard navigation during the capture window — user clicks a link, page
 * does a real `location.href` — re-mounts the widget on the new document.
 * The widget self-dedupes via its host element's stored cleanup hook.
 */
export function onTabCommit(tabId: number, committedUrl: string): void {
  for (const run of activeRuns.values()) {
    if (run.tabId !== tabId) continue;
    if (isInternalUrl(committedUrl)) continue;
    // First real-URL commit unlocks `onTabLoaded` to start the capture
    // window. Errored navigations never get a commit (chrome-error pages
    // don't fire `webNavigation.onCommitted`), so the capture timer is
    // never armed by the success path and `onTabError` owns the grace.
    run.committed = true;
    const reportUrl = buildReportUrl(run.id);
    void injectTestWidget(tabId, {
      runId: run.id,
      scopeLabel: run.scopeLabel,
      ruleCount: run.ruleUids.size,
      waitSeconds: run.waitSeconds,
      reportUrl,
      startedAtMs: run.startedAt,
      portName: testRunPortName(run.id),
    });
  }
}

function isInternalUrl(url: string): boolean {
  return (
    url === 'about:blank' ||
    url.startsWith('about:') ||
    url.startsWith('chrome:') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('extension://') ||
    url.startsWith('safari-web-extension://')
  );
}

function buildReportUrl(runId: string): string {
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

// ── Widget port subscription ─────────────────────────────────────
//
// The in-page widget connects via `chrome.runtime.connect({ name })` on
// mount. We listen for that connection here, post a snapshot of the
// run's current `liveFireCount`, and remember the port so the
// telemetry subscriber and finish path can post deltas / the terminal
// payload to it.
//
// Why a port and not `tabs.sendMessage`: the widget mounts AFTER the
// fires that need to be displayed have already been promoted by
// `tab-telemetry.onPageCommit`. A push-based design loses those early
// fires because no listener exists yet. With a port, the widget signals
// "I'm ready" by connecting, and the snapshot we post in response is
// guaranteed (by the port's FIFO ordering) to land before any subsequent
// delta — so the user sees an accurate count from the moment the widget
// renders.

function broadcastToRunPorts(run: ActiveRun, message: PortMessage): void {
  for (const port of run.ports) {
    try {
      port.postMessage(message);
    } catch {
      // Disconnected port — `onDisconnect` will remove it from the set.
    }
  }
}

/**
 * Register the `runtime.onConnect` handler that accepts widget ports.
 * Idempotent: safe to call multiple times. Called once at extension
 * startup from `background.ts`.
 */
let portsSetupDone = false;
export function setupTestRunnerPorts(): void {
  if (portsSetupDone) return;
  portsSetupDone = true;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('TestRunner', 'runtime.onConnect unavailable — widget ports disabled');
    return;
  }
  chrome.runtime.onConnect.addListener((port) => {
    const runId = parseTestRunPortName(port.name);
    if (!runId) return; // Not one of ours.
    const run = activeRuns.get(runId);
    if (!run) {
      // Stale connect — run has already finished. Closing the port
      // signals to the widget that there's nothing to subscribe to.
      try {
        port.disconnect();
      } catch {
        // No-op
      }
      return;
    }

    run.ports.add(port);
    run.everHadPort = true;
    port.onDisconnect.addListener(() => {
      run.ports.delete(port);
    });

    // Snapshot of current state — the widget will draw the right fire
    // count from the moment its first render runs, even if many fires
    // were promoted before it mounted.
    try {
      port.postMessage({ type: 'snapshot', fires: run.liveFireCount, phase: 'capturing' });
    } catch {
      run.ports.delete(port);
    }
  });
}

/**
 * Called from tab-listeners when a tab is closed (manually by the user, by
 * extension crash, or by our own teardown). Finishes any run watching
 * that tab so DNR run workbench are cleared and the promise resolves.
 */
export function onTabRemoved(tabId: number): void {
  for (const run of activeRuns.values()) {
    if (run.tabId === tabId) {
      logger.info('TestRunner', `Run ${run.id} tab ${tabId} closed — finishing`);
      // Mark BEFORE finishRun so the post-persist fallback-navigate
      // path sees it and doesn't try to drive a closed tab (or — worse —
      // re-open the workspace results page on a user who explicitly
      // closed the tab to bail out of the run).
      run.tabClosed = true;
      finishRun(run.id);
    }
  }
}

/**
 * Called from tab-listeners when a test tab's main-frame navigation
 * errors out (typically `ERR_BLOCKED_BY_CLIENT` because a block rule
 * under test cancelled the request, but covers any terminal network
 * error). The widget will never mount on a Chrome error page —
 * `chrome-error://chromewebdata/` is a privileged surface that rejects
 * content scripts — so the test run has no in-page UI path forward.
 *
 * Two cases:
 *
 *   1. **Run never committed to a real URL** — this is the initial
 *      navigation and it failed before commit (block, DNS, TLS, etc.).
 *      `onTabLoaded`'s `committed` guard means no capture timer has
 *      been armed yet, so we arm one here for the user's full
 *      `waitSeconds`. The user gets their chosen test-duration to look
 *      at the error page ("yes, my block rule fired") before
 *      `finishRun` navigates the test tab to the workspace results
 *      report (`everHadPort` will be false because no widget mounted).
 *
 *   2. **Run already committed and capturing** — the user navigated
 *      somewhere within the test tab via JS / link click, and that
 *      *secondary* navigation errored. The existing capture timer is
 *      already counting down for the user's chosen `waitSeconds`; we
 *      leave it alone. The run finishes naturally.
 */
export function onTabError(tabId: number): void {
  for (const run of activeRuns.values()) {
    if (run.tabId !== tabId) continue;
    if (run.committed) {
      logger.debug('TestRunner', `Run ${run.id} tab ${tabId} secondary nav errored — capture timer keeps running`);
      continue;
    }
    if (run.captureTimer) continue; // grace already armed by an earlier error event
    logger.info(
      'TestRunner',
      `Run ${run.id} tab ${tabId} initial navigation errored — grace ${run.waitSeconds}s then finish`,
    );
    run.loaded = true;
    run.captureTimer = setTimeout(() => finishRun(run.id), run.waitSeconds * 1000);
  }
}

/**
 * Called from tab-listeners when a tab reaches `tabs.onUpdated` `complete`.
 * Starts the capture window timer — but ONLY if the tab actually committed
 * to a real URL first. Chrome reports `complete` for its built-in error
 * pages too, so without the `committed` guard a blocked navigation would
 * start the user's full-length capture window on the chrome-error page,
 * stranding the run there until the timer expired and bypassing
 * `onTabError`'s short-grace path.
 */
export function onTabLoaded(tabId: number): void {
  for (const run of activeRuns.values()) {
    if (run.tabId !== tabId) continue;
    if (run.loaded) continue;
    if (!run.committed) {
      logger.debug('TestRunner', `Run ${run.id} tab reported complete without commit — deferring to onTabError`);
      continue;
    }
    run.loaded = true;
    run.captureTimer = setTimeout(() => finishRun(run.id), run.waitSeconds * 1000);
    logger.debug('TestRunner', `Run ${run.id} tab loaded — capturing for ${run.waitSeconds}s`);
  }
}

// ── Finish + result building ──────────────────────────────────────

function finishRun(id: string): void {
  const run = activeRuns.get(id);
  if (!run) return;
  activeRuns.delete(id);

  if (run.captureTimer) clearTimeout(run.captureTimer);
  if (run.ceilingTimer) clearTimeout(run.ceilingTimer);

  if (run.unsubscribeFires) {
    run.unsubscribeFires();
    run.unsubscribeFires = null;
  }

  // Build the result BEFORE we tear down telemetry / DNR state — the
  // snapshot needs the in-flight fire log intact.
  const result = buildRun(run);

  // Stop tab-telemetry tracking for this run's reason. The active-tab
  // tracking from tab-listeners keeps state alive while the user has the
  // test tab focused, so the telemetry the workspace report later reads
  // is preserved.
  if (run.tabId != null) {
    stopTracking(run.tabId, trackingReason(id));
  }
  unregisterRun(id);

  // Re-apply the DNR state now that this run is gone — clears its
  // run workbench and removes this tabId from dynamic workbench' excludedTabIds.
  applyAllRules();

  logger.info(
    'TestRunner',
    `Run ${run.id} finished — ${result.fires.length} fires across ${
      new Set(result.fires.map((f) => f.ruleUid)).size
    }/${run.ruleUids.size} rules`,
  );

  const executed = Object.values(result.ruleStatuses).filter((s) => s === 'executed').length;
  const noFire = Object.values(result.ruleStatuses).filter((s) => s === 'no-fire').length;
  const finishedPayload: PortFinishedPayload = {
    fires: result.fires.length,
    executed,
    noFire,
  };

  // Persist FIRST, then notify the widget. The widget's "View results"
  // button navigates to `workbench.html#/test/<id>` which immediately
  // reads the run via `getStoredRun`; if we pushed `finished`
  // before persistence completed the user could click into a "run
  // not found" error. Once persistence resolves, broadcast the terminal
  // payload over every connected port and tear them down so any new
  // connect attempt cleanly disconnects.
  //
  // Fallback path: if no widget port ever connected during this run
  // (the test target errored before commit, was a privileged URL,
  // sandboxed, etc.) the user has no in-page surface to click "View
  // results" on. The workspace report is the source of truth and is
  // already persisted, so we navigate the still-living test tab to it
  // directly. The user opened a tab expecting test results — they get
  // test results, just without the intermediate widget step.
  void persistAndAnnounce(result).then(() => {
    broadcastToRunPorts(run, { type: 'finished', ...finishedPayload });
    for (const port of run.ports) {
      try {
        port.disconnect();
      } catch {
        // No-op
      }
    }
    run.ports.clear();

    if (!run.everHadPort && !run.tabClosed && run.tabId != null) {
      const reportUrl = buildReportUrl(run.id);
      tabs.update(run.tabId, { url: reportUrl, active: true }, () => {
        if (runtime.lastError) {
          // Tiny race: user closed the tab AFTER finishRun started
          // but BEFORE persist resolved. The tabClosed flag won't be set
          // (onTabRemoved no longer finds the run in activeRuns),
          // so we still try the navigate and Chrome rejects it. Log and
          // move on — the report is persisted, the user can still reach
          // it via the test history list whenever they want.
          logger.info(
            'TestRunner',
            `Fallback navigate to results failed for run ${run.id}: ${runtime.lastError.message}`,
          );
        }
      });
    }
  });

  run.resolve(result);
}

function buildRun(run: ActiveRun): TestRun {
  const snapshotFires = run.tabId != null ? getTabSnapshotForScope(run.tabId, run.ruleUids).fires : [];
  // RequestRecord has extra fields (pattern, resourceType) that TestFireEvent
  // doesn't care about; project to the stable run-result shape. Carry
  // `shadowedBy` through so the workspace can render shadowed workbench with
  // their amber outcome instead of an unqualified "executed" badge.
  const fires: TestFireEvent[] = snapshotFires.map((r) => ({
    ruleUid: r.ruleUid,
    url: r.url,
    evidence: r.evidence,
    t: r.t,
    ...(r.shadowedBy ? { shadowedBy: r.shadowedBy } : {}),
  }));
  const firedUids = new Set(fires.map((f) => f.ruleUid));
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of run.ruleUids) {
    if (run.skippedUids.has(uid)) {
      ruleStatuses[uid] = 'skipped';
    } else if (firedUids.has(uid)) {
      ruleStatuses[uid] = 'executed';
    } else {
      ruleStatuses[uid] = 'no-fire';
    }
  }

  // Static arbitration pass over the full observed-URL set. For every
  // no-fire rule in scope, check whether any URL the tab hit during the
  // run would have put it into a matching set where a sibling rule
  // (block / redirect / query-param / mock / delay) shadowed it. The
  // first matching URL's attribution wins — we're only trying to give
  // the user a reason, not enumerate every conflict.
  //
  // This catches the case where a fire record was lost because commit
  // attribution abandoned it — e.g. inject on *.openheaders.io/v1/page
  // matches at onBeforeRequest time, gets `shadowedBy: delay` from the
  // per-hop arbitrator, is buffered in pendingFires, and then dropped
  // when the main frame commits to delay.html instead of the user URL.
  // Without this pass the rule surfaces as no-fire with no attribution.
  const noFireReasons: Record<string, ShadowAttribution> = {};
  if (run.tabId != null) {
    const observedUrls = getObservedUrls(run.tabId);
    if (observedUrls.length > 0) {
      for (const uid of run.ruleUids) {
        if (ruleStatuses[uid] !== 'no-fire') continue;
        for (const url of observedUrls) {
          const arbitrated = arbitrate(matchRulesToRequest(url));
          const self = arbitrated.find((r) => r.uid === uid);
          if (self?.shadowedBy) {
            noFireReasons[uid] = self.shadowedBy;
            break;
          }
        }
      }
    }
  }

  return {
    id: run.id,
    ownerType: run.owner.type,
    ownerId: run.owner.id,
    ownerNameAtRun: run.scopeLabel,
    ruleUids: [...run.ruleUids],
    url: run.url,
    startedAt: run.startedAt,
    endedAt: Date.now(),
    waitSeconds: run.waitSeconds,
    fires,
    ruleStatuses,
    ...(Object.keys(noFireReasons).length > 0 ? { noFireReasons } : {}),
    ownerHashAtRun: computeOwnerHash(run.owner) ?? '',
  };
}

function buildEmptyRun(run: ActiveRun): TestRun {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of run.ruleUids) {
    ruleStatuses[uid] = run.skippedUids.has(uid) ? 'skipped' : 'no-fire';
  }
  return {
    id: run.id,
    ownerType: run.owner.type,
    ownerId: run.owner.id,
    ownerNameAtRun: run.scopeLabel,
    ruleUids: [...run.ruleUids],
    url: run.url,
    startedAt: run.startedAt,
    endedAt: Date.now(),
    waitSeconds: run.waitSeconds,
    fires: [],
    ruleStatuses,
    ownerHashAtRun: computeOwnerHash(run.owner) ?? '',
  };
}

/**
 * Build a synthetic empty result for a run that was rejected at the
 * gate (currently only: invalid URL). No tab is opened, no telemetry is
 * captured, no DNR isolation is installed — we just want a well-formed
 * result so the caller's promise resolves cleanly. All scope workbench are
 * marked `no-fire` (or `skipped` if disabled / incomplete from the
 * outset). The reason text is logged but not surfaced through the result
 * shape; surfacing it would require a new field on `TestRun`,
 * and the popup launcher already shows the same text via its own
 * synchronous `parseTestTargetUrl` call before sending the message.
 */
function buildRejectedRun(opts: StartRunOptions, _reason: string): TestRun {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of opts.ruleUids) {
    ruleStatuses[uid] = 'no-fire';
  }
  const now = Date.now();
  return {
    id: newRunId(),
    ownerType: opts.owner.type,
    ownerId: opts.owner.id,
    ownerNameAtRun: opts.scopeLabel,
    ruleUids: [...opts.ruleUids],
    url: opts.url,
    startedAt: now,
    endedAt: now,
    waitSeconds: Math.max(1, Math.min(opts.waitSeconds, 300)),
    fires: [],
    ruleStatuses,
    ownerHashAtRun: computeOwnerHash(opts.owner) ?? '',
  };
}
