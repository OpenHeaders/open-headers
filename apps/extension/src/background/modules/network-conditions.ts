/**
 * Per-tab network-throttle store — the background half of the panel's
 * throttle dropdown (CDP Control Plane, Phase F2).
 *
 * Unlike the cache toggle there is NO DNR fallback: `Network.emulateNetworkConditions`
 * is the only mechanism, so a throttle profile is meaningful only while the tab
 * is CDP-attached (in scope). This module owns the per-tab DESIRED profile; the
 * standing-state derive (`deriveTabControlState`) reads it via
 * {@link getNetworkConditionsForTab} and folds it into the tab's
 * `CdpTabControlState`, which the replay seam applies on every (re-)attach.
 *
 * Persistence: the intent survives an SW eviction via `chrome.storage.session`
 * (rehydrated synchronously into the in-memory map at startup, before the first
 * attach), so a re-attach after wake replays the profile rather than dropping
 * it. The map is authoritative; the panel reads/writes it over the bridge.
 *
 * Apply-now: a live change on an already-attached tab triggers a per-tab replay
 * through the registered seam, so picking a profile takes effect immediately
 * instead of waiting for the next re-attach.
 */

import { type NetworkThrottleConditions, readNetworkThrottleConditions } from '@openheaders/core/types';
import { logger } from '@utils/logger';

const STORAGE_KEY = 'cdp.networkConditions';

/** Per-tab desired throttle profile. Absent = no throttle. */
const profiles = new Map<number, NetworkThrottleConditions>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** Registered by the lifecycle pipeline — re-applies a tab's standing CDP
 *  state so a live throttle change reaches an attached tab without a reattach. */
let replayTab: ((tabId: number) => void) | null = null;

function getSessionStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

export function getNetworkConditionsForTab(tabId: number): NetworkThrottleConditions | null {
  return profiles.get(tabId) ?? null;
}

export function getActiveNetworkConditionTabIds(): readonly number[] {
  return [...profiles.keys()];
}

/**
 * Register the per-tab replay seam. The pipeline wires this at startup (only on
 * hosts with CDP); before it lands a change still persists, it just won't
 * apply-now (there is nothing attached to apply to).
 */
export function registerNetworkConditionsReplay(replay: (tabId: number) => void): void {
  replayTab = replay;
}

/**
 * Set (or clear, with `null`) a tab's throttle profile. Updates the in-memory
 * map first so a triggered replay re-derives the new value, persists the change,
 * then replays the tab so an in-scope attachment applies it immediately.
 */
export function setNetworkConditionsForTab(tabId: number, conditions: NetworkThrottleConditions | null): void {
  if (conditions === null) profiles.delete(tabId);
  else profiles.set(tabId, conditions);
  schedulePersist();
  replayTab?.(tabId);
}

/**
 * Tab-close cleanup — drop the stored profile and persist so the session store
 * doesn't accumulate entries for closed tabs.
 */
export function forgetNetworkConditionsForTab(tabId: number): void {
  if (!profiles.delete(tabId)) return;
  schedulePersist();
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, 50);
}

async function persistNow(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  const obj: Record<string, NetworkThrottleConditions> = {};
  for (const [tabId, conditions] of profiles.entries()) obj[String(tabId)] = conditions;
  try {
    await session.set({ [STORAGE_KEY]: obj });
  } catch (err) {
    logger.info('NetworkConditions', `Persist failed: ${(err as Error).message}`);
  }
}

/**
 * Rebuild the in-memory map from `chrome.storage.session` on SW wake. Called
 * once at startup (awaited) BEFORE the first attach so the standing-state derive
 * sees the pre-eviction profile and the replay re-applies it. Safe no-op when
 * session storage is unavailable.
 */
export async function rehydrateNetworkConditionsFromSession(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  try {
    const result = await session.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!raw || typeof raw !== 'object') return;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const tabId = Number(key);
      const conditions = readNetworkThrottleConditions(value);
      if (Number.isInteger(tabId) && tabId > 0 && conditions) profiles.set(tabId, conditions);
    }
    if (profiles.size > 0) {
      logger.info('NetworkConditions', `Rehydrated ${profiles.size} tab(s) from session storage`);
    }
  } catch (err) {
    logger.info('NetworkConditions', `Rehydration failed: ${(err as Error).message}`);
  }
}

/** Test-only — drop all state so tests start from a clean module. */
export function __resetNetworkConditionsForTests(): void {
  profiles.clear();
  replayTab = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}
