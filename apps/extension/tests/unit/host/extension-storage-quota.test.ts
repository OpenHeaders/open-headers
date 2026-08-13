/**
 * ExtensionStorage quota-signal classification (S17): a storage write
 * whose `runtime.lastError` reads as a quota failure notifies the
 * injected observer exactly once per failing write; every other outcome
 * (success, non-quota error, unwired observer) stays silent and the
 * write itself still resolves — telemetry never changes storage
 * behavior.
 */

import { storageKey } from '@openheaders/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionStorage, setStorageQuotaObserver } from '@/host/extension-storage';

function api(): typeof chrome {
  return (globalThis as unknown as { chrome: typeof chrome }).chrome;
}

function setLastError(value: chrome.runtime.LastError | null): void {
  (api().runtime as unknown as { lastError: chrome.runtime.LastError | null }).lastError = value;
}

function mockSetWithError(message: string | null): void {
  const localArea = api().storage.local as unknown as { set: ReturnType<typeof vi.fn> };
  localArea.set.mockImplementation((_items: Record<string, unknown>, callback?: () => void) => {
    setLastError(message === null ? null : { message });
    callback?.();
    setLastError(null);
  });
}

const SPEC = storageKey<string>('oh.ws.test.value');

beforeEach(() => {
  setStorageQuotaObserver(null);
});

describe('setStorageQuotaObserver', () => {
  it('notifies on a quota-classified write failure and still resolves the write', async () => {
    const observer = vi.fn();
    setStorageQuotaObserver(observer);
    mockSetWithError('QUOTA_BYTES quota exceeded');
    await extensionStorage.set(SPEC, 'value');
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('classifies the per-item and item-count quota families too', async () => {
    const observer = vi.fn();
    setStorageQuotaObserver(observer);
    mockSetWithError('QUOTA_BYTES_PER_ITEM quota exceeded');
    await extensionStorage.set(SPEC, 'value');
    mockSetWithError('MAX_ITEMS quota exceeded');
    await extensionStorage.set(SPEC, 'value');
    expect(observer).toHaveBeenCalledTimes(2);
  });

  it('stays silent on success and on non-quota failures', async () => {
    const observer = vi.fn();
    setStorageQuotaObserver(observer);
    mockSetWithError(null);
    await extensionStorage.set(SPEC, 'value');
    mockSetWithError('An unexpected error occurred');
    await extensionStorage.set(SPEC, 'value');
    expect(observer).not.toHaveBeenCalled();
  });

  it('is inert while unwired — the write still resolves', async () => {
    mockSetWithError('QUOTA_BYTES quota exceeded');
    await expect(extensionStorage.set(SPEC, 'value')).resolves.toBeUndefined();
  });
});
