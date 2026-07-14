/**
 * FileBackedHostStorage — cipher-unavailability log collapse.
 *
 * While the cipher is down (dev-mode keychain prompt canceled, Linux with no
 * keyring), every sensitive read and write is refused — reads answer
 * `undecryptable`, writes throw (never plaintext). Those refusals arrive per
 * operation, so only the episode-opening one may log; the rest count, and
 * recovery reports the suppressed total once.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { storageKey } from '@openheaders/core/storage';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileBackedHostStorage } from '../../src/host-storage/file-backed-host-storage';

const secretKey = storageKey<{ seed: string }>('oh.test.vault', { sensitive: true });
const otherSecretKey = storageKey<{ token: string }>('oh.test.oauth', { sensitive: true });
const plainKey = storageKey<string>('oh.test.plain');

function makeToggleCipher(): SecretCipher & { available: boolean } {
  const cipher = {
    available: true,
    isAvailable: () => cipher.available,
    encrypt: (plaintext: string) => `SEALED(${plaintext})`,
    decrypt: (blob: string) => {
      const match = /^SEALED\(([\s\S]*)\)$/.exec(blob);
      if (!match) throw new Error('cipher: unrecognized blob');
      return match[1];
    },
  };
  return cipher;
}

let tmpDir: string;
let counter = 0;

function freshFile(): string {
  counter += 1;
  return path.join(tmpDir, `store-${counter}.json`);
}

describe('FileBackedHostStorage — cipher-unavailability log collapse', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-fbhs-episode-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('logs one warn per unavailability episode across repeated reads and writes', async () => {
    const cipher = makeToggleCipher();
    const log = vi.fn();
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: cipher, log });
    await store.set(secretKey, { seed: 'persisted' });

    cipher.available = false;
    for (let i = 0; i < 3; i += 1) {
      expect(await store.get(secretKey)).toBeUndefined();
      await expect(store.set(otherSecretKey, { token: `t${i}` })).rejects.toThrow(/cipher unavailable/);
    }

    const unavailableLines = log.mock.calls.filter(([, msg]) => String(msg).includes('cipher unavailable'));
    expect(unavailableLines).toHaveLength(1);
    expect(unavailableLines[0]?.[0]).toBe('warn');
    expect(unavailableLines[0]?.[1]).toContain('oh.test.vault');
  });

  it('reports the suppressed count once on recovery, then stays quiet', async () => {
    const cipher = makeToggleCipher();
    const log = vi.fn();
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: cipher, log });
    await store.set(secretKey, { seed: 'persisted' });

    cipher.available = false;
    await store.get(secretKey); // opens the episode (logs)
    await store.get(secretKey); // suppressed
    await expect(store.set(otherSecretKey, { token: 't' })).rejects.toThrow(); // suppressed

    cipher.available = true;
    expect(await store.get(secretKey)).toEqual({ seed: 'persisted' });
    await store.get(secretKey);

    const recoveryLines = log.mock.calls.filter(([, msg]) => String(msg).includes('cipher available again'));
    expect(recoveryLines).toHaveLength(1);
    expect(recoveryLines[0]?.[1]).toContain('2 further refusal(s)');
  });

  it('opens a fresh episode after recovery', async () => {
    const cipher = makeToggleCipher();
    const log = vi.fn();
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: cipher, log });
    await store.set(secretKey, { seed: 'persisted' });

    cipher.available = false;
    await store.get(secretKey);
    cipher.available = true;
    await store.get(secretKey);
    cipher.available = false;
    await store.get(secretKey);
    await store.get(secretKey);

    const unavailableLines = log.mock.calls.filter(([, msg]) => String(msg).includes('cipher unavailable'));
    expect(unavailableLines).toHaveLength(2);
  });

  it('derives cipherStatus from slot traffic and fires transitions once each', async () => {
    const cipher = makeToggleCipher();
    const transitions: string[] = [];
    const store = new FileBackedHostStorage({
      filePath: freshFile(),
      secretCipher: cipher,
      onCipherStatusChange: (status) => transitions.push(status),
    });

    // Untouched: no probe has run, no transition fired.
    expect(store.cipherStatus()).toBe('unknown');
    expect(transitions).toEqual([]);

    await store.set(secretKey, { seed: 'persisted' });
    expect(store.cipherStatus()).toBe('available');

    cipher.available = false;
    await store.get(secretKey);
    await store.get(secretKey); // suppressed refusal — no second transition
    expect(store.cipherStatus()).toBe('unavailable');

    cipher.available = true;
    await store.get(secretKey);
    expect(store.cipherStatus()).toBe('available');

    expect(transitions).toEqual(['available', 'unavailable', 'available']);
  });

  it('reports unavailable as the first observation when the cipher starts down', async () => {
    const cipher = makeToggleCipher();
    const transitions: string[] = [];
    const filePath = freshFile();
    const sealed = new FileBackedHostStorage({ filePath, secretCipher: cipher });
    await sealed.set(secretKey, { seed: 'persisted' });

    cipher.available = false;
    const reopened = new FileBackedHostStorage({
      filePath,
      secretCipher: cipher,
      onCipherStatusChange: (status) => transitions.push(status),
    });
    expect(reopened.cipherStatus()).toBe('unknown');
    await reopened.get(secretKey);
    expect(reopened.cipherStatus()).toBe('unavailable');
    expect(transitions).toEqual(['unavailable']);
  });

  it('never consults the cipher for plain slots — no episode noise', async () => {
    const cipher = makeToggleCipher();
    cipher.available = false;
    const log = vi.fn();
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: cipher, log });

    await store.set(plainKey, 'hello');
    expect(await store.get(plainKey)).toBe('hello');
    expect(log).not.toHaveBeenCalled();
  });
});
