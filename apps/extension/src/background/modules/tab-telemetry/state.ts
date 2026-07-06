/**
 * Telemetry state core — tunables, the per-tab `TabState` records and
 * the `tabs` map every other tab-telemetry module coordinates through,
 * the fire-listener registries + subscriptions, the tracking lifecycle,
 * and the test-only hooks.
 */

import type { RequestRecord } from '@openheaders/core/types';
import type { TrackingReason } from './types';

// ── Tunables ────────────────────────────────────────────────────────

/** Ring buffer cap for the chronological fire log. Counters keep growing past this. */
export const MAX_FIRES_PER_TAB = 1000;

/**
 * Soft cap on unique URLs tracked per rule per tab. LRU eviction — on overflow,
 * the oldest entry by last-touch order is dropped. A long-lived SPA hitting a
 * REST API with path parameters can easily accumulate thousands of unique
 * URLs for one rule; 10k covers any reasonable debugging session without
 * pathological memory growth. Tune here if needed.
 */
export const MAX_UNIQUE_URLS_PER_RULE = 10_000;

/**
 * Buffer window for observed fires of "deferred" rule types (types that might
 * also emit a scriptable fire). Within this window:
 *   - a matching scriptable fire drains the buffer (scriptable wins, no count)
 *   - a late observed fire is suppressed if a scriptable already won
 *   - if neither happens, the observed fire is promoted as 'matched-fallback'
 * 500ms is the smallest value that comfortably covers the MAIN→ISOLATED
 * postMessage + runtime.sendMessage hops on slow pages.
 */
export const FALLBACK_WINDOW_MS = 500;

// ── Internal state ──────────────────────────────────────────────────

export interface PendingFire {
  requestId: string;
  record: RequestRecord;
  /** See ObservedFireMeta.commitGated — the record only exists if the
   *  document commits; onMainFrameError drops it instead of promoting. */
  commitGated?: boolean;
}

export interface PendingFallback {
  record: RequestRecord;
  timer: ReturnType<typeof setTimeout>;
}

export interface TabState {
  tabId: number;
  reasons: Set<TrackingReason>;
  currentPageUrl: string | null;
  fires: RequestRecord[];
  counters: Map<string, number>;
  uniquesByRule: Map<string, Map<string, RequestRecord>>;
  pendingFires: PendingFire[];
  pendingFallback: Map<string, PendingFallback>;
  /** Map<`${uid}:${normalizedUrl}`, expiryMs>. Suppresses late observed fires. */
  recentScriptable: Map<string, number>;
  /** `${uid}:${requestId}` — observed-fire dedup across redirect chains. */
  seen: Set<string>;
}

export const tabs: Map<number, TabState> = new Map();

/**
 * Per-tab fire subscribers. Notified for every record that lands in the
 * counters (post-fallback drain, post-promotion). Used by the test-runner
 * to push live fire counts into its in-page widget without polling. Listeners
 * MUST NOT call back into telemetry (no re-entrancy guard).
 */
type FireListener = (record: RequestRecord) => void;
const fireListeners: Map<number, Set<FireListener>> = new Map();

/**
 * Cross-tab fire subscribers. Notified for every fire on every tab. Used
 * by the rule-fire hub bridge to feed the per-tab broadcaster without
 * needing a per-tab subscription dance.
 */
type GlobalFireListener = (tabId: number, record: RequestRecord) => void;
const globalFireListeners: Set<GlobalFireListener> = new Set();

function emptyState(tabId: number): TabState {
  return {
    tabId,
    reasons: new Set(),
    currentPageUrl: null,
    fires: [],
    counters: new Map(),
    uniquesByRule: new Map(),
    pendingFires: [],
    pendingFallback: new Map(),
    recentScriptable: new Map(),
    seen: new Set(),
  };
}

export function emitFire(tabId: number, record: RequestRecord): void {
  const set = fireListeners.get(tabId);
  if (set && set.size > 0) {
    for (const fn of set) {
      try {
        fn(record);
      } catch {
        // Subscriber failures must never corrupt telemetry state.
      }
    }
  }
  for (const fn of globalFireListeners) {
    try {
      fn(tabId, record);
    } catch {
      // Subscriber failures must never corrupt telemetry state.
    }
  }
}

/**
 * Subscribe to every fire that lands in this tab's counters. Returns an
 * unsubscribe function. Listeners are independent of tracking reasons —
 * they fire as long as the tab has any tracking reason active. Used by
 * the test-runner to drive its in-page widget without polling.
 */
export function subscribeFiresAll(listener: GlobalFireListener): () => void {
  globalFireListeners.add(listener);
  return () => {
    globalFireListeners.delete(listener);
  };
}

export function subscribeFires(tabId: number, listener: FireListener): () => void {
  let set = fireListeners.get(tabId);
  if (!set) {
    set = new Set();
    fireListeners.set(tabId, set);
  }
  set.add(listener);
  return () => {
    const current = fireListeners.get(tabId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) fireListeners.delete(tabId);
  };
}

export function normalizeForAttribution(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url;
    // Strip the fragment — Chrome drops it from DNR matching and we don't
    // want `/page#a` vs `/page#b` treated as different URLs.
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

export function fallbackKey(ruleUid: string, normalizedUrl: string): string {
  return `${ruleUid}:${normalizedUrl}`;
}

// ── Tracking lifecycle ──────────────────────────────────────────────

export function startTracking(tabId: number, reason: TrackingReason): void {
  let state = tabs.get(tabId);
  if (!state) {
    state = emptyState(tabId);
    tabs.set(tabId, state);
  }
  state.reasons.add(reason);
}

export function stopTracking(tabId: number, reason: TrackingReason): void {
  const state = tabs.get(tabId);
  if (!state) return;
  state.reasons.delete(reason);
  if (state.reasons.size === 0) {
    disposeTab(state);
    tabs.delete(tabId);
  }
}

export function isTracked(tabId: number): boolean {
  return tabs.has(tabId);
}

/** Fully remove all state for a tab — used on tab close. */
export function clearTab(tabId: number): void {
  const state = tabs.get(tabId);
  if (!state) return;
  disposeTab(state);
  tabs.delete(tabId);
  fireListeners.delete(tabId);
}

function disposeTab(state: TabState): void {
  for (const entry of state.pendingFallback.values()) {
    clearTimeout(entry.timer);
  }
  state.pendingFallback.clear();
}

// ── Test helpers ────────────────────────────────────────────────────

/** Reset all state — test-only. */
export function __resetForTests(): void {
  for (const state of tabs.values()) disposeTab(state);
  tabs.clear();
  fireListeners.clear();
}

export const __internals = {
  get tabCount(): number {
    return tabs.size;
  },
  get MAX_FIRES_PER_TAB(): number {
    return MAX_FIRES_PER_TAB;
  },
  get MAX_UNIQUE_URLS_PER_RULE(): number {
    return MAX_UNIQUE_URLS_PER_RULE;
  },
  get FALLBACK_WINDOW_MS(): number {
    return FALLBACK_WINDOW_MS;
  },
  getState(tabId: number): TabState | undefined {
    return tabs.get(tabId);
  },
};
