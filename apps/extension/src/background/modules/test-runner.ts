/**
 * Test Runner — runs a test session against a URL and collects rule-fire telemetry.
 *
 * A "test session" opens the target URL in a dedicated tab and captures every
 * rule fire on that tab for a bounded time window, then returns a structured
 * result the UI can overlay on RuleFlow.
 *
 * Isolation (Option B — matches Chrome's intended MV3 pattern):
 *
 *   - Dynamic rules are rewritten with `excludedTabIds: [...testTabIds]` while
 *     any session is active. Normal rules keep firing on every non-test tab;
 *     they simply skip the test tabs.
 *   - Each active session installs its own **session ruleset** built from its
 *     scope snapshot, with `tabIds: [testTabId]` on every condition. These
 *     session rules live only in the current browser session and are applied
 *     via `chrome.declarativeNetRequest.updateSessionRules` — Chrome's own
 *     mechanism for ephemeral test rules.
 *   - The inject-manager filters scriptable rules per-tab, so delay/body/mock/
 *     inject in a test tab only run for rules in that session's scope, and
 *     scriptable rules under test are blocked from leaking into non-test tabs.
 *
 * Telemetry sources feeding a session:
 *
 *   1. **DNR ground truth** — `declarativeNetRequest.getMatchedRules({tabId})`
 *      reports which session-rule ids fired on the test tab. Numeric ids are
 *      mapped back to V5.Rule.uid via the session-rule id map maintained in
 *      dnr-manager.
 *
 *   2. **Scriptable pings** — delay/body/mock/inject scripts dispatch an
 *      `oh:test:fired` CustomEvent when `window.__OH_TEST__` is set. The
 *      test bridge content script (registered via
 *      `chrome.scripting.registerContentScripts` at session start, scoped to
 *      the test URL origin + `runAt: 'document_start'`) sets the flag and
 *      forwards events here.
 */

import { declarativeNetRequest as dnrApi, runtime, scripting, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { V5 } from '@openheaders/core/types';
import { applyAllRules, getSessionRuleIdToUid } from '../dnr-manager';
import { getRules } from './rule-store';

// ── Types ─────────────────────────────────────────────────────────

export type TestScope = 'single' | 'folder' | 'collection';

/** Per-rule status at the end of a session. */
export type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

/** A single rule fire event captured during a session. */
export interface TestFireEvent {
  ruleUid: string;
  url: string;
  /** 'dnr' for DNR-matched rules, or 'delay' | 'body' | 'mock' | 'inject' for scriptable. */
  kind: 'dnr' | 'delay' | 'body' | 'mock' | 'inject';
  t: number;
}

/** The final result of a test session, rendered in the workspace results view. */
export interface TestSessionResult {
  id: string;
  scope: TestScope;
  /** The rule uids that were *eligible* for the test (the scope snapshot). */
  ruleUids: string[];
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: TestFireEvent[];
  /** Per-rule aggregated status. */
  ruleStatuses: Record<string, TestRuleStatus>;
}

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
  /** Polling interval for DNR getMatchedRules(). */
  pollTimer: ReturnType<typeof setInterval> | null;
  fires: TestFireEvent[];
  /** DNR fire dedup: `${ruleId}:${timeStamp}`. */
  seenDnrFires: Set<string>;
  /** Resolver for the start() promise — called with the final result. */
  resolve: (result: TestSessionResult) => void;
  /** Set once the tab has reached the load event. */
  loaded: boolean;
  /** Content script id used to register/unregister the test bridge. */
  bridgeScriptId: string;
}

// ── State ─────────────────────────────────────────────────────────

const activeSessions: Map<string, ActiveSession> = new Map();

/** Hard wall-clock ceiling regardless of wait setting — avoids hung tests. */
const HARD_CEILING_MS = 15_000;
/** Interval for polling getMatchedRules while a session is active. */
const POLL_INTERVAL_MS = 500;
/** chrome.storage.local key where persisted session results live. */
const STORAGE_KEY = 'v5TestSessions';
/** Maximum number of historical sessions kept — oldest trimmed on overflow. */
const MAX_STORED_SESSIONS = 50;

function newSessionId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public session-state API (read by dnr-manager + inject-manager) ──

/**
 * Public snapshot of an active session — the subset dnr-manager and
 * inject-manager need to build scoped rules and filter injections.
 */
export interface ActiveSessionSnapshot {
  id: string;
  tabId: number;
  scopeRules: V5.Rule[];
  ruleUids: Set<string>;
}

/** All currently-active sessions that have a tab assigned. */
export function getActiveSessionSnapshots(): ActiveSessionSnapshot[] {
  const out: ActiveSessionSnapshot[] = [];
  for (const s of activeSessions.values()) {
    if (s.tabId != null) {
      out.push({ id: s.id, tabId: s.tabId, scopeRules: s.scopeRules, ruleUids: s.ruleUids });
    }
  }
  return out;
}

/** Tab ids of every active test session — used by dnr-manager to set excludedTabIds. */
export function getActiveTestTabIds(): number[] {
  return getActiveSessionSnapshots().map((s) => s.tabId);
}

/**
 * If `tabId` is a test tab, return the Set of rule uids allowed to run on it.
 * If it isn't, return null. Used by inject-manager to filter scriptable rules.
 */
export function getTestScopeForTab(tabId: number): Set<string> | null {
  for (const s of activeSessions.values()) {
    if (s.tabId === tabId) return s.ruleUids;
  }
  return null;
}

/**
 * Is this rule uid currently under test in any session? Used by inject-manager
 * to suppress the rule on non-test tabs so the test doesn't leak.
 */
export function isRuleUnderTest(ruleUid: string): boolean {
  for (const s of activeSessions.values()) {
    if (s.ruleUids.has(ruleUid)) return true;
  }
  return false;
}

export function hasActiveSessions(): boolean {
  return activeSessions.size > 0;
}

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
 * Serialize read-modify-write operations on `v5TestSessions`. Without this, two
 * sessions finishing simultaneously could read the same prior state and
 * overwrite each other — losing one record. Since all writers go through this
 * queue the worst case is just a brief serialization, not data loss.
 */
let storageLockChain: Promise<void> = Promise.resolve();
function withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = storageLockChain.then(fn);
  // Swallow errors on the chain so one failed write doesn't poison the queue.
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
 * Setup sequence — order matters for correctness:
 *
 *   1. Create the tab with `about:blank` (no navigation to target yet).
 *   2. Register the ISOLATED-world test bridge content script, scoped to the
 *      target URL's origin. This MUST happen before the navigation commits
 *      so the bridge runs at document_start and sets window.__OH_TEST__ before
 *      any page script executes.
 *   3. Call `applyAllRules()` — now the tabId is known, so dynamic rules gain
 *      `excludedTabIds:[testTabId]` and session rules with `tabIds:[testTabId]`
 *      are installed. These must be active before the target URL is fetched.
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
      pollTimer: null,
      fires: [],
      seenDnrFires: new Set(),
      resolve,
      loaded: false,
      bridgeScriptId: `oh-test-bridge-${id}`,
    };
    activeSessions.set(id, session);

    tabs.create({ url: 'about:blank', active: false }, async (tab: chrome.tabs.Tab) => {
      if (!tab || typeof tab.id !== 'number') {
        logger.info('TestRunner', `Failed to open test tab for session ${id}`);
        activeSessions.delete(id);
        session.resolve(buildEmptyResult(session));
        return;
      }
      session.tabId = tab.id;
      logger.info('TestRunner', `Session ${id} started — tab ${tab.id}, url ${opts.url}`);

      // Step 2: register the bridge BEFORE navigation. Awaited so we know it's
      // active by the time the tab navigates. A failure here only degrades
      // scriptable telemetry; DNR telemetry still works.
      await registerBridge(session);

      // Step 3: rebuild DNR state now that the tabId is known. Dynamic rules
      // gain excludedTabIds:[testTabId], session rules get tabIds:[testTabId].
      applyAllRules();

      // Begin polling for DNR matched rules on this tab.
      startPolling(session);

      // Hard ceiling in case load never fires.
      setTimeout(() => {
        if (activeSessions.has(id)) {
          logger.info('TestRunner', `Session ${id} hit hard ceiling`);
          finishSession(id);
        }
      }, HARD_CEILING_MS);

      // Step 4: now navigate to the real URL. The bridge is registered, DNR
      // scoping is active, and the poll loop is running.
      tabs.update(tab.id, { url: opts.url }, () => {
        if (runtime.lastError) {
          logger.info(
            'TestRunner',
            `Failed to navigate test tab to ${opts.url}: ${runtime.lastError.message}`,
          );
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

/**
 * Called from the message handler when a scriptable rule fires in a test tab.
 * Forwarded by the test-bridge-content script.
 */
export function recordScriptableFire(
  tabId: number,
  ruleUid: string,
  url: string,
  kind: TestFireEvent['kind'],
  t: number,
): void {
  for (const session of activeSessions.values()) {
    if (session.tabId === tabId && session.ruleUids.has(ruleUid)) {
      session.fires.push({ ruleUid, url, kind, t });
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────

async function registerBridge(session: ActiveSession): Promise<void> {
  if (!scripting?.registerContentScripts) {
    logger.debug('TestRunner', 'scripting.registerContentScripts unavailable — bridge disabled');
    return;
  }
  let origin: string;
  try {
    origin = `${new URL(session.url).origin}/*`;
  } catch {
    logger.info('TestRunner', `Invalid test URL ${session.url}, bridge not registered`);
    return;
  }
  try {
    await scripting.registerContentScripts([
      {
        id: session.bridgeScriptId,
        js: ['js/content/test-bridge/index.js'],
        matches: [origin],
        runAt: 'document_start',
        world: 'ISOLATED',
        persistAcrossSessions: false,
        allFrames: false,
      },
    ]);
    logger.debug('TestRunner', `Bridge registered for ${origin} (session ${session.id})`);
  } catch (error) {
    logger.info('TestRunner', `Failed to register bridge: ${(error as Error).message}`);
  }
}

async function unregisterBridge(session: ActiveSession): Promise<void> {
  if (!scripting?.unregisterContentScripts) return;
  try {
    await scripting.unregisterContentScripts({ ids: [session.bridgeScriptId] });
  } catch {
    // Ignore — may have been cleared by browser shutdown or never registered.
  }
}

function startPolling(session: ActiveSession): void {
  if (!dnrApi?.getMatchedRules) {
    logger.debug('TestRunner', 'getMatchedRules unavailable — DNR telemetry disabled for this session');
    return;
  }
  session.pollTimer = setInterval(() => void pollOnce(session), POLL_INTERVAL_MS);
}

async function pollOnce(session: ActiveSession): Promise<void> {
  if (session.tabId == null || !dnrApi?.getMatchedRules) return;
  try {
    const result = await dnrApi.getMatchedRules({ tabId: session.tabId });
    const sessionMap = getSessionRuleIdToUid(session.id);
    for (const match of result.rulesMatchedInfo ?? []) {
      const uid = sessionMap.get(match.rule.ruleId);
      if (!uid) continue;
      const key = `${match.rule.ruleId}:${match.timeStamp}`;
      if (session.seenDnrFires.has(key)) continue;
      session.seenDnrFires.add(key);
      session.fires.push({
        ruleUid: uid,
        url: '',
        kind: 'dnr',
        t: match.timeStamp,
      });
    }
  } catch (error) {
    logger.debug('TestRunner', `pollOnce error: ${(error as Error).message}`);
  }
}

function finishSession(id: string): void {
  const session = activeSessions.get(id);
  if (!session) return;
  activeSessions.delete(id);

  if (session.captureTimer) clearTimeout(session.captureTimer);
  if (session.pollTimer) clearInterval(session.pollTimer);

  const finalize = () => {
    // Re-apply the DNR state now that this session is gone — clears its
    // session rules and removes this tabId from dynamic rules' excludedTabIds.
    applyAllRules();
    void unregisterBridge(session);

    const result = buildResult(session);
    logger.info(
      'TestRunner',
      `Session ${session.id} finished — ${session.fires.length} fires across ${
        new Set(session.fires.map((f) => f.ruleUid)).size
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
  };

  // One final DNR poll to catch fires between the last interval and close.
  if (dnrApi?.getMatchedRules && session.tabId != null) {
    void pollOnce(session).finally(finalize);
  } else {
    finalize();
  }
}

function buildResult(session: ActiveSession): TestSessionResult {
  const firedUids = new Set(session.fires.map((f) => f.ruleUid));
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
    fires: session.fires,
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
