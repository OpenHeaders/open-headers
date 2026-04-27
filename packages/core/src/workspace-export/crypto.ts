/**
 * Crypto helpers for the workspace-export envelope.
 *
 * Thin WebCrypto wrapper — no third-party crypto deps. Both the
 * extension SW and the desktop main process expose `globalThis.crypto`
 * with `subtle`, so this module is platform-agnostic.
 *
 * Cipher tier (see design §3.2):
 *   - PBKDF2-HMAC-SHA256 → AES-GCM-256
 *   - 600_000 iterations (parameterized; bumpable without a kind change)
 *   - 16-byte random salt, 12-byte random IV per export
 *   - HKDF-Expand-SHA256 key fingerprint (3 bytes / 6 hex chars)
 *   - SHA-256 ciphertext fingerprint (first 8 bytes, hex with colons)
 *
 * IV uniqueness invariant: the IV is freshly random per export
 * (`getRandomValues`), never derived. Reusing an IV with the same key
 * is a complete-break failure mode for AES-GCM.
 */

const SALT_BYTES = 16;
const IV_BYTES = 12;
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
export const MIN_PBKDF2_ITERATIONS = 100_000;
const KEY_FINGERPRINT_BYTES = 3;
const CIPHERTEXT_FINGERPRINT_BYTES = 8;
const KEY_FINGERPRINT_INFO = new TextEncoder().encode('openheaders-passphrase-fingerprint-v1');

/** Subtle reference, lazy so the test mock has a chance to install. */
function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto subtle is not available in this environment');
  }
  return globalThis.crypto.subtle;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

// ── base64url codec (RFC 4648 §5) ───────────────────────────────────

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function bytesToColonHex(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push(bytes[i].toString(16).padStart(2, '0'));
  return parts.join(':');
}

// ── Key derivation ──────────────────────────────────────────────────

async function importPassphraseKey(passphrase: string): Promise<CryptoKey> {
  return subtle().importKey('raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey',
  ]);
}

/**
 * Derive an AES-GCM-256 key + the raw key bits (for fingerprinting).
 * Returning both keeps the call site from having to rederive.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ key: CryptoKey; rawBits: ArrayBuffer }> {
  if (iterations < MIN_PBKDF2_ITERATIONS) {
    throw new Error(`Refusing to derive with iterations=${iterations} (minimum ${MIN_PBKDF2_ITERATIONS})`);
  }
  const passphraseKey = await importPassphraseKey(passphrase);
  const rawBits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations },
    passphraseKey,
    256,
  );
  const key = await subtle().importKey('raw', rawBits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { key, rawBits };
}

// ── Fingerprints ────────────────────────────────────────────────────

/**
 * 6-hex-char (3-byte) fingerprint of the derived key. Computed by both
 * sender and recipient after passphrase derivation; recipient verifies
 * by asking sender "does yours say `7f:a3:c1`?". Forging a colliding
 * fingerprint requires already knowing the passphrase, so 24 bits is
 * sufficient.
 *
 * `info` string `openheaders-passphrase-fingerprint-v1` is part of the
 * fingerprint contract — changing it changes every fingerprint and is
 * effectively a format break (bump the `kind` if this needs to move).
 */
export async function keyFingerprint(rawKeyBits: ArrayBuffer): Promise<string> {
  const ikm = await subtle().importKey('raw', rawKeyBits, { name: 'HKDF' }, false, ['deriveBits']);
  const out = await subtle().deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new Uint8Array(KEY_FINGERPRINT_INFO),
    },
    ikm,
    KEY_FINGERPRINT_BYTES * 8,
  );
  return bytesToColonHex(new Uint8Array(out));
}

/**
 * 8-byte SHA-256 prefix of the ciphertext, displayed as
 * `XX:XX:XX:XX:XX:XX:XX:XX`. Independent of passphrase — proves
 * "we're looking at the same file." Computed over the raw ciphertext
 * bytes (post-AES-GCM, which already includes the auth tag).
 */
export async function ciphertextFingerprint(ciphertext: Uint8Array): Promise<string> {
  const digest = await subtle().digest('SHA-256', new Uint8Array(ciphertext));
  return bytesToColonHex(new Uint8Array(digest, 0, CIPHERTEXT_FINGERPRINT_BYTES));
}

// ── Encrypt / decrypt ───────────────────────────────────────────────

export interface EncryptedEnvelope {
  salt: Uint8Array;
  iv: Uint8Array;
  iterations: number;
  ciphertext: Uint8Array;
}

/**
 * Encrypt `plaintext` with a passphrase-derived key. Caller passes the
 * already-serialized payload bytes (typically `JSON.stringify` of the
 * vault block, then UTF-8 encoded) — the crypto layer doesn't know the
 * payload shape.
 */
export async function encryptWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
  opts: { iterations?: number } = {},
): Promise<EncryptedEnvelope> {
  const iterations = opts.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const { key } = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(plaintext)),
  );
  return { salt, iv, iterations, ciphertext };
}

/**
 * Decrypt — throws on wrong passphrase / tampered ciphertext (AES-GCM
 * authenticates). Caller catches and surfaces the failure as a
 * "could not decrypt" entry in the import report (see §3.2).
 */
export async function decryptWithPassphrase(envelope: EncryptedEnvelope, passphrase: string): Promise<Uint8Array> {
  const { key } = await deriveKey(passphrase, envelope.salt, envelope.iterations);
  const plaintext = await subtle().decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(envelope.iv) },
    key,
    new Uint8Array(envelope.ciphertext),
  );
  return new Uint8Array(plaintext);
}

// ── Convenience: hex display of arbitrary byte runs ─────────────────

export const _internal = { bytesToHex };
