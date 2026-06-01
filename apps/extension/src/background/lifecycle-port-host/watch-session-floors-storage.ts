/**
 * `chrome.storage.session`-backed `WatchSessionFloors`.
 *
 * The watch-session floor must outlive an SW restart — otherwise a cold
 * service worker would re-establish a new floor at the current watermark
 * on reconnect and drop the requests the panel was already showing. Memory
 * alone (the oracle default) doesn't survive eviction; this adapter mirrors
 * the floor map into `chrome.storage.session` (which persists across SW
 * restarts but clears when the browser session ends — the right lifetime
 * for a watch session).
 *
 * `resolveFloor` is synchronous (the hub calls it inside the attach block),
 * so reads come from an in-memory cache hydrated from storage on startup.
 * `ready` resolves once hydration is done; the port host awaits it before
 * the first attach so a reconnect resolves the persisted floor rather than
 * minting a fresh one. Writes are infrequent (a tab's floor is established
 * once, reset on Clear, dropped on tab close), so they go straight through.
 */

import type { WatchSessionFloors } from '@openheaders/oracle/request-lifecycle-hub';

const STORAGE_KEY = 'oh.watchSessionFloors';

export interface PersistentWatchSessionFloors extends WatchSessionFloors {
  /** Resolves once the in-memory cache has hydrated from storage. */
  readonly ready: Promise<void>;
}

function sessionArea(): chrome.storage.StorageArea | null {
  return chrome?.storage?.session ?? null;
}

export function createPersistentWatchSessionFloors(): PersistentWatchSessionFloors {
  const floors = new Map<number, number>();

  const ready = (async () => {
    const area = sessionArea();
    if (!area) return;
    try {
      const stored = await area.get(STORAGE_KEY);
      const raw = stored?.[STORAGE_KEY];
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) {
          const tabId = Number(key);
          // A floor set after startup (resolve/reset before hydration
          // finished) wins over the persisted snapshot — don't clobber it.
          if (Number.isFinite(tabId) && typeof value === 'number' && !floors.has(tabId)) {
            floors.set(tabId, value);
          }
        }
      }
    } catch {
      // Storage unavailable — degrade to in-memory for this session.
    }
  })();

  const persist = (): void => {
    const area = sessionArea();
    if (!area) return;
    const obj: Record<string, number> = {};
    for (const [tabId, floor] of floors) obj[tabId] = floor;
    void area.set({ [STORAGE_KEY]: obj }).catch(() => {});
  };

  return {
    ready,
    resolveFloor(tabId, establishAtMs) {
      const existing = floors.get(tabId);
      if (existing !== undefined) return existing;
      floors.set(tabId, establishAtMs);
      persist();
      return establishAtMs;
    },
    reset(tabId, floorMs) {
      floors.set(tabId, floorMs);
      persist();
    },
    forget(tabId) {
      if (floors.delete(tabId)) persist();
    },
  };
}
