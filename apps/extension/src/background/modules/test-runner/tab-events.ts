/**
 * Tab lifecycle handlers — called from tab-listeners for the test tab's
 * commit / load / error / removal events. Commit re-mounts the in-page
 * widget; load arms the capture timer; error owns the pre-commit grace
 * path; removal finishes the run.
 */

import { logger } from '@utils/logger';
import { injectTestWidget, testRunPortName } from '../test-run-widget';
import { finishRun } from './finish';
import { activeRuns, buildReportUrl } from './run-registry';

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

/**
 * Called from tab-listeners when a tab is closed (manually by the user, by
 * extension crash, or by our own teardown). Finishes any run watching
 * that tab so DNR run rules are cleared and the promise resolves.
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
