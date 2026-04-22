import { describe, expect, it } from 'vitest';
import { generateTotp, totpSecondsRemaining } from '../../src/totp';

// RFC 6238 Appendix B reference vectors. The keys differ per algorithm:
//   SHA1   — 20 bytes: "12345678901234567890"
//   SHA256 — 32 bytes: "12345678901234567890123456789012"
//   SHA512 — 64 bytes: "1234567890123456789012345678901234567890123456789012345678901234"
// Each entry pins (timeSeconds, expectedCode) per algorithm with
// 8-digit codes. Vectors lifted verbatim from the RFC.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function asciiToBase32(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  // Pad any leftover bits (rounded up to the next 5).
  const leftover = bits.length % 5;
  if (leftover !== 0) {
    out += BASE32[parseInt(bits.slice(bits.length - leftover).padEnd(5, '0'), 2)];
  }
  return out;
}

const SHA1_SEED_B32 = asciiToBase32('12345678901234567890');
const SHA256_SEED_B32 = asciiToBase32('12345678901234567890123456789012');
const SHA512_SEED_B32 = asciiToBase32('1234567890123456789012345678901234567890123456789012345678901234');

const VECTORS = [
  { timeSeconds: 59, sha1: '94287082', sha256: '46119246', sha512: '90693936' },
  { timeSeconds: 1111111109, sha1: '07081804', sha256: '68084774', sha512: '25091201' },
  { timeSeconds: 1111111111, sha1: '14050471', sha256: '67062674', sha512: '99943326' },
  { timeSeconds: 1234567890, sha1: '89005924', sha256: '91819424', sha512: '93441116' },
  { timeSeconds: 2000000000, sha1: '69279037', sha256: '90698825', sha512: '38618901' },
];

describe('generateTotp — RFC 6238 reference vectors', () => {
  for (const v of VECTORS) {
    it(`SHA1 @ t=${v.timeSeconds}`, async () => {
      const code = await generateTotp({
        seed: SHA1_SEED_B32,
        algorithm: 'SHA1',
        digits: 8,
        period: 30,
        now: () => v.timeSeconds * 1000,
      });
      expect(code).toBe(v.sha1);
    });

    it(`SHA256 @ t=${v.timeSeconds}`, async () => {
      const code = await generateTotp({
        seed: SHA256_SEED_B32,
        algorithm: 'SHA256',
        digits: 8,
        period: 30,
        now: () => v.timeSeconds * 1000,
      });
      expect(code).toBe(v.sha256);
    });

    it(`SHA512 @ t=${v.timeSeconds}`, async () => {
      const code = await generateTotp({
        seed: SHA512_SEED_B32,
        algorithm: 'SHA512',
        digits: 8,
        period: 30,
        now: () => v.timeSeconds * 1000,
      });
      expect(code).toBe(v.sha512);
    });
  }
});

describe('generateTotp — defaults', () => {
  it('defaults to SHA1, 6 digits, period 30', async () => {
    const code = await generateTotp({
      seed: SHA1_SEED_B32,
      now: () => 59 * 1000,
    });
    // RFC 6238 SHA1 @ t=59 with 8 digits is 94287082; the trailing 6
    // digits must match (the generator truncates to `digits` from the
    // same DT result).
    expect(code).toBe('287082');
  });

  it('zero-pads when the truncated code is shorter than `digits`', async () => {
    const code = await generateTotp({
      seed: 'AAAAAAAA',
      digits: 6,
      period: 30,
      now: () => 0,
    });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('throws on an empty seed', async () => {
    await expect(generateTotp({ seed: '' })).rejects.toThrow(/zero bytes/);
  });

  it('throws on an invalid base32 character', async () => {
    await expect(generateTotp({ seed: '!!!!!' })).rejects.toThrow(/Invalid base32/);
  });

  it('strips spaces + equals padding from the seed before decoding', async () => {
    const padded = await generateTotp({
      seed: 'GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ====',
      algorithm: 'SHA1',
      digits: 8,
      period: 30,
      now: () => 59 * 1000,
    });
    expect(padded).toBe('94287082');
  });
});

describe('totpSecondsRemaining', () => {
  it('returns full period at the start of a window', () => {
    expect(totpSecondsRemaining(30, 0)).toBe(30);
    expect(totpSecondsRemaining(30, 30_000)).toBe(30);
  });

  it('counts down within a window', () => {
    // 5 seconds into a 30s window → 25 seconds remain.
    expect(totpSecondsRemaining(30, 5_000)).toBe(25);
    // 29 seconds into a 30s window → 1 second remains.
    expect(totpSecondsRemaining(30, 29_000)).toBe(1);
  });

  it('honors a non-default period', () => {
    expect(totpSecondsRemaining(60, 10_000)).toBe(50);
  });
});
