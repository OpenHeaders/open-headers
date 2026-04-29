/**
 * Coverage for `ChromeStorageVault` — the renderer-side Vault
 * implementation. Every mutation routes through the SW via
 * `bridge.call('vaultPutSecret' | 'vaultDeleteSecret' | ...)`; no
 * direct `chrome.storage.local` writes happen here. The tests mock
 * the bridge module and assert the exact RPC traffic each Vault
 * method produces + verify cipher injection stays round-trip safe.
 */

import type { VaultCipher, VaultScope } from '@openheaders/core/vault';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock for the bridge `call` function — every ChromeStorageVault
// method goes through this single channel. Tests set the resolver per
// case to simulate the SW's response for each RPC.
const { mockCall } = vi.hoisted(() => ({
  mockCall: vi.fn<(type: string, payload?: unknown) => Promise<unknown>>(),
}));

vi.mock('@utils/bridge', () => ({
  call: mockCall,
  subscribe: vi.fn(),
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

import { ChromeStorageVault } from '@/shared/vault/chrome-storage-vault';

const PERSONAL: VaultScope = { kind: 'personal', workspaceId: 'ws-1' };
const SESSION: VaultScope = { kind: 'session' };

beforeEach(() => {
  mockCall.mockReset();
});

describe('ChromeStorageVault — personal scope', () => {
  it('get fires vaultGetSecret and returns the SW snapshot value', async () => {
    mockCall.mockImplementation(async (type) => {
      if (type === 'vaultGetSecret') return { value: 'abc123' };
      throw new Error(`unexpected call: ${type}`);
    });
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', PERSONAL)).toBe('abc123');
    expect(mockCall).toHaveBeenCalledWith('vaultGetSecret', { key: 'TOKEN' });
  });

  it('get returns null when the SW reports missing key', async () => {
    mockCall.mockResolvedValue({ value: null });
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', PERSONAL)).toBeNull();
  });

  it('put fires vaultPutSecret — NO direct storage write', async () => {
    mockCall.mockResolvedValue({ ok: true, version: 2, vault: { schemaVersion: 5, secrets: [] } });
    const vault = new ChromeStorageVault();
    await vault.put('TOKEN', 'abc123', PERSONAL);
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('vaultPutSecret', { key: 'TOKEN', value: 'abc123' });
  });

  it('delete fires vaultDeleteSecret', async () => {
    mockCall.mockResolvedValue({ ok: true, version: 3, vault: { schemaVersion: 5, secrets: [] } });
    const vault = new ChromeStorageVault();
    await vault.delete('TOKEN', PERSONAL);
    expect(mockCall).toHaveBeenCalledWith('vaultDeleteSecret', { key: 'TOKEN' });
  });

  it('list fires vaultListSecretNames and returns the reported names', async () => {
    mockCall.mockResolvedValue({ names: ['A', 'B'] });
    const vault = new ChromeStorageVault();
    expect(await vault.list(PERSONAL)).toEqual(['A', 'B']);
    expect(mockCall).toHaveBeenCalledWith('vaultListSecretNames');
  });
});

describe('ChromeStorageVault — session scope (v1 no-op)', () => {
  it('get returns null without hitting the bridge', async () => {
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', SESSION)).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('put is a no-op (no RPC)', async () => {
    const vault = new ChromeStorageVault();
    await vault.put('TOKEN', 'abc', SESSION);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('list returns an empty array without hitting the bridge', async () => {
    const vault = new ChromeStorageVault();
    expect(await vault.list(SESSION)).toEqual([]);
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('ChromeStorageVault — cipher injection', () => {
  const upperCipher: VaultCipher = {
    encrypt: (x) => x.toUpperCase(),
    decrypt: (x) => x.toLowerCase(),
  };

  it('encrypts in the renderer BEFORE shipping across the bridge', async () => {
    mockCall.mockResolvedValue({ ok: true, version: 2, vault: { schemaVersion: 5, secrets: [] } });
    const vault = new ChromeStorageVault(upperCipher);
    await vault.put('TOKEN', 'hello', PERSONAL);
    // SW sees the encrypted payload, never the plaintext.
    expect(mockCall).toHaveBeenCalledWith('vaultPutSecret', { key: 'TOKEN', value: 'HELLO' });
  });

  it('decrypts the SW payload on get', async () => {
    mockCall.mockResolvedValue({ value: 'STORED' });
    const vault = new ChromeStorageVault(upperCipher);
    expect(await vault.get('TOKEN', PERSONAL)).toBe('stored');
  });

  it('returns null when decrypt throws (reports status red)', async () => {
    const failingCipher: VaultCipher = {
      encrypt: (x) => x,
      decrypt: () => {
        throw new Error('bad-mac');
      },
    };
    mockCall.mockResolvedValue({ value: 'unrecoverable' });
    const vault = new ChromeStorageVault(failingCipher);
    expect(await vault.get('TOKEN', PERSONAL)).toBeNull();
  });
});

describe('ChromeStorageVault — bridge failure tolerance', () => {
  it('get returns null when the bridge rejects', async () => {
    mockCall.mockRejectedValue(new Error('sw asleep'));
    const vault = new ChromeStorageVault();
    expect(await vault.get('ANY', PERSONAL)).toBeNull();
  });

  it('list returns empty when the bridge rejects', async () => {
    mockCall.mockRejectedValue(new Error('sw asleep'));
    const vault = new ChromeStorageVault();
    expect(await vault.list(PERSONAL)).toEqual([]);
  });

  it('put swallows bridge rejection (fail-open)', async () => {
    mockCall.mockRejectedValue(new Error('timeout'));
    const vault = new ChromeStorageVault();
    // Should not throw — caller's credential save UX stays responsive.
    await expect(vault.put('TOKEN', 'x', PERSONAL)).resolves.toBeUndefined();
  });
});

describe('ChromeStorageVault — secrets Status subsystem', () => {
  it('reports red on decrypt failure', async () => {
    const { __resetStatusForTests, getStatusSnapshot } = await import('@/shared/status');
    __resetStatusForTests();
    const failingCipher: VaultCipher = {
      encrypt: (x) => x,
      decrypt: () => {
        throw new TypeError('bad-mac');
      },
    };
    mockCall.mockResolvedValue({ value: 'ciphertext' });
    const vault = new ChromeStorageVault(failingCipher);
    await vault.get('TOKEN', PERSONAL);
    const entry = getStatusSnapshot().secrets;
    expect(entry?.state).toBe('red');
    expect(entry?.message).toBe('Failed to decrypt vault entry: TOKEN');
    expect(entry?.context?.errorClass).toBe('TypeError');
    expect(entry?.context?.workspaceId).toBe('ws-1');
  });

  it('reports green on successful decrypt (resets after prior failure)', async () => {
    const { __resetStatusForTests, getStatusSnapshot, report } = await import('@/shared/status');
    __resetStatusForTests();
    report({ subsystem: 'secrets', state: 'red', message: 'previous failure' });
    const cipher: VaultCipher = {
      encrypt: (x) => x,
      decrypt: (x) => x.toLowerCase(),
    };
    mockCall.mockResolvedValue({ value: 'STORED' });
    const vault = new ChromeStorageVault(cipher);
    await vault.get('TOKEN', PERSONAL);
    const entry = getStatusSnapshot().secrets;
    expect(entry?.state).toBe('green');
    expect(entry?.message).toBe('Vault healthy');
  });
});
