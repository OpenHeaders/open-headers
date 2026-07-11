/**
 * Pair-grid model — the structured view over the line-per-segment
 * decoded text that cookie and query-string values edit as. Rows
 * decode at the FIRST `=` (values may carry their own), bare segments
 * are flag rows (value null), and serialization reproduces untouched
 * rows verbatim — the grid never grows its own encoder, so framing
 * validation stays with the codec (`encodeCookieList` /
 * `encodeQueryString` reject what the grid lets through).
 */

import {
  decodePairSegments,
  encodeCookieList,
  encodePairSegments,
  encodeQueryString,
  pairGridTypeOf,
} from '@openheaders/ui/shared/value-detection';
import { describe, expect, it } from 'vitest';

describe('pairGridTypeOf', () => {
  it('claims cookie and query-string only', () => {
    expect(pairGridTypeOf('cookie')).toBe('cookie');
    expect(pairGridTypeOf('query-string')).toBe('query-string');
    expect(pairGridTypeOf('cache-control')).toBeNull();
    expect(pairGridTypeOf('auth-params')).toBeNull();
    expect(pairGridTypeOf('jwt')).toBeNull();
  });
});

describe('decodePairSegments', () => {
  it('splits each line at the first = so values keep their own', () => {
    expect(decodePairSegments('token=a=b=c\nsession=xyz')).toEqual([
      { name: 'token', value: 'a=b=c' },
      { name: 'session', value: 'xyz' },
    ]);
  });

  it('reads a line without = as a flag row (null value), distinct from an empty-value pair', () => {
    expect(decodePairSegments('id=42\nSecure\nHttpOnly\nempty=')).toEqual([
      { name: 'id', value: '42' },
      { name: 'Secure', value: null },
      { name: 'HttpOnly', value: null },
      { name: 'empty', value: '' },
    ]);
  });

  it('keeps duplicate names as separate rows (query strings repeat keys)', () => {
    expect(decodePairSegments('tag=a\ntag=b\ntag=a')).toEqual([
      { name: 'tag', value: 'a' },
      { name: 'tag', value: 'b' },
      { name: 'tag', value: 'a' },
    ]);
  });

  it('drops blank lines and trims segment whitespace', () => {
    expect(decodePairSegments('a=1\n\n  b=2  \n')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });
});

describe('encodePairSegments', () => {
  it('round-trips untouched rows verbatim for both types', () => {
    const cookie = 'session=abc\nPath=/\nSecure\nHttpOnly';
    expect(encodePairSegments('cookie', decodePairSegments(cookie))).toBe(cookie);
    const query = 'q=openheaders\npage=2\nq=again';
    expect(encodePairSegments('query-string', decodePairSegments(query))).toBe(query);
  });

  it('serializes a flag row as the bare name', () => {
    expect(encodePairSegments('cookie', [{ name: 'Partitioned', value: null }])).toBe('Partitioned');
  });

  it('normalizes an empty-valued cookie attribute-flag name to the bare flag', () => {
    expect(
      encodePairSegments('cookie', [
        { name: 'id', value: '1' },
        { name: 'Secure', value: '' },
      ]),
    ).toBe('id=1\nSecure');
    // A non-flag name keeps its empty-value pair shape.
    expect(encodePairSegments('cookie', [{ name: 'empty', value: '' }])).toBe('empty=');
    // Query strings have no flag vocabulary — the pair shape survives.
    expect(encodePairSegments('query-string', [{ name: 'Secure', value: '' }])).toBe('Secure=');
  });

  it('drops rows left entirely empty (the just-added blank row)', () => {
    expect(
      encodePairSegments('query-string', [
        { name: 'a', value: '1' },
        { name: '', value: '' },
      ]),
    ).toBe('a=1');
  });

  it('lets an illegal row through verbatim so the codec re-encode rejects it', () => {
    const nameless = encodePairSegments('cookie', [{ name: '', value: 'orphan' }]);
    expect(nameless).toBe('=orphan');
    expect(encodeCookieList(nameless)).toBeNull();
    const spaced = encodePairSegments('query-string', [{ name: 'a b', value: '1' }]);
    expect(encodeQueryString(spaced)).toBeNull();
  });
});
