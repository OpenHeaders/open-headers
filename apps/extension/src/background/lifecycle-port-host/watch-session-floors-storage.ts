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
 * once, advanced per DevTools session, reset on Clear, dropped on tab
 * close), so they go straight through.
 *
 * Each entry persists the floor AND its DevTools-session token, so an
 * SW-eviction reconnect that replays the same token recognizes the live
 * session (`startSession` → no-op) instead of advancing the floor and
 * dropping the in-flight log.
 */

import type { WatchSessionFloors } from '@openheaders/oracle/request-lifecycle-hub';

const STORAGE_KEY = 'oh.watchSessionFloors';

interface StoredFloor {
  readonly floor: number;
  readonly token?: string;
}

export interface PersistentWatchSessionFloors extends WatchSessionFloors {
  /** Resolves once the in-memory cache has hydrated from storage. */
  readonly ready: Promise<void>;
}

function sessionArea(): chrome.storage.StorageArea | null {
  return chrome?.storage?.session ?? null;
}

function isStoredFloor(value: unknown): value is StoredFloor {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredFloor).floor === 'number' &&
    ((value as StoredFloor).token === undefined || typeof (value as StoredFloor).token === 'string')
  );
}

export function createPersistentWatchSessionFloors(): PersistentWatchSessionFloors {
  const floors = new Map<number, StoredFloor>();

  const ready = (async () => {
    const area = sessionArea();
    if (!area) return;
    try {
      const stored = await area.get(STORAGE_KEY);
      const raw = stored?.[STORAGE_KEY];
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) {
          const tabId = Number(key);
          // An entry set after startup (resolve/start/reset before hydration
          // finished) wins over the persisted snapshot — don't clobber it.
          if (Number.isFinite(tabId) && isStoredFloor(value) && !floors.has(tabId)) {
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
    const obj: Record<string, StoredFloor> = {};
    for (const [tabId, entry] of floors) obj[tabId] = entry;
    void area.set({ [STORAGE_KEY]: obj }).catch(() => {});
  };

  return {
    ready,
    resolveFloor(tabId, establishAtMs) {
      const existing = floors.get(tabId);
      if (existing !== undefined) return existing.floor;
      floors.set(tabId, { floor: establishAtMs });
      persist();
      return establishAtMs;
    },
    startSession(tabId, token, floorMs) {
      const existing = floors.get(tabId);
      if (existing?.token === token) return false;
      floors.set(tabId, { floor: floorMs, token });
      persist();
      return true;
    },
    sessionToken(tabId) {
      return floors.get(tabId)?.token;
    },
    reset(tabId, floorMs) {
      floors.set(tabId, { floor: floorMs, token: floors.get(tabId)?.token });
      persist();
    },
    forget(tabId) {
      if (floors.delete(tabId)) persist();
    },
  };
}
