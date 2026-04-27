/**
 * Workspace-export crypto helpers — round-trip + invariant coverage.
 *
 * Asserts:
 *   - encrypt / decrypt round-trip with the same passphrase
 *   - decrypt fails on wrong passphrase
 *   - IV is freshly random per export (uniqueness invariant from §3.2)
 *   - key fingerprint is stable across derivations of the same
 *     passphrase + salt + iterations
 *   - ciphertext fingerprint is stable for identical bytes
 *   - base64url codec round-trips
 */

import { describe, expect, it } from 'vitest';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  ciphertextFingerprint,
  decryptWithPassphrase,
  deriveKey,
  encryptWithPassphrase,
  keyFingerprint,
  MIN_PBKDF2_ITERATIONS,
} from '../../src/workspace-export/index';

const SHORT_ITERATIONS = MIN_PBKDF2_ITERATIONS; // keep tests fast but valid

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

describe('crypto — encrypt/decrypt round-trip', () => {
  it('decrypts back to the original plaintext with the correct passphrase', async () => {
    const payload = utf8(JSON.stringify({ vault: [{ kind: 'string', name: 'TOKEN', value: 'shh' }] }));
    const env = await encryptWithPassphrase(payload, 'correct horse battery staple', {
      iterations: SHORT_ITERATIONS,
    });
    const round = await decryptWithPassphrase(env, 'correct horse battery staple');
    expect(decode(round)).toBe(decode(payload));
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const env = await encryptWithPassphrase(utf8('hello'), 'right', { iterations: SHORT_ITERATIONS });
    await expect(decryptWithPassphrase(env, 'wrong')).rejects.toBeTruthy();
  });
});

describe('crypto — IV uniqueness invariant', () => {
  it('produces different IVs across consecutive encrypts of identical plaintext', async () => {
    const payload = utf8('same input every time');
    const a = await encryptWithPassphrase(payload, 'pp', { iterations: SHORT_ITERATIONS });
    const b = await encryptWithPassphrase(payload, 'pp', { iterations: SHORT_ITERATIONS });
    expect(a.iv).not.toEqual(b.iv);
    // Ciphertext also differs as a consequence.
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });
});

describe('crypto — fingerprints', () => {
  it('key fingerprint is stable for the same (passphrase, salt, iterations)', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await deriveKey('pp', salt, SHORT_ITERATIONS);
    const b = await deriveKey('pp', salt, SHORT_ITERATIONS);
    expect(await keyFingerprint(a.rawBits)).toBe(await keyFingerprint(b.rawBits));
  });

  it('key fingerprint changes when the passphrase changes', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await deriveKey('pp-one', salt, SHORT_ITERATIONS);
    const b = await deriveKey('pp-two', salt, SHORT_ITERATIONS);
    expect(await keyFingerprint(a.rawBits)).not.toBe(await keyFingerprint(b.rawBits));
  });

  it('key fingerprint format is 6 hex chars in colon-separated triples', async () => {
    const salt = new Uint8Array(16).fill(0);
    const k = await deriveKey('pp', salt, SHORT_ITERATIONS);
    const fp = await keyFingerprint(k.rawBits);
    expect(fp).toMatch(/^[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}$/);
  });

  it('ciphertext fingerprint is stable for identical bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await ciphertextFingerprint(bytes)).toBe(await ciphertextFingerprint(bytes));
  });

  it('ciphertext fingerprint format is 8 colon-separated hex bytes', async () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const fp = await ciphertextFingerprint(bytes);
    expect(fp).toMatch(/^([0-9a-f]{2}:){7}[0-9a-f]{2}$/);
  });
});

describe('crypto — iteration floor', () => {
  it('refuses to derive below the minimum iteration count', async () => {
    await expect(deriveKey('pp', new Uint8Array(16), MIN_PBKDF2_ITERATIONS - 1)).rejects.toBeTruthy();
  });
});

describe('crypto — base64url codec', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it('emits unpadded base64url alphabet only', () => {
    const out = bytesToBase64Url(new Uint8Array([255, 255, 255]));
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(out).not.toMatch(/[=+/]/);
  });
});
