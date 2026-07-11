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
 * in both inspection modes; no CDP leg needed. The optional `types`
 * subset parameterizes the SAME call's dataTypes map. The one type
 * outside that API's reach is session storage (per-tab, in-memory —
 * no browser-level clear exists), so its leg rides the DOM-storage
 * plane's clear against the inspected frame instead.
 *
 * Quota simulation (`Storage.overrideQuotaForOrigin`) is CDP-tier-only
 * — the page-side API has no such control, so a detached tab reads a
 * failed override, never a silent no-op.
 */

import type { SiteDataTypeWire, StorageQuotaBreakdownWire, StorageQuotaWire } from '@openheaders/core/bridge';
import type { CdpSend } from './cdp-plane-caches';
import { getAttachedStorageCdpSend } from './cdp-tier';
import { frameSecurityOrigin } from './frame-origin';
import { clearDomStorage } from './standard-plane';
import { getStorageQuotaInjected } from './standard-plane-quota';

interface RawUsageBreakdownRow {
  storageType?: string;
  usage?: number;
}

async function getQuotaViaCdp(send: CdpSend, origin: string): Promise<StorageQuotaWire | null> {
  try {
    const res = (await send('Storage.getUsageAndQuota', { origin })) as
      | { usage?: number; quota?: number; usageBreakdown?: RawUsageBreakdownRow[]; overrideActive?: boolean }
      | undefined;
    if (typeof res?.usage !== 'number' || typeof res.quota !== 'number') return null;
    const breakdown: StorageQuotaBreakdownWire[] = (res.usageBreakdown ?? []).flatMap((row) =>
      typeof row.storageType === 'string' && typeof row.usage === 'number'
        ? [{ storageType: row.storageType, usage: row.usage }]
        : [],
    );
    return {
      usage: res.usage,
      quota: res.quota,
      ...(breakdown.length > 0 ? { breakdown } : {}),
      ...(res.overrideActive === true ? { overrideActive: true } : {}),
    };
  } catch {
    return null;
  }
}

/** The site-data types one clear can remove (plan §5 row 6). */
const SITE_DATA_TYPES: ReadonlyArray<SiteDataTypeWire> = [
  'cacheStorage',
  'cookies',
  'indexedDB',
  'localStorage',
  'serviceWorkers',
  'sessionStorage',
];

type BrowsingDataType = Exclude<SiteDataTypeWire, 'sessionStorage'>;

export async function clearSiteData(
  tabId: number,
  frameId: number,
  types?: ReadonlyArray<SiteDataTypeWire>,
): Promise<{ ok: boolean }> {
  // Clamp to the known set; a provided-but-empty selection is a failed
  // clear, never a silent no-op claiming success.
  const selected = types === undefined ? SITE_DATA_TYPES : SITE_DATA_TYPES.filter((type) => types.includes(type));
  if (selected.length === 0) return { ok: false };
  const browsingDataTypes = selected.filter((type): type is BrowsingDataType => type !== 'sessionStorage');
  let ok = true;
  if (browsingDataTypes.length > 0) {
    if (!chrome.browsingData?.remove) return { ok: false };
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin === null) return { ok: false };
    const toRemove: Partial<Record<BrowsingDataType, boolean>> = {};
    for (const type of browsingDataTypes) toRemove[type] = true;
    try {
      await chrome.browsingData.remove({ origins: [origin] }, toRemove);
    } catch {
      // Permission denied / enterprise policy — surfaced as a failed clear.
      ok = false;
    }
  }
  // Session storage's leg — the injected in-frame clear (per-tab by
  // nature; this wipes the INSPECTED tab's frame).
  if (selected.includes('sessionStorage')) {
    const sessionLeg = await clearDomStorage(tabId, frameId, 'session');
    ok = ok && sessionLeg.ok;
  }
  return { ok };
}

export async function setQuotaOverride(tabId: number, frameId: number, quotaBytes?: number): Promise<{ ok: boolean }> {
  if (quotaBytes !== undefined && !(Number.isFinite(quotaBytes) && quotaBytes >= 0)) return { ok: false };
  const send = getAttachedStorageCdpSend(tabId);
  if (!send) return { ok: false };
  const origin = await frameSecurityOrigin(tabId, frameId);
  if (origin === null) return { ok: false };
  try {
    await send(
      'Storage.overrideQuotaForOrigin',
      quotaBytes === undefined ? { origin } : { origin, quotaSize: quotaBytes },
    );
    return { ok: true };
  } catch {
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
