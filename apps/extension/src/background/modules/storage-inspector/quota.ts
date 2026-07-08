/**
 * Storage quota data plane — ONE plane, TWO transports, same arbitration
 * shape as the Cache Storage reads (`caches.ts`): the CDP tier
 * (`Storage.getUsageAndQuota`, probe-verified) answers with the per-type
 * usage breakdown when the tab is attached; any failure degrades to an
 * injected `navigator.storage.estimate()`, which reports totals only.
 * The origin is derived SW-side through `frame-origin.ts` — never
 * trusted from the panel.
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
