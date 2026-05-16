/**
 * UUIDv7 generator + helpers — RFC 9562 §5.7 compliance.
 *
 * Spec checks: 36-char canonical layout, version nibble = 7, variant
 * bits = 10, embedded timestamp matches Date.now(). Plus the
 * uniqueness + temporal ordering properties the workspace identity
 * layer relies on.
 */
import { describe, expect, it, vi } from 'vitest';

import { isUuidV7, uuidV7Timestamp, uuidv7, UUIDV7_LENGTH } from '../../src/utils/uuidv7';

describe('uuidv7', () => {
  it('returns a 36-char canonical UUIDv7 string', () => {
    const id = uuidv7();
    expect(id).toHaveLength(UUIDV7_LENGTH);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sets the version nibble to 7 and the variant to 10x', () => {
    for (let i = 0; i < 100; i++) {
      const id = uuidv7();
      // 15th char (0-indexed 14) is the version nibble: must be '7'.
      expect(id.charAt(14)).toBe('7');
      // 20th char (0-indexed 19) is the variant nibble: must be 8/9/a/b.
      expect('89ab').toContain(id.charAt(19));
    }
  });

  it('encodes the current unix-ms timestamp in the leading 48 bits', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    const ts = uuidV7Timestamp(id);
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before);
    expect(ts!).toBeLessThanOrEqual(after);
  });

  it('sorts lexicographically by timestamp prefix', () => {
    // Mint at increasing fake wall-clock times so lex order matches mint order.
    const dateNowSpy = vi.spyOn(Date, 'now');
    try {
      const ids: string[] = [];
      for (let t = 1_700_000_000_000; t < 1_700_000_000_010; t++) {
        dateNowSpy.mockReturnValue(t);
        ids.push(uuidv7());
      }
      const sorted = [...ids].sort();
      expect(sorted).toEqual(ids);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('produces unique ids across a tight loop', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(uuidv7());
    expect(seen.size).toBe(1000);
  });
});

describe('isUuidV7', () => {
  it('accepts well-formed UUIDv7 strings', () => {
    for (let i = 0; i < 20; i++) expect(isUuidV7(uuidv7())).toBe(true);
  });

  it('rejects UUIDv4 strings (version nibble is 4)', () => {
    expect(isUuidV7('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isUuidV7('not-a-uuid')).toBe(false);
    expect(isUuidV7('')).toBe(false);
    expect(isUuidV7('0186b5e9-2c11-7000-8000-000000000000Z')).toBe(false);
    expect(isUuidV7('0186b5e9-2c11-7000-c000-000000000000')).toBe(false); // bad variant
    // Uppercase is intentionally rejected — we mint lowercase only and
    // accept-only-what-we-mint keeps the canonical-form invariant tight.
    expect(isUuidV7('0186B5E9-2C11-7000-8000-000000000000')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isUuidV7(null as unknown as string)).toBe(false);
    expect(isUuidV7(undefined as unknown as string)).toBe(false);
    expect(isUuidV7(123 as unknown as string)).toBe(false);
  });
});

describe('uuidV7Timestamp', () => {
  it('returns null for non-UUIDv7 inputs', () => {
    expect(uuidV7Timestamp('not-a-uuid')).toBeNull();
    expect(uuidV7Timestamp('550e8400-e29b-41d4-a716-446655440000')).toBeNull();
  });

  it('round-trips a known timestamp', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_123);
    try {
      const id = uuidv7();
      expect(uuidV7Timestamp(id)).toBe(1_700_000_000_123);
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
