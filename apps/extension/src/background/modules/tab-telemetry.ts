/**
 * Tab Telemetry — the single source of truth for "which V5 rules fired on tab X".
 *
 * Push-only architecture. Two ingestion paths, both asynchronous to the caller:
 *
 *   1. **Scriptable fires** (ground truth): generated delay/body/mock/header-merge
 *      scripts dispatch `oh:fire` CustomEvents. An always-on ISOLATED content
 *      script forwards them via chrome.runtime.sendMessage, which routes into
 *      `recordScriptFire`.
 *
 *   2. **DNR probable-fires** (approximation): the request-monitor webRequest
 *      listener runs observed requests through the same matcher used by
 *      `getActiveRulesForTab` and calls `recordDnrMatch` for each matching
 *      (rule, request) pair on tracked tabs. This does NOT use
 *      `chrome.declarativeNetRequest.getMatchedRules`, which is hard-quota'd
 *      at 20 calls/10min in production and unusable for continuous telemetry.
 *      The tradeoff is that a rule shadowed by a higher-priority rule counts
 *      here even though DNR never actually ran it. We label DNR counts as
 *      "matched" rather than "fired" in the UI to be honest about this.
 *
 * A tab is "tracked" iff at least one consumer has registered a tracking
 * reason for it. Reasons stack — when the last reason is removed, the tab's
 * fire state is dropped. When no tab is tracked, record* calls are no-ops,
 * so the background cost is ~zero.
 *
 * Fires for untracked tabs are dropped on the floor. This is intentional:
 * telemetry should only exist while someone is reading it.
 *
 * Storage is in-memory and ephemeral. MV3 service worker eviction loses the
 * state — consumers that need durability (e.g. test sessions) must persist
 * their own snapshot at session end.
 */

export type TrackingReason = string;

/** Rule fire source kinds. Mirrors TestFireEvent['kind'] from the old test-runner. */
export type FireKind = 'dnr' | 'delay' | 'body' | 'mock' | 'inject' | 'header-merge';

export interface FireRecord {
  ruleUid: string;
  url: string;
  kind: FireKind;
  /** Wall-clock timestamp in ms. */
  t: number;
}

interface TabFireState {
  /** Consumers currently tracking this tab. Empty set = clear the whole entry. */
  reasons: Set<TrackingReason>;
  /** Chronological fire log, capped at MAX_FIRES_PER_TAB (ring buffer semantics). */
  fires: FireRecord[];
  /** Uncapped per-rule counters — survive even after ring-buffer drop. */
  counters: Map<string, number>;
  /** Dedup key set for DNR matches: `${ruleUid}:${url}:${t}` — avoids double-count on redirects. */
  dnrSeen: Set<string>;
}

/** Ring buffer cap for per-tab fire log. Counters keep going past this. */
const MAX_FIRES_PER_TAB = 1000;

const tabs: Map<number, TabFireState> = new Map();

// ── Tracking lifecycle ──────────────────────────────────────────────

/**
 * Register a reason for tracking `tabId`. First reason creates the fire
 * state. Idempotent — calling with an existing reason is a no-op.
 */
export function startTracking(tabId: number, reason: TrackingReason): void {
  let state = tabs.get(tabId);
  if (!state) {
    state = {
      reasons: new Set(),
      fires: [],
      counters: new Map(),
      dnrSeen: new Set(),
    };
    tabs.set(tabId, state);
  }
  state.reasons.add(reason);
}

/**
 * Remove a reason for tracking `tabId`. If the last reason is removed, the
 * tab's entire fire state is discarded. Idempotent.
 */
export function stopTracking(tabId: number, reason: TrackingReason): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.reasons.delete(reason);
  if (state.reasons.size === 0) {
    tabs.delete(tabId);
  }
}

export function isTracked(tabId: number): boolean {
  return tabs.has(tabId);
}

/** Fully remove all state for a tab — used on tab close. */
export function clearTab(tabId: number): void {
  tabs.delete(tabId);
}

/**
 * Clear fires + counters on main-frame navigation, but keep tracking reasons.
 * Called from the tab-listeners navigation handler. Without this, fire counts
 * would bleed across page loads within the same tab.
 */
export function resetForNavigation(tabId: number): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.fires = [];
  state.counters.clear();
  state.dnrSeen.clear();
}

// ── Fire ingestion ──────────────────────────────────────────────────

function appendFire(state: TabFireState, record: FireRecord): void {
  state.fires.push(record);
  if (state.fires.length > MAX_FIRES_PER_TAB) {
    state.fires.shift();
  }
  state.counters.set(record.ruleUid, (state.counters.get(record.ruleUid) ?? 0) + 1);
}

/**
 * Record a scriptable fire from a generated delay/body/mock/header-merge script.
 * No-op for untracked tabs. Called from the message handler when a `tabFire`
 * message arrives from the ISOLATED-world fire bridge.
 */
export function recordScriptFire(tabId: number, ruleUid: string, url: string, kind: FireKind, t: number): void {
  const state = tabs.get(tabId);
  if (!state) return;
  appendFire(state, { ruleUid, url, kind, t });
}

/**
 * Record a DNR probable-fire derived from webRequest matching. Deduped by
 * (ruleUid, url, t) to avoid double-counting redirects or other repeated
 * observations of the same underlying request. No-op for untracked tabs.
 */
export function recordDnrMatch(tabId: number, ruleUid: string, url: string, t: number): void {
  const state = tabs.get(tabId);
  if (!state) return;
  const dedupKey = `${ruleUid}:${url}:${t}`;
  if (state.dnrSeen.has(dedupKey)) return;
  state.dnrSeen.add(dedupKey);
  appendFire(state, { ruleUid, url, kind: 'dnr', t });
}

// ── Reads ───────────────────────────────────────────────────────────

export interface TabTelemetrySnapshot {
  /** Chronological fire log, capped at MAX_FIRES_PER_TAB. Most recent last. */
  fires: FireRecord[];
  /** Per-rule total counts — uncapped, accurate past the ring buffer. */
  counters: Record<string, number>;
}

/** Empty snapshot — returned for untracked tabs so consumers can render zero-state. */
const EMPTY_SNAPSHOT: TabTelemetrySnapshot = Object.freeze({
  fires: [] as FireRecord[],
  counters: {} as Record<string, number>,
});

export function getTabSnapshot(tabId: number): TabTelemetrySnapshot {
  const state = tabs.get(tabId);
  if (!state) return EMPTY_SNAPSHOT;
  const counters: Record<string, number> = {};
  for (const [uid, count] of state.counters) {
    counters[uid] = count;
  }
  return {
    fires: [...state.fires],
    counters,
  };
}

/**
 * Filtered snapshot — returns only fires and counters for the given rule uids.
 * Used by the test-runner when building TestSessionResult for a session's scope.
 */
export function getTabSnapshotForScope(tabId: number, scopeUids: Set<string>): TabTelemetrySnapshot {
  const state = tabs.get(tabId);
  if (!state) return EMPTY_SNAPSHOT;
  const fires = state.fires.filter((f) => scopeUids.has(f.ruleUid));
  const counters: Record<string, number> = {};
  for (const uid of scopeUids) {
    const count = state.counters.get(uid);
    if (count !== undefined) counters[uid] = count;
  }
  return { fires, counters };
}

// ── Test helpers ────────────────────────────────────────────────────

/** Reset all state — test-only. Not exported from the module index. */
export function __resetForTests(): void {
  tabs.clear();
}

export const __internals = {
  get tabCount(): number {
    return tabs.size;
  },
  get MAX_FIRES_PER_TAB(): number {
    return MAX_FIRES_PER_TAB;
  },
};
