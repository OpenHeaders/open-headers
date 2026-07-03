/**
 * Finish path — tears a run down (timers, fire subscription, telemetry
 * tracking, DNR run rules), builds + persists the result, then
 * broadcasts the terminal payload to the widget ports (persist-before-
 * broadcast, see the ordering note on `finishRun`).
 */

import { unregisterRun } from '@openheaders/oracle/test-run/test-run-state';
import { persistTestRun } from '@openheaders/oracle/test-run/test-run-store';
import { broadcast } from '@utils/bridge';
import { runtime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applyAllRules } from '../../dnr-manager';
import { stopTracking } from '../tab-telemetry';
import type { PortFinishedPayload } from '../test-run-widget';
import { buildRun } from './results';
import { activeRuns, buildReportUrl, type TestRun, trackingReason } from './run-registry';
import { broadcastToRunPorts } from './widget-ports';

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

export function finishRun(id: string): void {
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
  // run rules and removes this tabId from dynamic rules' excludedTabIds.
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
