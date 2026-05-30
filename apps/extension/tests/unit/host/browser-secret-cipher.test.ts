import { describe, expect, it } from 'vitest';
import { createBrowserSecretCipher } from '@/host/browser-secret-cipher';

/** A freshly generated AES-GCM key, shared per cipher instance under test. */
function aesKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('browser-secret-cipher', () => {
  it('round-trips a plaintext through encrypt → decrypt', async () => {
    const cipher = createBrowserSecretCipher(aesKey);
    const seed = JSON.stringify({ kind: 'totp', seed: 'JBSWY3DPEHPK3PXP', issuer: 'openheaders.io' });

    const blob = await cipher.encrypt(seed);
    expect(blob).toMatch(/^v1:/);
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(await cipher.decrypt(blob)).toBe(seed);
  });

  it('uses a fresh IV per encryption (same plaintext → different ciphertext)', async () => {
    const cipher = createBrowserSecretCipher(aesKey);
    const a = await cipher.encrypt('repeat');
    const b = await cipher.encrypt('repeat');
    expect(a).not.toBe(b);
    expect(await cipher.decrypt(a)).toBe('repeat');
    expect(await cipher.decrypt(b)).toBe('repeat');
  });

  it('rejects a blob without the version prefix', async () => {
    const cipher = createBrowserSecretCipher(aesKey);
    await expect(cipher.decrypt('not-a-versioned-blob')).rejects.toThrow(/version|format/i);
  });

  it('fails to decrypt a tampered blob (AES-GCM auth tag)', async () => {
    const cipher = createBrowserSecretCipher(aesKey);
    const blob = await cipher.encrypt('integrity-protected');
    // Flip the last base64 char to corrupt the ciphertext / tag.
    const tampered = blob.slice(0, -1) + (blob.endsWith('A') ? 'B' : 'A');
    await expect(cipher.decrypt(tampered)).rejects.toBeDefined();
  });

  it('cannot decrypt a blob sealed under a different host key', async () => {
    const hostA = createBrowserSecretCipher(aesKey);
    const hostB = createBrowserSecretCipher(aesKey);
    const blob = await hostA.encrypt('cross-host-secret');
    await expect(hostB.decrypt(blob)).rejects.toBeDefined();
  });

  it('resolves the key provider once and caches it', async () => {
    let calls = 0;
    const cipher = createBrowserSecretCipher(async () => {
      calls++;
      return aesKey();
    });
    await cipher.encrypt('a');
    await cipher.encrypt('b');
    await cipher.decrypt(await cipher.encrypt('c'));
    expect(calls).toBe(1);
  });

  it('reports availability from the WebCrypto presence', () => {
    expect(createBrowserSecretCipher(aesKey).isAvailable()).toBe(true);
  });
});
