/**
 * Storage quota data plane (the storage-panel plan §5, slice 6) — the
 * injected `navigator.storage.estimate()` func runs against a stubbed
 * `navigator.storage`; the arbitrated RPC surface is exercised over both
 * transports: CDP `Storage.getUsageAndQuota` (with the per-type
 * breakdown) via a fake cdp-tier access seam, injection via the mocked
 * `chrome.scripting`.
 */

import type { SiteDataTypeWire } from '@openheaders/core/bridge';
import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest';
import {
  __resetStorageCdpAccessForTests,
  registerStorageCdpAccess,
  type StorageCdpAccess,
} from '@/background/modules/storage-inspector/cdp-tier';
import { clearSiteData, getStorageQuota, setQuotaOverride } from '@/background/modules/storage-inspector/quota';
import { readStorageEstimateInPage } from '@/background/modules/storage-inspector/standard-plane-quota';

const executeScriptSpy = (): ReturnType<typeof vi.fn> =>
  chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>;
const getFrameSpy = (): ReturnType<typeof vi.fn> =>
  chrome.webNavigation.getFrame as unknown as ReturnType<typeof vi.fn>;
const browsingDataRemoveSpy = (): ReturnType<typeof vi.fn> =>
  chrome.browsingData.remove as unknown as ReturnType<typeof vi.fn>;

function installNavigatorStorage(estimate: (() => Promise<StorageEstimate>) | undefined): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: estimate ? { storage: { estimate } } : {},
    configurable: true,
    writable: true,
  });
}

function removeNavigatorGlobal(): void {
  Reflect.deleteProperty(globalThis, 'navigator');
}

beforeEach(() => {
  executeScriptSpy().mockReset();
  getFrameSpy().mockReset();
  getFrameSpy().mockResolvedValue(null);
  browsingDataRemoveSpy().mockReset();
  browsingDataRemoveSpy().mockResolvedValue(undefined);
});

afterEach(() => {
  removeNavigatorGlobal();
  __resetStorageCdpAccessForTests();
});

describe('readStorageEstimateInPage', () => {
  it('reads the origin totals from navigator.storage.estimate()', async () => {
    installNavigatorStorage(() => Promise.resolve({ usage: 2048, quota: 120_000_000 }));
    expect(await readStorageEstimateInPage()).toEqual({ usage: 2048, quota: 120_000_000 });
  });

  it('reads null without navigator.storage (non-secure context)', async () => {
    installNavigatorStorage(undefined);
    expect(await readStorageEstimateInPage()).toBeNull();
    removeNavigatorGlobal();
    expect(await readStorageEstimateInPage()).toBeNull();
  });

  it('reads null when estimate rejects or reports no numbers', async () => {
    installNavigatorStorage(() => Promise.reject(new Error('denied')));
    expect(await readStorageEstimateInPage()).toBeNull();
    installNavigatorStorage(() => Promise.resolve({}));
    expect(await readStorageEstimateInPage()).toBeNull();
  });
});

describe('arbitrated RPC surface — injected transport (detached)', () => {
  it('maps the injected estimate to the wire shape', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { usage: 2048, quota: 120_000_000 } }]);
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 2048, quota: 120_000_000 });
  });

  it('reports injection failure or an unreadable frame as null', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await getStorageQuota(1, 0)).quota).toBeNull();

    executeScriptSpy().mockResolvedValue([{ result: null }]);
    expect((await getStorageQuota(1, 0)).quota).toBeNull();
  });
});

describe('clearSiteData', () => {
  it('clears the origin-scoped types through browsingData.remove plus the injected session-storage leg', async () => {
    getFrameSpy().mockResolvedValue({ url: 'https://openheaders.io/app' });
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await clearSiteData(1, 0)).toEqual({ ok: true });
    expect(browsingDataRemoveSpy()).toHaveBeenCalledWith(
      { origins: ['https://openheaders.io'] },
      { cacheStorage: true, cookies: true, indexedDB: true, localStorage: true, serviceWorkers: true },
    );
    // Session storage rides the DOM-storage plane, not browsingData.
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['session']);
  });

  it('fails without touching the API when the origin cannot be derived', async () => {
    expect(await clearSiteData(1, 0)).toEqual({ ok: false });
    expect(browsingDataRemoveSpy()).not.toHaveBeenCalled();
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('surfaces a rejected remove as a failed clear', async () => {
    getFrameSpy().mockResolvedValue({ url: 'https://openheaders.io/app' });
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    browsingDataRemoveSpy().mockRejectedValue(new Error('policy denied'));
    expect(await clearSiteData(1, 0)).toEqual({ ok: false });
  });

  it('clears a session-only selection through injection without touching browsingData', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await clearSiteData(1, 0, ['sessionStorage'])).toEqual({ ok: true });
    expect(browsingDataRemoveSpy()).not.toHaveBeenCalled();
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed session-storage leg as a failed clear', async () => {
    getFrameSpy().mockResolvedValue({ url: 'https://openheaders.io/app' });
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect(await clearSiteData(1, 0, ['localStorage', 'sessionStorage'])).toEqual({ ok: false });
    expect(browsingDataRemoveSpy()).toHaveBeenCalled();
  });

  it('narrows the clear to a provided types subset, dropping unknown entries', async () => {
    getFrameSpy().mockResolvedValue({ url: 'https://openheaders.io/app' });
    const withUnknown = ['cacheStorage', 'localStorage', 'passwords'] as ReadonlyArray<SiteDataTypeWire>;
    expect(await clearSiteData(1, 0, withUnknown)).toEqual({ ok: true });
    expect(browsingDataRemoveSpy()).toHaveBeenCalledWith(
      { origins: ['https://openheaders.io'] },
      { cacheStorage: true, localStorage: true },
    );
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('fails a provided-but-empty selection without touching the API', async () => {
    getFrameSpy().mockResolvedValue({ url: 'https://openheaders.io/app' });
    expect(await clearSiteData(1, 0, [])).toEqual({ ok: false });
    const unknownOnly: ReadonlyArray<string> = ['passwords'];
    expect(await clearSiteData(1, 0, unknownOnly as ReadonlyArray<SiteDataTypeWire>)).toEqual({ ok: false });
    expect(browsingDataRemoveSpy()).not.toHaveBeenCalled();
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });
});

describe('arbitrated RPC surface — CDP transport (attached)', () => {
  const ORIGIN = 'https://openheaders.io';

  function installCdp(send: StorageCdpAccess['send'], attached = true): Array<{ method: string; params: unknown }> {
    const calls: Array<{ method: string; params: unknown }> = [];
    registerStorageCdpAccess({
      isAttached: () => attached,
      send: (tabId, method, params) => {
        calls.push({ method, params });
        return send(tabId, method, params);
      },
      subscribeStorageUpdated: () => () => {},
      onDetach: () => () => {},
    });
    return calls;
  }

  beforeEach(() => {
    getFrameSpy().mockResolvedValue({ url: `${ORIGIN}/app` });
  });

  it('reads usage, quota and the per-type breakdown through Storage.getUsageAndQuota without injecting', async () => {
    const calls = installCdp((_tabId, method) => {
      if (method === 'Storage.getUsageAndQuota') {
        return Promise.resolve({
          usage: 4096,
          quota: 120_000_000,
          usageBreakdown: [
            { storageType: 'indexeddb', usage: 3072 },
            { storageType: 'cache_storage', usage: 1024 },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected ${method}`));
    });

    expect((await getStorageQuota(1, 0)).quota).toEqual({
      usage: 4096,
      quota: 120_000_000,
      breakdown: [
        { storageType: 'indexeddb', usage: 3072 },
        { storageType: 'cache_storage', usage: 1024 },
      ],
    });
    expect(calls[0]).toEqual({ method: 'Storage.getUsageAndQuota', params: { origin: ORIGIN } });
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('drops malformed breakdown rows and omits an empty breakdown', async () => {
    installCdp(() =>
      Promise.resolve({ usage: 10, quota: 100, usageBreakdown: [{ storageType: 'indexeddb' }, { usage: 5 }] }),
    );
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 10, quota: 100 });
  });

  it('marks an active quota override on the snapshot, omitting the field otherwise', async () => {
    installCdp(() => Promise.resolve({ usage: 10, quota: 20_000_000, overrideActive: true }));
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 10, quota: 20_000_000, overrideActive: true });

    installCdp(() => Promise.resolve({ usage: 10, quota: 100, overrideActive: false }));
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 10, quota: 100 });
  });

  it('degrades to injection when the CDP op fails', async () => {
    installCdp(() => Promise.reject(new Error('detached mid-flight')));
    executeScriptSpy().mockResolvedValue([{ result: { usage: 1, quota: 2 } }]);

    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 1, quota: 2 });
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  it('uses injection when the tab is not attached or the origin cannot be derived', async () => {
    installCdp(() => Promise.reject(new Error('must not be called')), false);
    executeScriptSpy().mockResolvedValue([{ result: { usage: 1, quota: 2 } }]);
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 1, quota: 2 });

    getFrameSpy().mockResolvedValue(null);
    installCdp(() => Promise.reject(new Error('must not be called')));
    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { usage: 1, quota: 2 } }]);
    expect((await getStorageQuota(1, 0)).quota).toEqual({ usage: 1, quota: 2 });
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  describe('setQuotaOverride (CDP-only, no injected leg)', () => {
    it('sets the override through Storage.overrideQuotaForOrigin', async () => {
      const calls = installCdp(() => Promise.resolve({}));
      expect(await setQuotaOverride(1, 0, 20_000_000)).toEqual({ ok: true });
      expect(calls).toEqual([
        { method: 'Storage.overrideQuotaForOrigin', params: { origin: ORIGIN, quotaSize: 20_000_000 } },
      ]);
    });

    it('clears the override by omitting quotaSize', async () => {
      const calls = installCdp(() => Promise.resolve({}));
      expect(await setQuotaOverride(1, 0)).toEqual({ ok: true });
      expect(calls).toEqual([{ method: 'Storage.overrideQuotaForOrigin', params: { origin: ORIGIN } }]);
    });

    it('fails on a detached tab or an underivable origin without sending', async () => {
      const detachedCalls = installCdp(() => Promise.resolve({}), false);
      expect(await setQuotaOverride(1, 0, 20_000_000)).toEqual({ ok: false });
      expect(detachedCalls).toEqual([]);

      getFrameSpy().mockResolvedValue(null);
      const attachedCalls = installCdp(() => Promise.resolve({}));
      expect(await setQuotaOverride(1, 0, 20_000_000)).toEqual({ ok: false });
      expect(attachedCalls).toEqual([]);
    });

    it('rejects a malformed quota without sending', async () => {
      const calls = installCdp(() => Promise.resolve({}));
      expect(await setQuotaOverride(1, 0, -1)).toEqual({ ok: false });
      expect(await setQuotaOverride(1, 0, Number.NaN)).toEqual({ ok: false });
      expect(calls).toEqual([]);
    });

    it('surfaces a rejected send as a failed override', async () => {
      installCdp(() => Promise.reject(new Error('detached mid-flight')));
      expect(await setQuotaOverride(1, 0, 20_000_000)).toEqual({ ok: false });
    });
  });
});
