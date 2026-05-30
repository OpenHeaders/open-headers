/**
 * Per-host at-rest cipher for the browser-extension host (WS-B B2).
 *
 * The browser analogue of the desktop's `safeStorageCipher`: it seals
 * `sensitive: true` storage slots (vault seeds, OAuth bundles, daemon auth
 * tokens) under a per-host AES-GCM key (see {@link loadOrCreateAtRestKey}).
 * `ExtensionStorage` routes sensitive reads/writes through this seam so the
 * extension stops persisting secrets as plain JSON in `chrome.storage.local`.
 *
 * Asynchronous by necessity — WebCrypto is promise-based, unlike the Node
 * `SecretCipher` seam (`safeStorage`/keytar are synchronous). The desktop
 * host keeps its synchronous seam; this is the browser-shaped sibling, used
 * only inside the already-async `ExtensionStorage` adapter.
 *
 * Blob format: `v1:` + base64(iv ‖ ciphertext), with a fresh 12-byte random
 * IV per encryption (AES-GCM's standard nonce length). The version prefix
 * lets a future key rotation / algorithm change be told apart on read.
 */

import { loadOrCreateAtRestKey } from './idb-key-store';

const IV_BYTES = 12;
const VERSION_PREFIX = 'v1:';

export interface BrowserSecretCipher {
  /** True once WebCrypto is reachable. Writers MUST refuse sensitive slots when false. */
  isAvailable(): boolean;
  encrypt(plaintext: string): Promise<string>;
  decrypt(blob: string): Promise<string>;
}

export type AtRestKeyProvider = () => Promise<CryptoKey>;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Build a cipher over a key provider. The key is resolved lazily and cached
 * for the lifetime of the cipher, so the IndexedDB round-trip happens once
 * per context (an evicted SW re-resolves on wake, reading the persisted key).
 */
export function createBrowserSecretCipher(keyProvider: AtRestKeyProvider = loadOrCreateAtRestKey): BrowserSecretCipher {
  let cachedKey: Promise<CryptoKey> | null = null;
  const getKey = (): Promise<CryptoKey> => {
    if (!cachedKey) cachedKey = keyProvider();
    return cachedKey;
  };

  return {
    isAvailable(): boolean {
      return typeof globalThis.crypto?.subtle !== 'undefined';
    },

    async encrypt(plaintext: string): Promise<string> {
      const key = await getKey();
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext),
      );
      const packed = new Uint8Array(iv.length + ciphertext.byteLength);
      packed.set(iv, 0);
      packed.set(new Uint8Array(ciphertext), iv.length);
      return VERSION_PREFIX + toBase64(packed);
    },

    async decrypt(blob: string): Promise<string> {
      if (!blob.startsWith(VERSION_PREFIX)) {
        throw new Error('BrowserSecretCipher: unrecognized blob format');
      }
      const key = await getKey();
      const packed = fromBase64(blob.slice(VERSION_PREFIX.length));
      const iv = new Uint8Array(packed.subarray(0, IV_BYTES));
      const ciphertext = new Uint8Array(packed.subarray(IV_BYTES));
      const plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(plaintext);
    },
  };
}
