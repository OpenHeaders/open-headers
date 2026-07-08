/**
 * Storage quota data plane — ONE plane, TWO transports, same arbitration
 * shape as the Cache Storage reads (`caches.ts`): the CDP tier
 * (`Storage.getUsageAndQuota`, probe-verified) answers with the per-type
 * usage breakdown when the tab is attached; any failure degrades to an
 * injected `navigator.storage.estimate()`, which reports totals only.
 * The origin is derived SW-side through `frame-origin.ts` — never
 * trusted from the panel.
 *
 * Clear-site-data rides `browsingData.remove({ origins })` — an
 * extension API (permission already held), so ONE transport that works
 * in both inspection modes; no CDP leg needed.
 */

import type { StorageQuotaBreakdownWire, StorageQuotaWire } from '@openheaders/core/bridge';
import type { CdpSend } from './cdp-plane-caches';
import { getAttachedStorageCdpSend } from './cdp-tier';
import { frameSecurityOrigin } from './frame-origin';
import { getStorageQuotaInjected } from './standard-plane-quota';

interface RawUsageBreakdownRow {
  storageType?: string;
  usage?: number;
}

async function getQuotaViaCdp(send: CdpSend, origin: string): Promise<StorageQuotaWire | null> {
  try {
    const res = (await send('Storage.getUsageAndQuota', { origin })) as
      | { usage?: number; quota?: number; usageBreakdown?: RawUsageBreakdownRow[] }
      | undefined;
    if (typeof res?.usage !== 'number' || typeof res.quota !== 'number') return null;
    const breakdown: StorageQuotaBreakdownWire[] = (res.usageBreakdown ?? []).flatMap((row) =>
      typeof row.storageType === 'string' && typeof row.usage === 'number'
        ? [{ storageType: row.storageType, usage: row.usage }]
        : [],
    );
    return { usage: res.usage, quota: res.quota, ...(breakdown.length > 0 ? { breakdown } : {}) };
  } catch {
    return null;
  }
}

/** The origin-scoped site-data types one clear removes (plan §5 row 6). */
const SITE_DATA_TO_REMOVE = {
  cacheStorage: true,
  cookies: true,
  indexedDB: true,
  localStorage: true,
  serviceWorkers: true,
} as const;

export async function clearSiteData(tabId: number, frameId: number): Promise<{ ok: boolean }> {
  if (!chrome.browsingData?.remove) return { ok: false };
  const origin = await frameSecurityOrigin(tabId, frameId);
  if (origin === null) return { ok: false };
  try {
    await chrome.browsingData.remove({ origins: [origin] }, SITE_DATA_TO_REMOVE);
    return { ok: true };
  } catch {
    // Permission denied / enterprise policy — surfaced as a failed clear.
    return { ok: false };
  }
}

export async function getStorageQuota(tabId: number, frameId: number): Promise<{ quota: StorageQuotaWire | null }> {
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await getQuotaViaCdp(send, origin);
      if (viaCdp !== null) return { quota: viaCdp };
    }
  }
  return getStorageQuotaInjected(tabId, frameId);
}
