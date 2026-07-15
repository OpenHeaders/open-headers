/**
 * Lossless JSON display path: the parser accepts/rejects exactly what
 * JSON.parse does, keeps the source text of number tokens a double
 * can't hold (int64 ids, high-precision decimals), reports duplicate
 * object keys (last value wins, like JSON.parse), and the stringify
 * twin re-prints those tokens verbatim while matching
 * `JSON.stringify(v, null, 2)` for everything else.
 */

import {
  isJsonNumber,
  JsonNumber,
  parseLosslessJson,
  stringifyLossless,
} from '@openheaders/ui/workbench/components/request-editor/response/lossless-json';
import { describe, expect, it } from 'vitest';

/** Parsed value with JsonNumber leaves collapsed to plain doubles —
 *  for structural parity checks against JSON.parse. */
function collapse(value: unknown): unknown {
  if (isJsonNumber(value)) return Number(value.source);
  if (Array.isArray(value)) return value.map(collapse);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, collapse(v)]));
  }
  return value;
}

describe('parseLosslessJson — JSON.parse parity', () => {
  const ACCEPTED = [
    'null',
    'true',
    'false',
    '0',
    '-0',
    '42',
    '-13.5',
    '1e3',
    '1E+2',
    '2e-2',
    '""',
    '"plain"',
    '"esc \\" \\\\ \\/ \\b \\f \\n \\r \\t"',
    '"unicode \\u00e9 \\ud83d\\ude00"',
    '[]',
    '[1, 2, 3]',
    '[[[]]]',
    '{}',
    '{"a": 1}',
    '{"nested": {"list": [true, null, "x"], "n": 0.25}}',
    '  {\n\t"padded" : 1\r}  ',
  ];

  it.each(ACCEPTED)('parses %j structurally like JSON.parse', (text) => {
    const parsed = parseLosslessJson(text);
    expect(parsed).not.toBeNull();
    expect(collapse(parsed?.value)).toEqual(JSON.parse(text));
  });

  const REJECTED = [
    '',
    '   ',
    '{',
    '[1, 2',
    '{"a": }',
    '{"a" 1}',
    '{a: 1}',
    "{'a': 1}",
    '[1, 2,]',
    '{"a": 1,}',
    '01',
    '1.',
    '.5',
    '+1',
    '- 1',
    '1e',
    'NaN',
    'Infinity',
    'undefined',
    '"unterminated',
    '"bad \\x escape"',
    '"bad \\u12g4"',
    '"ctrl \u0001 char"',
    '{"a": 1} trailing',
    '[1] [2]',
    'nul',
  ];

  it.each(REJECTED)('rejects %j like JSON.parse', (text) => {
    expect(() => JSON.parse(text)).toThrow();
    expect(parseLosslessJson(text)).toBeNull();
  });
});

describe('parseLosslessJson — lossless numbers', () => {
  it('keeps the source of an integer beyond double precision', () => {
    const parsed = parseLosslessJson('{"resourceVersion": 9007199254740993}');
    const value = (parsed?.value as Record<string, unknown>).resourceVersion;
    expect(value).toBeInstanceOf(JsonNumber);
    expect((value as JsonNumber).source).toBe('9007199254740993');
  });

  it('keeps int64-range ids and negatives verbatim', () => {
    const parsed = parseLosslessJson('[1152921504606846977, -9223372036854775807]');
    const [a, b] = parsed?.value as unknown[];
    expect((a as JsonNumber).source).toBe('1152921504606846977');
    expect((b as JsonNumber).source).toBe('-9223372036854775807');
  });

  it('keeps a decimal with more precision than a double holds', () => {
    const parsed = parseLosslessJson('3.141592653589793238462643');
    expect((parsed?.value as JsonNumber).source).toBe('3.141592653589793238462643');
  });

  it('wraps numbers that overflow or underflow the double range', () => {
    expect(parseLosslessJson('1e999')?.value).toBeInstanceOf(JsonNumber);
    expect(parseLosslessJson('1e-999')?.value).toBeInstanceOf(JsonNumber);
  });

  it('keeps exactly-representable values as plain numbers', () => {
    expect(parseLosslessJson('9007199254740992')?.value).toBe(9007199254740992);
    expect(parseLosslessJson('0.30000000000000004')?.value).toBe(0.30000000000000004);
    expect(parseLosslessJson('0.1')?.value).toBe(0.1);
    // Value-equivalent notations stay plain — only PRECISION loss wraps.
    expect(parseLosslessJson('1e3')?.value).toBe(1000);
    expect(parseLosslessJson('1.0')?.value).toBe(1);
    expect(parseLosslessJson('100')?.value).toBe(100);
  });
});

describe('parseLosslessJson — duplicate keys', () => {
  it('reports a duplicate key and keeps the last value, like JSON.parse', () => {
    const parsed = parseLosslessJson('{"a": 1, "a": 2}');
    expect(parsed?.duplicateKeys).toEqual(['a']);
    expect((parsed?.value as Record<string, unknown>).a).toBe(2);
  });

  it('reports nested duplicates once per key name', () => {
    const parsed = parseLosslessJson('{"outer": {"id": 1, "id": 2}, "list": [{"id": 3, "id": 4}]}');
    expect(parsed?.duplicateKeys).toEqual(['id']);
  });

  it('reports nothing for distinct keys', () => {
    expect(parseLosslessJson('{"a": 1, "b": 1}')?.duplicateKeys).toEqual([]);
  });
});

describe('stringifyLossless', () => {
  const PLAIN = [
    null,
    true,
    42,
    -13.5,
    'text with "quotes" and \n newline',
    [],
    {},
    [1, 'two', null, [3]],
    { a: 1, nested: { list: [true, {}], empty: [] } },
  ];

  it.each(
    PLAIN.map((v) => [JSON.stringify(v), v] as const),
  )('matches JSON.stringify(…, null, 2) for %s', (_label, value) => {
    expect(stringifyLossless(value)).toBe(JSON.stringify(value, null, 2));
  });

  it('prints JsonNumber leaves as their wire source', () => {
    const value = { id: new JsonNumber('9007199254740993'), plain: 1 };
    expect(stringifyLossless(value)).toBe('{\n  "id": 9007199254740993,\n  "plain": 1\n}');
  });

  it('prints a bare JsonNumber root verbatim', () => {
    expect(stringifyLossless(new JsonNumber('1e999'))).toBe('1e999');
  });

  it('round-trips a parsed body without corrupting any number token', () => {
    const wire = '{"resourceVersion":9007199254740993,"count":2,"pi":3.14159265358979323846}';
    const parsed = parseLosslessJson(wire);
    expect(stringifyLossless(parsed?.value)).toBe(
      '{\n  "resourceVersion": 9007199254740993,\n  "count": 2,\n  "pi": 3.14159265358979323846\n}',
    );
  });
});
