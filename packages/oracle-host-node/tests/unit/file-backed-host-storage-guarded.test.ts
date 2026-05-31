/**
 * FileBackedHostStorage — `getValidatedGuarded` tri-state.
 *
 * The desktop sibling of the extension's lost-at-rest-key hazard: the
 * encrypted blob lives in the on-disk envelope while the key lives in the OS
 * keychain (`safeStorage`). If the key is lost/rotated, the blob is present
 * but undecryptable — `getValidated` collapses that to `null`
 * (indistinguishable from an empty slot), while `getValidatedGuarded`
 * preserves the difference so the vault locks instead of silently emptying.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { storageKey } from '@openheaders/core/storage';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileBackedHostStorage } from '../../src/host-storage/file-backed-host-storage';

const secretSchema = v.object({ seed: v.string() });
const secretKey = storageKey<{ seed: string }>('oh.test.vault', { sensitive: true });

/** A cipher whose decrypt either round-trips a `SEALED(...)` envelope or
 *  throws — `decryptThrows` simulates the lost/rotated key. */
function makeCipher(opts: { available?: boolean; decryptThrows?: boolean } = {}): SecretCipher {
  const { available = true, decryptThrows = false } = opts;
  return {
    isAvailable: () => available,
    encrypt: (plaintext) => `SEALED(${plaintext})`,
    decrypt: (blob) => {
      if (decryptThrows) throw new Error('cipher: key lost');
      const match = /^SEALED\(([\s\S]*)\)$/.exec(blob);
      if (!match) throw new Error('cipher: unrecognized blob');
      return match[1];
    },
  };
}

let tmpDir: string;
let counter = 0;

function freshFile(): string {
  counter += 1;
  return path.join(tmpDir, `store-${counter}.json`);
}

describe('FileBackedHostStorage — getValidatedGuarded tri-state', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-fbhs-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports absent for a slot that was never written', async () => {
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: makeCipher() });
    expect(await store.getValidatedGuarded(secretKey, secretSchema)).toEqual({ status: 'absent' });
  });

  it('reports ok with the decrypted value for a good sensitive blob', async () => {
    const store = new FileBackedHostStorage({ filePath: freshFile(), secretCipher: makeCipher() });
    await store.set(secretKey, { seed: 'JBSWY3DPEHPK3PXP' });
    expect(await store.getValidatedGuarded(secretKey, secretSchema)).toEqual({
      status: 'ok',
      value: { seed: 'JBSWY3DPEHPK3PXP' },
    });
  });

  it('reports undecryptable — NOT absent — when the key is lost between sessions', async () => {
    const filePath = freshFile();
    // Session 1: seal the secret with a working key.
    const sealed = new FileBackedHostStorage({ filePath, secretCipher: makeCipher() });
    await sealed.set(secretKey, { seed: 'persisted' });

    // Session 2: same on-disk blob, but the key is gone (decrypt throws).
    const reopened = new FileBackedHostStorage({ filePath, secretCipher: makeCipher({ decryptThrows: true }) });
    expect(await reopened.getValidatedGuarded(secretKey, secretSchema)).toEqual({ status: 'undecryptable' });
    // The plain read can't tell this from an empty slot.
    expect(await reopened.getValidated(secretKey, secretSchema)).toBeNull();
  });

  it('reports undecryptable when the cipher is unavailable but a blob is present', async () => {
    const filePath = freshFile();
    const sealed = new FileBackedHostStorage({ filePath, secretCipher: makeCipher() });
    await sealed.set(secretKey, { seed: 'persisted' });

    const reopened = new FileBackedHostStorage({ filePath, secretCipher: makeCipher({ available: false }) });
    expect(await reopened.getValidatedGuarded(secretKey, secretSchema)).toEqual({ status: 'undecryptable' });
  });
});
