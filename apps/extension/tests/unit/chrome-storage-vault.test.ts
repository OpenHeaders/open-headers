import type { V5 } from '@openheaders/core/types';
import type { VaultCipher, VaultScope } from '@openheaders/core/vault';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted — the vi.mock factory is hoisted above imports.
const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockSet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@/shared/storage', async () => {
  const real = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...real,
    extensionStorage: {
      get: mockGet,
      set: mockSet,
      getMany: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
    },
  };
});

import { ChromeStorageVault } from '@/shared/vault/chrome-storage-vault';

const PERSONAL: VaultScope = { kind: 'personal', workspaceId: 'ws-1' };
const SESSION: VaultScope = { kind: 'session' };

function makeBlob(secrets: Array<{ name: string; value: string }>): V5.Vault {
  return { schemaVersion: 5, secrets };
}

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue(undefined);
  mockSet.mockReset().mockResolvedValue(undefined);
});

describe('ChromeStorageVault — personal scope', () => {
  it('get returns null when the blob is empty', async () => {
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', PERSONAL)).toBeNull();
  });

  it('get returns the stored value when present', async () => {
    mockGet.mockResolvedValue(makeBlob([{ name: 'TOKEN', value: 'abc123' }]));
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', PERSONAL)).toBe('abc123');
  });

  it('get returns null for keys that exist with empty values', async () => {
    mockGet.mockResolvedValue(makeBlob([{ name: 'TOKEN', value: '' }]));
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', PERSONAL)).toBeNull();
  });

  it('put adds a new secret when the key is absent', async () => {
    mockGet.mockResolvedValue(makeBlob([]));
    const vault = new ChromeStorageVault();
    await vault.put('TOKEN', 'abc123', PERSONAL);
    expect(mockSet).toHaveBeenCalledOnce();
    const [, payload] = mockSet.mock.calls[0] as unknown as [unknown, V5.Vault];
    expect(payload.secrets).toEqual([{ name: 'TOKEN', value: 'abc123' }]);
  });

  it('put overwrites an existing secret rather than duplicating', async () => {
    mockGet.mockResolvedValue(makeBlob([{ name: 'TOKEN', value: 'old' }]));
    const vault = new ChromeStorageVault();
    await vault.put('TOKEN', 'new', PERSONAL);
    const [, payload] = mockSet.mock.calls[0] as unknown as [unknown, V5.Vault];
    expect(payload.secrets).toHaveLength(1);
    expect(payload.secrets[0]).toEqual({ name: 'TOKEN', value: 'new' });
  });

  it('delete removes the key and persists the change', async () => {
    mockGet.mockResolvedValue(
      makeBlob([
        { name: 'A', value: '1' },
        { name: 'B', value: '2' },
      ]),
    );
    const vault = new ChromeStorageVault();
    await vault.delete('A', PERSONAL);
    const [, payload] = mockSet.mock.calls[0] as unknown as [unknown, V5.Vault];
    expect(payload.secrets).toEqual([{ name: 'B', value: '2' }]);
  });

  it('delete is a no-op when the key is absent (no write)', async () => {
    mockGet.mockResolvedValue(makeBlob([{ name: 'A', value: '1' }]));
    const vault = new ChromeStorageVault();
    await vault.delete('MISSING', PERSONAL);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('list enumerates every stored key', async () => {
    mockGet.mockResolvedValue(
      makeBlob([
        { name: 'A', value: '1' },
        { name: 'B', value: '2' },
      ]),
    );
    const vault = new ChromeStorageVault();
    expect(await vault.list(PERSONAL)).toEqual(['A', 'B']);
  });
});

describe('ChromeStorageVault — session scope (v1 no-op)', () => {
  it('get returns null', async () => {
    const vault = new ChromeStorageVault();
    expect(await vault.get('TOKEN', SESSION)).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('put is a no-op (no storage write)', async () => {
    const vault = new ChromeStorageVault();
    await vault.put('TOKEN', 'abc', SESSION);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('list returns an empty array', async () => {
    const vault = new ChromeStorageVault();
    expect(await vault.list(SESSION)).toEqual([]);
  });
});

describe('ChromeStorageVault — cipher injection', () => {
  const upperCipher: VaultCipher = {
    encrypt: (x) => x.toUpperCase(),
    decrypt: (x) => x.toLowerCase(),
  };

  it('encrypts on put', async () => {
    mockGet.mockResolvedValue(makeBlob([]));
    const vault = new ChromeStorageVault(upperCipher);
    await vault.put('TOKEN', 'hello', PERSONAL);
    const [, payload] = mockSet.mock.calls[0] as unknown as [unknown, V5.Vault];
    expect(payload.secrets[0]?.value).toBe('HELLO');
  });

  it('decrypts on get', async () => {
    mockGet.mockResolvedValue(makeBlob([{ name: 'TOKEN', value: 'STORED' }]));
    const vault = new ChromeStorageVault(upperCipher);
    expect(await vault.get('TOKEN', PERSONAL)).toBe('stored');
  });

  it('returns null and warns when decrypt throws', async () => {
    const failingCipher: VaultCipher = {
      encrypt: (x) => x,
      decrypt: () => {
        throw new Error('bad-mac');
      },
    };
    mockGet.mockResolvedValue(makeBlob([{ name: 'TOKEN', value: 'unrecoverable' }]));
    const vault = new ChromeStorageVault(failingCipher);
    expect(await vault.get('TOKEN', PERSONAL)).toBeNull();
  });
});

describe('ChromeStorageVault — robustness', () => {
  it('treats a malformed blob (non-array secrets) as empty', async () => {
    mockGet.mockResolvedValue({ schemaVersion: 5, secrets: 'bogus' });
    const vault = new ChromeStorageVault();
    expect(await vault.get('ANY', PERSONAL)).toBeNull();
    expect(await vault.list(PERSONAL)).toEqual([]);
  });

  it('survives a failing storage read', async () => {
    mockGet.mockRejectedValue(new Error('quota'));
    const vault = new ChromeStorageVault();
    expect(await vault.get('ANY', PERSONAL)).toBeNull();
    expect(await vault.list(PERSONAL)).toEqual([]);
  });
});
