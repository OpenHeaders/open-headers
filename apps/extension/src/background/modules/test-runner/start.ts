/**
 * Start path — validates and snapshots the scope, opens the hidden
 * test tab, registers telemetry tracking + the fire subscription,
 * awaits DNR isolation, then navigates + foregrounds the tab (see the
 * step-by-step sequence on `startRun`).
 */

import { isRuleComplete, parseTestTargetUrl, resolvePauseState } from '@openheaders/core/utils';
import { getPauseMarkers } from '@openheaders/oracle/entity/pause-markers-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { registerRun, setRunTabId, unregisterRun } from '@openheaders/oracle/test-run/test-run-state';
import type { TestRunOwner } from '@openheaders/oracle/test-run/test-run-store';
import { runtime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applyAllRulesAsync } from '../../dnr-manager';
import { type RequestRecord, startTracking, subscribeFires } from '../tab-telemetry';
import { finishRun } from './finish';
import { buildEmptyRun, buildRejectedRun } from './results';
import { type ActiveRun, activeRuns, newRunId, type TestRun, trackingReason } from './run-registry';
import { broadcastToRunPorts } from './widget-ports';

/**
 * Hard wall-clock ceiling beyond the configured wait window. Covers slow page
 * loads + a generous slack so the watchdog only kicks in for truly hung tabs,
 * never to truncate a legitimate capture window.
 */
const HARD_CEILING_SLACK_MS = 20_000;

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
 *   1. Snapshot scope rules and partition them into "will execute" vs
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
 *   5. **Await** `applyAllRulesAsync()` — dynamic rules gain
 *      `excludedTabIds:[testTabId]` and run rules with `tabIds:[testTabId]`
 *      are installed. The await is critical: a fire-and-forget `applyAllRules`
 *      can race the navigation and let non-scope rules fire on the test tab.
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

    // Step 1: identify rules in scope that simply cannot fire — they're
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
 * (which would let unrelated user rules fire on the test tab — exactly what
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
  // and let non-scope rules fire on the test tab.
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
