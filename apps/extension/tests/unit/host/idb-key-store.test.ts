import { logger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOrCreateAtRestKey } from '@/host/idb-key-store';

// Mirrors the constants in idb-key-store.ts — the durable provisioning
// marker and the IndexedDB database that holds the at-rest key.
const MARKER_KEY = 'oh.host.atRestKeyProvisioned';
const DB_NAME = 'oh-secret-cipher';

/** Map-backed `chrome.storage.local` so the provisioning marker persists
 *  across loads within a test (and survives a simulated IDB eviction). */
function installMarkerStorage(): Map<string, unknown> {
  const data = new Map<string, unknown>();
  const local = {
    get: (keys: string[], cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (data.has(k)) out[k] = data.get(k);
      cb(out);
    },
    set: (items: Record<string, unknown>, cb: () => void) => {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
      cb();
    },
  };
  vi.stubGlobal('chrome', { storage: { local } });
  return data;
}

/** Drop the IndexedDB key store — the "key lost out from under the
 *  ciphertext" event the eviction tripwire exists to catch. */
function evictKeyStore(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('idb-key-store — at-rest key eviction detection', () => {
  let marker: Map<string, unknown>;

  beforeEach(async () => {
    await evictKeyStore();
    marker = installMarkerStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mints a key and sets the marker on first run, without warning', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const key = await loadOrCreateAtRestKey();
    expect(key).toBeDefined();
    expect(marker.get(MARKER_KEY)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reuses the provisioned key on a second load, without warning', async () => {
    await loadOrCreateAtRestKey();
    const warn = vi.spyOn(logger, 'warn');
    const key = await loadOrCreateAtRestKey();
    expect(key).toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and re-mints when the key is gone but the marker survives (eviction)', async () => {
    await loadOrCreateAtRestKey(); // provision: marker set + IDB key minted
    await evictKeyStore(); // IDB key lost; chrome.storage marker survives
    const warn = vi.spyOn(logger, 'warn');

    const key = await loadOrCreateAtRestKey();

    expect(key).toBeDefined();
    expect(warn).toHaveBeenCalledWith('AtRestKeyStore', expect.stringMatching(/unreadable|re-entered|absent/i));
    expect(marker.get(MARKER_KEY)).toBe(true);
  });
});
