/**
 * Per-tab environment-overrides store — the background half of the panel's
 * User-Agent / environment controls (CDP Control Plane, Phase F3).
 *
 * Like the throttle store and unlike the cache toggle there is NO fallback:
 * `Network.setUserAgentOverride` (and the F3b `Emulation.*` facets) are CDP-only,
 * so an override is meaningful only while the tab is CDP-attached (in scope).
 * This module owns the per-tab DESIRED overrides; the standing-state derive
 * (`deriveTabControlState`) reads it via {@link getTabOverridesForTab} and folds
 * it into the tab's `CdpTabControlState`, which the replay seam applies on every
 * (re-)attach.
 *
 * Persistence: the intent survives an SW eviction via `chrome.storage.session`
 * (rehydrated synchronously into the in-memory map at startup, before the first
 * attach), so a re-attach after wake replays the overrides rather than dropping
 * them. The map is authoritative; the panel reads/writes it over the bridge.
 *
 * Apply-now: a live change on an already-attached tab triggers a per-tab replay
 * through the registered seam, so setting an override takes effect immediately
 * instead of waiting for the next re-attach.
 */

import { readTabEnvironmentOverrides, type TabEnvironmentOverrides } from '@openheaders/core/types';
import { logger } from '@utils/logger';

const STORAGE_KEY = 'cdp.tabOverrides';

/** Per-tab desired environment overrides. Absent = no overrides. */
const overrides = new Map<number, TabEnvironmentOverrides>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** Registered by the lifecycle pipeline — re-applies a tab's standing CDP
 *  state so a live override change reaches an attached tab without a reattach. */
let replayTab: ((tabId: number) => void) | null = null;

function getSessionStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

export function getTabOverridesForTab(tabId: number): TabEnvironmentOverrides | null {
  return overrides.get(tabId) ?? null;
}

export function getActiveTabOverrideTabIds(): readonly number[] {
  return [...overrides.keys()];
}

/**
 * Register the per-tab replay seam. The pipeline wires this at startup (only on
 * hosts with CDP); before it lands a change still persists, it just won't
 * apply-now (there is nothing attached to apply to).
 */
export function registerTabOverridesReplay(replay: (tabId: number) => void): void {
  replayTab = replay;
}

/**
 * Set (or clear, with `null`) a tab's environment overrides. Updates the
 * in-memory map first so a triggered replay re-derives the new value, persists
 * the change, then replays the tab so an in-scope attachment applies it
 * immediately.
 */
export function setTabOverridesForTab(tabId: number, value: TabEnvironmentOverrides | null): void {
  if (value === null) overrides.delete(tabId);
  else overrides.set(tabId, value);
  schedulePersist();
  replayTab?.(tabId);
}

/**
 * Tab-close cleanup — drop the stored overrides and persist so the session store
 * doesn't accumulate entries for closed tabs.
 */
export function forgetTabOverridesForTab(tabId: number): void {
  if (!overrides.delete(tabId)) return;
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
  const obj: Record<string, TabEnvironmentOverrides> = {};
  for (const [tabId, value] of overrides.entries()) obj[String(tabId)] = value;
  try {
    await session.set({ [STORAGE_KEY]: obj });
  } catch (err) {
    logger.info('TabOverrides', `Persist failed: ${(err as Error).message}`);
  }
}

/**
 * Rebuild the in-memory map from `chrome.storage.session` on SW wake. Called
 * once at startup (awaited) BEFORE the first attach so the standing-state derive
 * sees the pre-eviction overrides and the replay re-applies them. Safe no-op
 * when session storage is unavailable.
 */
export async function rehydrateTabOverridesFromSession(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  try {
    const result = await session.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!raw || typeof raw !== 'object') return;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const tabId = Number(key);
      const parsed = readTabEnvironmentOverrides(value);
      if (Number.isInteger(tabId) && tabId > 0 && parsed) overrides.set(tabId, parsed);
    }
    if (overrides.size > 0) {
      logger.info('TabOverrides', `Rehydrated ${overrides.size} tab(s) from session storage`);
    }
  } catch (err) {
    logger.info('TabOverrides', `Rehydration failed: ${(err as Error).message}`);
  }
}

/** Test-only — drop all state so tests start from a clean module. */
export function __resetTabOverridesForTests(): void {
  overrides.clear();
  replayTab = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}
