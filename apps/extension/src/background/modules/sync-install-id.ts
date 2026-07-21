/**
 * Stable per-install sync identity — the HELLO `installId`.
 *
 * Minted once per extension install and persisted in
 * `chrome.storage.local`; every backend HELLO carries it so the server
 * can re-bind peer-scoped state (telemetry watch partitions) to the
 * same peer across reconnects. The HELLO `nodeId` cannot serve that
 * role: it is the ACTIVE workspace's HLC writer identity, which
 * changes after a join → adopt, orphaning any server state keyed on it
 * the moment the wire flaps.
 *
 * Hydrated in the settings boot phase, before the backend registry
 * warms — the connection plane never dials ahead of it, so HELLO
 * always carries the id. `peekSyncInstallId` stays synchronous because
 * HELLO construction is synchronous; it returns null only before
 * hydration (a cold call the boot ordering rules out).
 */

import { storage } from '@utils/browser-api';

const STORAGE_KEY = 'oh.syncInstallId';

let cached: string | null = null;

export async function hydrateSyncInstallId(): Promise<void> {
  const existing = await new Promise<string | null>((resolve) => {
    storage.local.get(STORAGE_KEY, (items) => {
      const value = items?.[STORAGE_KEY];
      resolve(typeof value === 'string' && value.length > 0 ? value : null);
    });
  });
  if (existing) {
    cached = existing;
    return;
  }
  const minted = `ext-${crypto.randomUUID()}`;
  await new Promise<void>((resolve) => {
    storage.local.set({ [STORAGE_KEY]: minted }, () => resolve());
  });
  cached = minted;
}

export function peekSyncInstallId(): string | null {
  return cached;
}
