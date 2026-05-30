import { storageKey } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserSecretCipher } from '@/host/browser-secret-cipher';
import { ExtensionStorage } from '@/host/extension-storage';

// ── Deterministic, observable stub cipher ────────────────────────────
// `SEALED(<plaintext>)` makes "did this slot get encrypted?" trivially
// assertable, while still proving JSON round-trips through the seam.
function makeStubCipher(available = true): BrowserSecretCipher {
  return {
    isAvailable: () => available,
    encrypt: (plaintext) => Promise.resolve(`SEALED(${plaintext})`),
    decrypt: (blob) => {
      const match = /^SEALED\(([\s\S]*)\)$/.exec(blob);
      if (!match) return Promise.reject(new Error('stub: unrecognized blob'));
      return Promise.resolve(match[1]);
    },
  };
}

// ── Functional in-memory chrome.storage.local + onChanged ────────────
type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

function installFakeChromeStorage(): { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const listeners = new Set<ChangeListener>();
  const local = {
    get: (keys: string[], cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (data.has(k)) out[k] = data.get(k);
      cb(out);
    },
    set: (items: Record<string, unknown>, cb: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data.get(k), newValue: v };
        data.set(k, v);
      }
      cb();
      for (const fn of listeners) fn(changes, 'local');
    },
    remove: (keys: string[], cb: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const k of keys) {
        changes[k] = { oldValue: data.get(k), newValue: undefined };
        data.delete(k);
      }
      cb();
      for (const fn of listeners) fn(changes, 'local');
    },
  };
  vi.stubGlobal('chrome', {
    storage: {
      local,
      sync: local,
      onChanged: {
        addListener: (fn: ChangeListener) => listeners.add(fn),
        removeListener: (fn: ChangeListener) => listeners.delete(fn),
      },
    },
  });
  return { data };
}

const secretKey = storageKey<{ seed: string }>('oh.test.secret', { sensitive: true });
const plainKey = storageKey<{ label: string }>('oh.test.plain');

describe('ExtensionStorage — sensitive slot encryption', () => {
  let store: ReturnType<typeof installFakeChromeStorage>;

  beforeEach(() => {
    store = installFakeChromeStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('seals a sensitive value at rest and never persists it as plain JSON', async () => {
    const adapter = new ExtensionStorage(makeStubCipher());
    await adapter.set(secretKey, { seed: 'JBSWY3DPEHPK3PXP' });

    const atRest = store.data.get('oh.test.secret');
    expect(atRest).toBe('SEALED({"seed":"JBSWY3DPEHPK3PXP"})'); // a string blob, not the raw object
    expect(typeof atRest).toBe('string');
    expect(await adapter.get(secretKey)).toEqual({ seed: 'JBSWY3DPEHPK3PXP' });
  });

  it('leaves a non-sensitive value as a raw object', async () => {
    const adapter = new ExtensionStorage(makeStubCipher());
    await adapter.set(plainKey, { label: 'public' });
    expect(store.data.get('oh.test.plain')).toEqual({ label: 'public' });
    expect(await adapter.get(plainKey)).toEqual({ label: 'public' });
  });

  it('refuses to write a sensitive slot when the cipher is unavailable', async () => {
    const adapter = new ExtensionStorage(makeStubCipher(false));
    await expect(adapter.set(secretKey, { seed: 's' })).rejects.toThrow(/plaintext|unavailable/i);
    expect(store.data.has('oh.test.secret')).toBe(false);
  });

  it('reads back undefined (never the blob) when decryption fails', async () => {
    const adapter = new ExtensionStorage(makeStubCipher());
    store.data.set('oh.test.secret', 'not-a-sealed-blob');
    expect(await adapter.get(secretKey)).toBeUndefined();
  });

  it('decrypts sensitive values through getMany alongside plain ones', async () => {
    const adapter = new ExtensionStorage(makeStubCipher());
    await adapter.setMany([
      [secretKey, { seed: 'multi' }],
      [plainKey, { label: 'multi-plain' }],
    ]);
    expect(store.data.get('oh.test.secret')).toBe('SEALED({"seed":"multi"})');

    const out = await adapter.getMany({ secret: secretKey, plain: plainKey });
    expect(out.secret).toEqual({ seed: 'multi' });
    expect(out.plain).toEqual({ label: 'multi-plain' });
  });

  it('decrypts the new value delivered to a sensitive-slot subscriber', async () => {
    const adapter = new ExtensionStorage(makeStubCipher());
    const received: Array<{ seed: string } | undefined> = [];
    const dispose = adapter.subscribe(secretKey, (next) => received.push(next));

    await adapter.set(secretKey, { seed: 'observed' });
    await vi.waitFor(() => expect(received).toEqual([{ seed: 'observed' }]));
    dispose();
  });
});
