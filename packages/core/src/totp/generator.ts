/**
 * TOTP code generator — RFC 6238 (HOTP-time-based, RFC 4226 truncation).
 *
 * Pure WebCrypto: works in every runtime we ship to (SW, offscreen,
 * renderer, Node test). No platform deps; lives in core so both desktop
 * and extension share one implementation.
 *
 * Inputs: a base32 seed (the credential, never returned to callers
 * outside this module), an HMAC algorithm, an N-second period, and a
 * digit count. Output: the zero-padded N-digit code valid for the
 * current time window.
 *
 * Errors are thrown — the caller (request executor, UI preview) decides
 * whether to surface them as resolution failures or panel toasts.
 */

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface GenerateTotpOptions {
  seed: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  /** Override "now" for unit tests + RFC reference vector verification. */
  now?: () => number;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(seed: string): Uint8Array<ArrayBuffer> {
  const cleaned = seed.toUpperCase().replace(/\s/g, '').replace(/=/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base32 character: ${ch}`);
    bits += idx.toString(2).padStart(5, '0');
  }
  const byteCount = Math.floor(bits.length / 8);
  if (byteCount === 0) throw new Error('TOTP seed decoded to zero bytes');
  const out = new Uint8Array(new ArrayBuffer(byteCount));
  for (let i = 0; i < byteCount; i++) {
    out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

function counterBytes(counter: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(8));
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    out[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return out;
}

function hashName(algorithm: TotpAlgorithm): string {
  switch (algorithm) {
    case 'SHA1':
      return 'SHA-1';
    case 'SHA256':
      return 'SHA-256';
    case 'SHA512':
      return 'SHA-512';
  }
}

export async function generateTotp(options: GenerateTotpOptions): Promise<string> {
  const algorithm = options.algorithm ?? 'SHA1';
  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const nowMs = (options.now ?? Date.now)();

  const keyBytes = decodeBase32(options.seed);
  const counter = Math.floor(Math.floor(nowMs / 1000) / period);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: hashName(algorithm) } },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, counterBytes(counter));
  const hash = new Uint8Array(signature);
  const offset = hash[hash.length - 1] & 0xf;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)) %
    10 ** digits;
  return code.toString().padStart(digits, '0');
}

/**
 * Seconds remaining in the current TOTP window — what the UI's
 * countdown ring renders. Pure of the seed; only depends on the period
 * and current wall clock.
 */
export function totpSecondsRemaining(period: number, nowMs: number = Date.now()): number {
  const seconds = Math.floor(nowMs / 1000);
  return period - (seconds % period);
}
