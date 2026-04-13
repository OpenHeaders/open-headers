/**
 * Test Runner — orchestrates a test session against a URL.
 *
 * ## Lifecycle
 *
 *   1. `startSession` snapshots the scope (and partitions it into runnable
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
 *      ceiling fires if the page hangs). `finishSession` builds the result,
 *      persists it FIRST, then broadcasts `finished` to every connected
 *      port and disconnects them. The persist-before-broadcast order is
 *      critical: the widget's "View results" button immediately reads
 *      `getStoredSession`, so the broadcast cannot precede the storage
 *      write or the user could click into a "session not found" error.
 *
 * ## Isolation
 *
 *   - Dynamic rules are rewritten with `excludedTabIds: [...testTabIds]` while
 *     any session is active, so normal rules keep firing on every non-test
 *     tab but skip the test tabs.
 *   - Each active session installs its own **session ruleset** built from its
 *     scope snapshot, with `tabIds: [testTabId]` on every condition, applied
 *     via `chrome.declarativeNetRequest.updateSessionRules`. Delay rules are
 *     dropped from the per-session compile while the test tab sits in
 *     `pendingDelayBypass` so the delay page's follow-up navigation can't
 *     loop on the rule it's currently testing.
 *   - inject-manager filters scriptable rules per-tab via
 *     `getTestScopeForTab`, so scriptable rules under test only run on their
 *     session's tab and don't leak into unrelated tabs.
 *
 * ## Telemetry
 *
 * Fires flow into the tab-telemetry service via the two always-on ingestion
 * paths (scriptable fire-bridge content script + DNR probable-fires derived
 * from webRequest matching in request-monitor). The runner subscribes to
 * `tab-telemetry.subscribeFires(tabId)` filtered to scope uids and updates
 * `liveFireCount`. There is no polling, no per-session bridge, no
 * `getMatchedRules` call.
 */

import type { V5 } from '@openheaders/core/types';
import { isPathPausedByAncestor, isRuleComplete, parseTestTargetUrl } from '@openheaders/core/utils';
import { runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applyAllRules, applyAllRulesAsync, getPausedGroups } from '../dnr-manager';
import { matchRulesToRequest } from './request-tracker';
import { getRules } from './rule-store';
import { arbitrate, type ShadowAttribution } from './shadow-arbitration';
import {
  type Evidence,
  getObservedUrls,
  getTabSnapshotForScope,
  type RequestRecord,
  startTracking,
  stopTracking,
  subscribeFires,
} from './tab-telemetry';
import { registerSession, setSessionTabId, unregisterSession } from './test-session-state';
import {
  injectTestWidget,
  type PortFinishedPayload,
  type PortMessage,
  parseTestSessionPortName,
  testSessionPortName,
} from './test-widget';

// ── Public types ──────────────────────────────────────────────────

export type TestScope = 'single' | 'folder' | 'collection';

/** Per-rule status at the end of a session. */
export type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

/** A single rule fire event captured during a session. */
export interface TestFireEvent {
  ruleUid: string;
  url: string;
  /** Evidence tier — 'confirmed' (scriptable), 'matched' (DNR), 'matched-fallback' (DNR fallback for a scriptable-type rule). */
  evidence: Evidence;
  t: number;
  /**
   * Set when shadow arbitration determined that another rule in the
   * matching set made this rule's effect invisible or ambiguous. `kind`
   * classifies the reason — see `ShadowAttribution` in shadow-arbitration.ts
   * for the full taxonomy.
   */
  shadowedBy?: ShadowAttribution;
}

/** The final result of a test session, rendered in the workspace results view. */
export interface TestSessionResult {
  id: string;
  scope: TestScope;
  /** The rule uids that were eligible for the test (the scope snapshot). */
  ruleUids: string[];
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: TestFireEvent[];
  /** Per-rule aggregated status. */
  ruleStatuses: Record<string, TestRuleStatus>;
  /**
   * Attribution for rules that ended the session as `no-fire` BUT would
   * have been shadowed by a sibling rule on at least one URL observed
   * during the session. Computed at session-finish by arbitrating every
   * observed URL against the scope. Catches shadows that the per-hop
   * fire log lost — notably, inject rules whose main-frame pending fires
   * were dropped at commit time because the commit landed on a
   * chrome-extension delay page. The view promotes these rules from
   * `no-fire` to `shadowed` with the attribution's `kind` carrying the
   * reason.
   */
  noFireReasons?: Record<string, ShadowAttribution>;
}

// ── Internals ─────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  scope: TestScope;
  scopeLabel: string;
  /** V5 rules snapshotted at session start — the scope under test. */
  scopeRules: V5.Rule[];
  ruleUids: Set<string>;
  /**
   * Rules in the scope that won't actually run during this session — disabled,
   * incomplete, or under a paused group at session start. Marked 'skipped' in
   * the result rather than mislabelled as 'no-fire'.
   */
  skippedUids: Set<string>;
  url: string;
  waitSeconds: number;
  tabId: number | null;
  startedAt: number;
  /** Timer that fires when the capture window elapses after page load. */
  captureTimer: ReturnType<typeof setTimeout> | null;
  /** Hard-ceiling watchdog so a hung navigation doesn't pin the session. */
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
   * True once any widget port has connected during this session. Tracked
   * separately from `ports.size` because ports can disconnect before
   * finish; we use this at finish time to decide whether to fall back to
   * navigating the test tab to the results page (no widget ever showed
   * up → user has no other way to reach the report — happens when the
   * target URL errors before commit, e.g. a block rule under test).
   */
  everHadPort: boolean;
  /**
   * Set in `onTabRemoved` before the cascading `finishSession` call, so
   * the post-persist fallback-navigate logic knows the tab is already
   * gone and skips trying to drive it. Without this we'd attempt to
   * `tabs.update` a closed tab AND — worse — re-open the workspace
   * results page on the user who deliberately closed the tab to bail.
   */
  tabClosed: boolean;
  /** Resolver for the start() promise — called with the final result. */
  resolve: (result: TestSessionResult) => void;
}

const activeSessions: Map<string, ActiveSession> = new Map();

/**
 * Hard wall-clock ceiling beyond the configured wait window. Covers slow page
 * loads + a generous slack so the watchdog only kicks in for truly hung tabs,
 * never to truncate a legitimate capture window.
 */
const HARD_CEILING_SLACK_MS = 20_000;
/** chrome.storage.local key where persisted session results live. */
const STORAGE_KEY = 'v5TestSessions';
/** Maximum number of historical sessions kept — oldest trimmed on overflow. */
const MAX_STORED_SESSIONS = 50;

function newSessionId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trackingReason(sessionId: string): string {
  return `test:${sessionId}`;
}

// ── Session-state re-exports (kept for existing importers) ──────────
// dnr-manager and inject-manager previously imported these from test-runner.
// They now live in test-session-state.ts; re-export here so the existing
// import sites don't have to move atomically.

export type { ActiveSessionSnapshot } from './test-session-state';
export {
  getActiveSessionSnapshots,
  getActiveTestTabIds,
  getTestScopeForTab,
  hasActiveSessions,
  isRuleUnderTest,
} from './test-session-state';

// ── Persistence ───────────────────────────────────────────────────

/**
 * Read all persisted session results. Returned most-recent-first.
 * Missing key → empty array.
 */
export function listStoredSessions(): Promise<TestSessionResult[]> {
  return new Promise((resolve) => {
    storage.local.get([STORAGE_KEY], (result: Record<string, unknown>) => {
      const sessions = (result[STORAGE_KEY] as TestSessionResult[]) ?? [];
      resolve([...sessions].sort((a, b) => b.endedAt - a.endedAt));
    });
  });
}

export async function getStoredSession(id: string): Promise<TestSessionResult | null> {
  const sessions = await listStoredSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function deleteStoredSession(id: string): Promise<void> {
  await withStorageLock(async () => {
    const sessions = await listStoredSessions();
    const next = sessions.filter((s) => s.id !== id);
    await new Promise<void>((resolve) => {
      storage.local.set({ [STORAGE_KEY]: next }, () => resolve());
    });
  });
}

async function persistSession(result: TestSessionResult): Promise<void> {
  await withStorageLock(async () => {
    const sessions = await listStoredSessions();
    sessions.unshift(result);
    const trimmed = sessions.slice(0, MAX_STORED_SESSIONS);
    await new Promise<void>((resolve) => {
      storage.local.set({ [STORAGE_KEY]: trimmed }, () => resolve());
    });
  });
  try {
    // Notify any open workspace/popup listeners that a new result is available.
    runtime.sendMessage({ type: 'testSessionFinished', sessionId: result.id });
  } catch {
    // No listeners — fine.
  }
}

/**
 * Serialize read-modify-write operations on `v5TestSessions`. Without this,
 * two sessions finishing simultaneously could read the same prior state and
 * overwrite each other — losing one record. Since all writers go through this
 * queue the worst case is just a brief serialization, not data loss.
 */
let storageLockChain: Promise<void> = Promise.resolve();
function withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = storageLockChain.then(fn);
  storageLockChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ── Public start/stop API ─────────────────────────────────────────

export interface StartSessionOptions {
  scope: TestScope;
  /** Human-readable label for the scope — shown in the in-page widget. */
  scopeLabel: string;
  /** Snapshot of the rule uids in scope at the moment the test was launched. */
  ruleUids: string[];
  url: string;
  waitSeconds: number;
}

/**
 * Start a test session. Returns a promise that resolves with the final result
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
 *   3. Register the tab with tab-telemetry under the session tracking reason.
 *      This must happen before any request fires, so telemetry ingestion
 *      starts counting as soon as the page begins to load.
 *   4. Subscribe to tab-telemetry's fire stream filtered to scope uids, so
 *      every in-scope fire pushes a live count into the in-page widget.
 *   5. **Await** `applyAllRulesAsync()` — dynamic rules gain
 *      `excludedTabIds:[testTabId]` and session rules with `tabIds:[testTabId]`
 *      are installed. The await is critical: a fire-and-forget `applyAllRules`
 *      can race the navigation and let non-scope rules fire on the test tab.
 *   6. Navigate the tab to the target URL via `tabs.update`.
 *   7. Arm a hard-ceiling watchdog tuned to `waitSeconds + slack` so a hung
 *      tab can't pin the session forever, but a legitimate slow load doesn't
 *      get truncated mid-capture.
 *
 * If any step fails, the session is torn down and the promise resolves with
 * an empty result.
 */
export function startSession(opts: StartSessionOptions): Promise<TestSessionResult> {
  return new Promise((resolve) => {
    const id = newSessionId();

    // Defense-in-depth URL validation — same `parseTestTargetUrl` the
    // launcher modal uses, so a caller bypassing the modal (programmatic
    // `runtime.sendMessage`, future CLI, misbehaving E2E test) can't
    // open a tab on a malformed URL and strand the session on
    // about:blank until the hard ceiling fires. We resolve with an
    // empty result rather than throwing so the caller's promise chain
    // stays well-behaved.
    const urlResult = parseTestTargetUrl(opts.url);
    if (!urlResult.ok) {
      logger.info('TestRunner', `startSession rejected: ${urlResult.error} (input: ${opts.url})`);
      resolve(buildRejectedResult(opts, urlResult.error));
      return;
    }
    const targetUrl = urlResult.url;

    const allRules = getRules();
    const wanted = new Set(opts.ruleUids);
    const scopeRules = allRules.filter((r) => wanted.has(r.uid));

    // Step 1: identify rules in scope that simply cannot fire — they're
    // marked 'skipped' in the result so the user understands the difference
    // between "DNR ran the rule but no request matched" and "we never tried".
    const pausedGroups = new Set(getPausedGroups());
    const skippedUids = new Set<string>();
    for (const rule of scopeRules) {
      if (!rule.enabled || !isRuleComplete(rule) || isPathPausedByAncestor(rule.path, pausedGroups)) {
        skippedUids.add(rule.uid);
      }
    }
    // Clamp to the same bounds the launcher modal enforces. Defensive:
    // any caller bypassing the modal (programmatic CLI, misbehaving
    // message) still can't pin a session for an unbounded duration. The
    // hard-ceiling watchdog adds its own slack on top.
    const waitSeconds = Math.max(1, Math.min(opts.waitSeconds, 300));

    const session: ActiveSession = {
      id,
      scope: opts.scope,
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
    activeSessions.set(id, session);
    registerSession({ id, scopeRules, ruleUids: wanted, tabId: null });

    // Step 2: open the tab in the BACKGROUND on about:blank. We'll activate
    // it together with the navigation to the real target in step 6 — this
    // avoids the white about:blank flash the user would otherwise see if we
    // opened active. By the time the tab is brought to the foreground, the
    // DNR isolation is already live and the navigation is in flight.
    tabs.create({ url: 'about:blank', active: false }, (tab: chrome.tabs.Tab) => {
      void launchAfterTabCreated(session, tab, targetUrl);
    });
  });
}

/**
 * Second half of `startSession` — async because we need to **await**
 * `applyAllRulesAsync()` before navigating, otherwise the first request can
 * hit the test tab before its DNR isolation has been committed by Chrome
 * (which would let unrelated user rules fire on the test tab — exactly what
 * the scope under test should be insulated from).
 */
async function launchAfterTabCreated(session: ActiveSession, tab: chrome.tabs.Tab, targetUrl: string): Promise<void> {
  const id = session.id;
  if (!tab || typeof tab.id !== 'number') {
    logger.info('TestRunner', `Failed to open test tab for session ${id}`);
    activeSessions.delete(id);
    unregisterSession(id);
    session.resolve(buildEmptyResult(session));
    return;
  }
  const tabId = tab.id;

  session.tabId = tabId;
  setSessionTabId(id, tabId);
  logger.info('TestRunner', `Session ${id} started — tab ${tabId}, url ${targetUrl}`);

  // Step 3: telemetry tracking before any request fires.
  startTracking(tabId, trackingReason(id));

  // Step 4: subscribe to in-scope fires so we can push live counts to the
  // widget over its port. The subscription persists across page commits
  // because tab-telemetry resets state on commit but keeps the listener
  // registry. Fires that arrive BEFORE any widget port has connected still
  // bump `session.liveFireCount` — the widget catches up via the
  // `snapshot` message that the port handler sends on `onConnect`.
  session.unsubscribeFires = subscribeFires(tabId, (record: RequestRecord) => {
    if (!session.ruleUids.has(record.ruleUid)) return;
    session.liveFireCount += 1;
    broadcastToSessionPorts(session, { type: 'update', fires: session.liveFireCount });
  });

  // Step 5: arm the hard-ceiling watchdog BEFORE the await so a hung
  // `applyAllRulesAsync` can't pin the session forever. Tuned so the
  // worst-case (slow page + full capture window) lands well within budget.
  session.ceilingTimer = setTimeout(
    () => {
      if (activeSessions.has(id)) {
        logger.info('TestRunner', `Session ${id} hit hard ceiling`);
        finishSession(id);
      }
    },
    session.waitSeconds * 1000 + HARD_CEILING_SLACK_MS,
  );

  // Step 6: install DNR isolation and WAIT for it to be live in Chrome
  // before kicking off the navigation. Audit bug #1 fix — without the
  // await, the first request on the test tab can race the rule install
  // and let non-scope rules fire on the test tab.
  try {
    await applyAllRulesAsync();
  } catch (err) {
    logger.info('TestRunner', `applyAllRulesAsync failed for session ${id}: ${(err as Error).message}`);
    finishSession(id);
    return;
  }

  // The user may have closed the test tab while we were waiting for the
  // DNR install. `tabs.onRemoved` → `onTabRemoved` already finalised the
  // session via `finishSession`, so don't navigate a dead tab or arm
  // anything else.
  if (!activeSessions.has(id)) return;

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
  for (const session of activeSessions.values()) {
    if (session.tabId !== tabId) continue;
    if (isInternalUrl(committedUrl)) continue;
    // First real-URL commit unlocks `onTabLoaded` to start the capture
    // window. Errored navigations never get a commit (chrome-error pages
    // don't fire `webNavigation.onCommitted`), so the capture timer is
    // never armed by the success path and `onTabError` owns the grace.
    session.committed = true;
    const reportUrl = buildReportUrl(session.id);
    void injectTestWidget(tabId, {
      sessionId: session.id,
      scopeLabel: session.scopeLabel,
      ruleCount: session.ruleUids.size,
      waitSeconds: session.waitSeconds,
      reportUrl,
      startedAtMs: session.startedAt,
      portName: testSessionPortName(session.id),
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

function buildReportUrl(sessionId: string): string {
  try {
    return runtime.getURL(`workspace.html#/test/${sessionId}`);
  } catch {
    return `workspace.html#/test/${sessionId}`;
  }
}

// ── Widget port subscription ─────────────────────────────────────
//
// The in-page widget connects via `chrome.runtime.connect({ name })` on
// mount. We listen for that connection here, post a snapshot of the
// session's current `liveFireCount`, and remember the port so the
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

function broadcastToSessionPorts(session: ActiveSession, message: PortMessage): void {
  for (const port of session.ports) {
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
    const sessionId = parseTestSessionPortName(port.name);
    if (!sessionId) return; // Not one of ours.
    const session = activeSessions.get(sessionId);
    if (!session) {
      // Stale connect — session has already finished. Closing the port
      // signals to the widget that there's nothing to subscribe to.
      try {
        port.disconnect();
      } catch {
        // No-op
      }
      return;
    }

    session.ports.add(port);
    session.everHadPort = true;
    port.onDisconnect.addListener(() => {
      session.ports.delete(port);
    });

    // Snapshot of current state — the widget will draw the right fire
    // count from the moment its first render runs, even if many fires
    // were promoted before it mounted.
    try {
      port.postMessage({ type: 'snapshot', fires: session.liveFireCount, phase: 'capturing' });
    } catch {
      session.ports.delete(port);
    }
  });
}

/**
 * Called from tab-listeners when a tab is closed (manually by the user, by
 * extension crash, or by our own teardown). Finishes any session watching
 * that tab so DNR session rules are cleared and the promise resolves.
 */
export function onTabRemoved(tabId: number): void {
  for (const session of activeSessions.values()) {
    if (session.tabId === tabId) {
      logger.info('TestRunner', `Session ${session.id} tab ${tabId} closed — finishing`);
      // Mark BEFORE finishSession so the post-persist fallback-navigate
      // path sees it and doesn't try to drive a closed tab (or — worse —
      // re-open the workspace results page on a user who explicitly
      // closed the tab to bail out of the session).
      session.tabClosed = true;
      finishSession(session.id);
    }
  }
}

/**
 * Called from tab-listeners when a test tab's main-frame navigation
 * errors out (typically `ERR_BLOCKED_BY_CLIENT` because a block rule
 * under test cancelled the request, but covers any terminal network
 * error). The widget will never mount on a Chrome error page —
 * `chrome-error://chromewebdata/` is a privileged surface that rejects
 * content scripts — so the test session has no in-page UI path forward.
 *
 * Two cases:
 *
 *   1. **Session never committed to a real URL** — this is the initial
 *      navigation and it failed before commit (block, DNS, TLS, etc.).
 *      `onTabLoaded`'s `committed` guard means no capture timer has
 *      been armed yet, so we arm one here for the user's full
 *      `waitSeconds`. The user gets their chosen test-duration to look
 *      at the error page ("yes, my block rule fired") before
 *      `finishSession` navigates the test tab to the workspace results
 *      report (`everHadPort` will be false because no widget mounted).
 *
 *   2. **Session already committed and capturing** — the user navigated
 *      somewhere within the test tab via JS / link click, and that
 *      *secondary* navigation errored. The existing capture timer is
 *      already counting down for the user's chosen `waitSeconds`; we
 *      leave it alone. The session finishes naturally.
 */
export function onTabError(tabId: number): void {
  for (const session of activeSessions.values()) {
    if (session.tabId !== tabId) continue;
    if (session.committed) {
      logger.debug(
        'TestRunner',
        `Session ${session.id} tab ${tabId} secondary nav errored — capture timer keeps running`,
      );
      continue;
    }
    if (session.captureTimer) continue; // grace already armed by an earlier error event
    logger.info(
      'TestRunner',
      `Session ${session.id} tab ${tabId} initial navigation errored — grace ${session.waitSeconds}s then finish`,
    );
    session.loaded = true;
    session.captureTimer = setTimeout(() => finishSession(session.id), session.waitSeconds * 1000);
  }
}

/**
 * Called from tab-listeners when a tab reaches `tabs.onUpdated` `complete`.
 * Starts the capture window timer — but ONLY if the tab actually committed
 * to a real URL first. Chrome reports `complete` for its built-in error
 * pages too, so without the `committed` guard a blocked navigation would
 * start the user's full-length capture window on the chrome-error page,
 * stranding the session there until the timer expired and bypassing
 * `onTabError`'s short-grace path.
 */
export function onTabLoaded(tabId: number): void {
  for (const session of activeSessions.values()) {
    if (session.tabId !== tabId) continue;
    if (session.loaded) continue;
    if (!session.committed) {
      logger.debug(
        'TestRunner',
        `Session ${session.id} tab reported complete without commit — deferring to onTabError`,
      );
      continue;
    }
    session.loaded = true;
    session.captureTimer = setTimeout(() => finishSession(session.id), session.waitSeconds * 1000);
    logger.debug('TestRunner', `Session ${session.id} tab loaded — capturing for ${session.waitSeconds}s`);
  }
}

// ── Finish + result building ──────────────────────────────────────

function finishSession(id: string): void {
  const session = activeSessions.get(id);
  if (!session) return;
  activeSessions.delete(id);

  if (session.captureTimer) clearTimeout(session.captureTimer);
  if (session.ceilingTimer) clearTimeout(session.ceilingTimer);

  if (session.unsubscribeFires) {
    session.unsubscribeFires();
    session.unsubscribeFires = null;
  }

  // Build the result BEFORE we tear down telemetry / DNR state — the
  // snapshot needs the in-flight fire log intact.
  const result = buildResult(session);

  // Stop tab-telemetry tracking for this session's reason. The active-tab
  // tracking from tab-listeners keeps state alive while the user has the
  // test tab focused, so the telemetry the workspace report later reads
  // is preserved.
  if (session.tabId != null) {
    stopTracking(session.tabId, trackingReason(id));
  }
  unregisterSession(id);

  // Re-apply the DNR state now that this session is gone — clears its
  // session rules and removes this tabId from dynamic rules' excludedTabIds.
  applyAllRules();

  logger.info(
    'TestRunner',
    `Session ${session.id} finished — ${result.fires.length} fires across ${
      new Set(result.fires.map((f) => f.ruleUid)).size
    }/${session.ruleUids.size} rules`,
  );

  const executed = Object.values(result.ruleStatuses).filter((s) => s === 'executed').length;
  const noFire = Object.values(result.ruleStatuses).filter((s) => s === 'no-fire').length;
  const finishedPayload: PortFinishedPayload = {
    fires: result.fires.length,
    executed,
    noFire,
  };

  // Persist FIRST, then notify the widget. The widget's "View results"
  // button navigates to `workspace.html#/test/<id>` which immediately
  // reads the session via `getStoredSession`; if we pushed `finished`
  // before persistence completed the user could click into a "session
  // not found" error. Once persistence resolves, broadcast the terminal
  // payload over every connected port and tear them down so any new
  // connect attempt cleanly disconnects.
  //
  // Fallback path: if no widget port ever connected during this session
  // (the test target errored before commit, was a privileged URL,
  // sandboxed, etc.) the user has no in-page surface to click "View
  // results" on. The workspace report is the source of truth and is
  // already persisted, so we navigate the still-living test tab to it
  // directly. The user opened a tab expecting test results — they get
  // test results, just without the intermediate widget step.
  void persistSession(result).then(() => {
    broadcastToSessionPorts(session, { type: 'finished', ...finishedPayload });
    for (const port of session.ports) {
      try {
        port.disconnect();
      } catch {
        // No-op
      }
    }
    session.ports.clear();

    if (!session.everHadPort && !session.tabClosed && session.tabId != null) {
      const reportUrl = buildReportUrl(session.id);
      tabs.update(session.tabId, { url: reportUrl, active: true }, () => {
        if (runtime.lastError) {
          // Tiny race: user closed the tab AFTER finishSession started
          // but BEFORE persist resolved. The tabClosed flag won't be set
          // (onTabRemoved no longer finds the session in activeSessions),
          // so we still try the navigate and Chrome rejects it. Log and
          // move on — the report is persisted, the user can still reach
          // it via the test history list whenever they want.
          logger.info(
            'TestRunner',
            `Fallback navigate to results failed for session ${session.id}: ${runtime.lastError.message}`,
          );
        }
      });
    }
  });

  session.resolve(result);
}

function buildResult(session: ActiveSession): TestSessionResult {
  const snapshotFires = session.tabId != null ? getTabSnapshotForScope(session.tabId, session.ruleUids).fires : [];
  // RequestRecord has extra fields (pattern, resourceType) that TestFireEvent
  // doesn't care about; project to the stable session-result shape. Carry
  // `shadowedBy` through so the workspace can render shadowed rules with
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
  for (const uid of session.ruleUids) {
    if (session.skippedUids.has(uid)) {
      ruleStatuses[uid] = 'skipped';
    } else if (firedUids.has(uid)) {
      ruleStatuses[uid] = 'executed';
    } else {
      ruleStatuses[uid] = 'no-fire';
    }
  }

  // Static arbitration pass over the full observed-URL set. For every
  // no-fire rule in scope, check whether any URL the tab hit during the
  // session would have put it into a matching set where a sibling rule
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
  if (session.tabId != null) {
    const observedUrls = getObservedUrls(session.tabId);
    if (observedUrls.length > 0) {
      for (const uid of session.ruleUids) {
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
    id: session.id,
    scope: session.scope,
    ruleUids: [...session.ruleUids],
    url: session.url,
    startedAt: session.startedAt,
    endedAt: Date.now(),
    waitSeconds: session.waitSeconds,
    fires,
    ruleStatuses,
    ...(Object.keys(noFireReasons).length > 0 ? { noFireReasons } : {}),
  };
}

function buildEmptyResult(session: ActiveSession): TestSessionResult {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of session.ruleUids) {
    ruleStatuses[uid] = session.skippedUids.has(uid) ? 'skipped' : 'no-fire';
  }
  return {
    id: session.id,
    scope: session.scope,
    ruleUids: [...session.ruleUids],
    url: session.url,
    startedAt: session.startedAt,
    endedAt: Date.now(),
    waitSeconds: session.waitSeconds,
    fires: [],
    ruleStatuses,
  };
}

/**
 * Build a synthetic empty result for a session that was rejected at the
 * gate (currently only: invalid URL). No tab is opened, no telemetry is
 * captured, no DNR isolation is installed — we just want a well-formed
 * result so the caller's promise resolves cleanly. All scope rules are
 * marked `no-fire` (or `skipped` if disabled / incomplete from the
 * outset). The reason text is logged but not surfaced through the result
 * shape; surfacing it would require a new field on `TestSessionResult`,
 * and the popup launcher already shows the same text via its own
 * synchronous `parseTestTargetUrl` call before sending the message.
 */
function buildRejectedResult(opts: StartSessionOptions, _reason: string): TestSessionResult {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of opts.ruleUids) {
    ruleStatuses[uid] = 'no-fire';
  }
  const now = Date.now();
  return {
    id: newSessionId(),
    scope: opts.scope,
    ruleUids: [...opts.ruleUids],
    url: opts.url,
    startedAt: now,
    endedAt: now,
    waitSeconds: Math.max(1, Math.min(opts.waitSeconds, 300)),
    fires: [],
    ruleStatuses,
  };
}
