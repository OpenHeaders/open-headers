/**
 * Test Runner — orchestrates a test session against a URL.
 *
 * A test session opens the target URL in a dedicated tab, registers the tab
 * with tab-telemetry under a session-scoped tracking reason, waits for the
 * capture window to close, then reads the scope-filtered telemetry snapshot
 * and persists it as a TestSessionResult.
 *
 * Isolation (unchanged from Option B — matches Chrome's MV3 pattern):
 *
 *   - Dynamic rules are rewritten with `excludedTabIds: [...testTabIds]` while
 *     any session is active, so normal rules keep firing on every non-test
 *     tab but skip the test tabs.
 *   - Each active session installs its own **session ruleset** built from its
 *     scope snapshot, with `tabIds: [testTabId]` on every condition, applied
 *     via `chrome.declarativeNetRequest.updateSessionRules`.
 *   - inject-manager filters scriptable rules per-tab via
 *     `getTestScopeForTab`, so scriptable rules under test only run on their
 *     session's tab and don't leak into unrelated tabs.
 *
 * Telemetry (new): there is no polling, no per-session content script bridge,
 * no `getMatchedRules` call. Fires flow into the tab-telemetry service via
 * the two always-on ingestion paths:
 *
 *   1. Scriptable fires via the static ISOLATED `fire-bridge` content script
 *      (forwarded as `tabFire` runtime messages, routed by message-handler).
 *   2. DNR probable-fires derived from webRequest matching in request-monitor.
 *
 * The session registers `tabTelemetry.startTracking(tabId, 'test:<id>')`
 * when the test tab is created, reads the scoped snapshot at finish, and
 * calls `stopTracking` to release the telemetry state. Other consumers (the
 * popup's This Page tab) can track the same or different tabs independently.
 *
 * The previous architecture polled `chrome.declarativeNetRequest.getMatchedRules`
 * every 500ms per session. That API is hard-quota'd at 20 calls/10 min in
 * production (regardless of the `declarativeNetRequestFeedback` permission),
 * which caused the poll loop to silently fail after the quota was hit. The
 * new architecture makes no `getMatchedRules` calls at all.
 */

import type { V5 } from '@openheaders/core/types';
import { runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applyAllRules } from '../dnr-manager';
import { getRules } from './rule-store';
import { type FireKind, getTabSnapshotForScope, startTracking, stopTracking } from './tab-telemetry';
import { registerSession, setSessionTabId, unregisterSession } from './test-session-state';

// ── Public types ──────────────────────────────────────────────────

export type TestScope = 'single' | 'folder' | 'collection';

/** Per-rule status at the end of a session. */
export type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

/** A single rule fire event captured during a session. */
export interface TestFireEvent {
  ruleUid: string;
  url: string;
  /** Source of the fire. */
  kind: FireKind;
  t: number;
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
}

// ── Internals ─────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  scope: TestScope;
  /** V5 rules snapshotted at session start — the scope under test. */
  scopeRules: V5.Rule[];
  ruleUids: Set<string>;
  url: string;
  waitSeconds: number;
  tabId: number | null;
  startedAt: number;
  /** Timer that fires when the capture window elapses after page load. */
  captureTimer: ReturnType<typeof setTimeout> | null;
  /** Set once the tab has reached the load event. */
  loaded: boolean;
  /** Resolver for the start() promise — called with the final result. */
  resolve: (result: TestSessionResult) => void;
}

const activeSessions: Map<string, ActiveSession> = new Map();

/** Hard wall-clock ceiling regardless of wait setting — avoids hung tests. */
const HARD_CEILING_MS = 15_000;
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
 *   1. Create the tab with about:blank (no navigation to target yet).
 *   2. Register the tab with tab-telemetry under the session tracking reason.
 *      This must happen before any request fires, so telemetry ingestion
 *      starts counting as soon as the page begins to load.
 *   3. Call `applyAllRules()` — now the tabId is known to test-session-state,
 *      so dynamic rules gain `excludedTabIds:[testTabId]` and session rules
 *      with `tabIds:[testTabId]` are installed. These must be active before
 *      the target URL is fetched.
 *   4. Navigate the tab to the target URL via `tabs.update`.
 *
 * If any step fails, the session is torn down and the promise resolves with
 * an empty result.
 */
export function startSession(opts: StartSessionOptions): Promise<TestSessionResult> {
  return new Promise((resolve) => {
    const id = newSessionId();
    const allRules = getRules();
    const wanted = new Set(opts.ruleUids);
    const scopeRules = allRules.filter((r) => wanted.has(r.uid));

    const session: ActiveSession = {
      id,
      scope: opts.scope,
      scopeRules,
      ruleUids: wanted,
      url: opts.url,
      waitSeconds: Math.max(1, Math.min(opts.waitSeconds, 10)),
      tabId: null,
      startedAt: Date.now(),
      captureTimer: null,
      loaded: false,
      resolve,
    };
    activeSessions.set(id, session);
    registerSession({ id, scopeRules, ruleUids: wanted, tabId: null });

    tabs.create({ url: 'about:blank', active: false }, (tab: chrome.tabs.Tab) => {
      if (!tab || typeof tab.id !== 'number') {
        logger.info('TestRunner', `Failed to open test tab for session ${id}`);
        activeSessions.delete(id);
        unregisterSession(id);
        session.resolve(buildEmptyResult(session));
        return;
      }
      session.tabId = tab.id;
      setSessionTabId(id, tab.id);
      logger.info('TestRunner', `Session ${id} started — tab ${tab.id}, url ${opts.url}`);

      // Step 2: start telemetry tracking before DNR state is rebuilt and
      // before navigation. This way any fire that happens after navigation
      // commits — including document_start script fires — flows into
      // tab-telemetry for this tab.
      startTracking(tab.id, trackingReason(id));

      // Step 3: rebuild DNR state now that the tabId is known. Dynamic rules
      // gain excludedTabIds:[testTabId], session rules get tabIds:[testTabId].
      applyAllRules();

      // Hard ceiling in case load never fires.
      setTimeout(() => {
        if (activeSessions.has(id)) {
          logger.info('TestRunner', `Session ${id} hit hard ceiling`);
          finishSession(id);
        }
      }, HARD_CEILING_MS);

      // Step 4: navigate to the real URL. Telemetry is tracking, DNR scoping
      // is active, and the hard-ceiling safety net is armed.
      tabs.update(tab.id, { url: opts.url }, () => {
        if (runtime.lastError) {
          logger.info('TestRunner', `Failed to navigate test tab to ${opts.url}: ${runtime.lastError.message}`);
        }
      });
    });
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
      finishSession(session.id);
    }
  }
}

/**
 * Called from tab-listeners when a tab reaches the load event. Starts the
 * capture window timer for any session watching that tab.
 */
export function onTabLoaded(tabId: number): void {
  for (const session of activeSessions.values()) {
    if (session.tabId === tabId && !session.loaded) {
      session.loaded = true;
      session.captureTimer = setTimeout(() => finishSession(session.id), session.waitSeconds * 1000);
      logger.debug('TestRunner', `Session ${session.id} tab loaded — capturing for ${session.waitSeconds}s`);
    }
  }
}

// ── Finish + result building ──────────────────────────────────────

function finishSession(id: string): void {
  const session = activeSessions.get(id);
  if (!session) return;
  activeSessions.delete(id);

  if (session.captureTimer) clearTimeout(session.captureTimer);

  // Stop tab-telemetry tracking for this session's reason. If the popup is
  // also tracking this tab under a different reason (rare — test tabs are
  // background tabs), the fire state survives. Otherwise it's freed.
  if (session.tabId != null) {
    stopTracking(session.tabId, trackingReason(id));
  }
  unregisterSession(id);

  // Re-apply the DNR state now that this session is gone — clears its
  // session rules and removes this tabId from dynamic rules' excludedTabIds.
  applyAllRules();

  const result = buildResult(session);
  logger.info(
    'TestRunner',
    `Session ${session.id} finished — ${result.fires.length} fires across ${
      new Set(result.fires.map((f) => f.ruleUid)).size
    }/${session.ruleUids.size} rules`,
  );

  if (session.tabId != null) {
    tabs.remove(session.tabId, () => {
      // Tab may already be closed (user-initiated finish) — read lastError
      // to suppress Chrome's "Unchecked runtime.lastError" console noise.
      void runtime.lastError;
    });
  }

  void persistSession(result);
  session.resolve(result);
}

function buildResult(session: ActiveSession): TestSessionResult {
  const fires: TestFireEvent[] =
    session.tabId != null ? getTabSnapshotForScope(session.tabId, session.ruleUids).fires : [];
  const firedUids = new Set(fires.map((f) => f.ruleUid));
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of session.ruleUids) {
    ruleStatuses[uid] = firedUids.has(uid) ? 'executed' : 'no-fire';
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
  };
}

function buildEmptyResult(session: ActiveSession): TestSessionResult {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of session.ruleUids) {
    ruleStatuses[uid] = 'no-fire';
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
