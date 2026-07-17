/**
 * Body-format fidelity core. Pins:
 *   - the tokenizer gates on JSON SHAPE (container start, balanced
 *     brackets, no trailing garbage) and fails open on everything else;
 *   - format/minify are whitespace-only: big integers beyond 2^53,
 *     number forms (`1.0`, `1e3`, `-0`), `\uXXXX` escapes, and
 *     duplicate keys survive verbatim (the parse/stringify corruptions
 *     this module exists to avoid);
 *   - `{{…}}` template atoms are opaque value tokens, so templated
 *     bodies format and round-trip;
 *   - profile detection reads minified / indented(unit) / unknown plus
 *     the trailing newline off the raw text;
 *   - reformatBody re-emits edited text in the captured wire profile;
 *   - format and minify are idempotent and mutually stable.
 */

import {
  detectBodyProfile,
  encodeBodyForWire,
  formatBody,
  isFormattableBody,
  MAX_TOKENIZE_LENGTH,
  minifyBody,
  reformatBody,
  tokenizeJsonish,
} from '@openheaders/ui/shared/body-format';
import { describe, expect, it } from 'vitest';

const MINIFIED = '{"method":"GET","url":"https://api.openheaders.io/echo","tags":["a","b"],"ok":true,"meta":null}';
const PRETTY = `{
  "method": "GET",
  "url": "https://api.openheaders.io/echo",
  "tags": [
    "a",
    "b"
  ],
  "ok": true,
  "meta": null
}`;

describe('tokenizeJsonish gate', () => {
  it('accepts minified objects and arrays', () => {
    expect(tokenizeJsonish(MINIFIED)).not.toBeNull();
    expect(tokenizeJsonish('[1,2,3]')).not.toBeNull();
    expect(tokenizeJsonish('{}')).not.toBeNull();
    expect(tokenizeJsonish('[]')).not.toBeNull();
  });

  it('accepts pretty and whitespace-padded bodies', () => {
    expect(tokenizeJsonish(PRETTY)).not.toBeNull();
    expect(tokenizeJsonish('  {"a":1}\n')).not.toBeNull();
  });

  it('rejects non-container roots', () => {
    expect(tokenizeJsonish('"hello"')).toBeNull();
    expect(tokenizeJsonish('42')).toBeNull();
    expect(tokenizeJsonish('true')).toBeNull();
    expect(tokenizeJsonish('{{live.token}}')).toBeNull();
  });

  it('rejects non-JSON text', () => {
    expect(tokenizeJsonish('plain text body')).toBeNull();
    expect(tokenizeJsonish('<html><body>openheaders.io</body></html>')).toBeNull();
    expect(tokenizeJsonish('')).toBeNull();
  });

  it('rejects truncated and unbalanced bodies', () => {
    expect(tokenizeJsonish('{"a":1')).toBeNull();
    expect(tokenizeJsonish('{"a":[1,2}')).toBeNull();
    expect(tokenizeJsonish('{"a":"unterminated')).toBeNull();
    expect(tokenizeJsonish('{"a":{{unclosed}')).toBeNull();
  });

  it('rejects trailing garbage after the top-level close', () => {
    expect(tokenizeJsonish('{}{}')).toBeNull();
    expect(tokenizeJsonish('{"a":1} extra')).toBeNull();
  });

  it('rejects glued word garbage', () => {
    expect(tokenizeJsonish('{"a":1x}')).toBeNull();
    expect(tokenizeJsonish('{"a":truely}')).toBeNull();
  });

  it('caps the scan for huge payloads', () => {
    const huge = `{"a":"${'x'.repeat(MAX_TOKENIZE_LENGTH)}"}`;
    expect(tokenizeJsonish(huge)).toBeNull();
    expect(formatBody(huge)).toBe(huge);
  });
});

describe('whitespace-only fidelity', () => {
  it('preserves big integers beyond 2^53', () => {
    const body = '{"id":9007199254740993,"other":12345678901234567890}';
    expect(minifyBody(formatBody(body))).toBe(body);
    expect(formatBody(body)).toContain('9007199254740993');
    expect(formatBody(body)).toContain('12345678901234567890');
  });

  it('preserves number forms', () => {
    const body = '{"a":1.0,"b":1e3,"c":-0,"d":2.50,"e":1E+2,"f":7e-3}';
    expect(minifyBody(formatBody(body))).toBe(body);
  });

  it('preserves unicode escapes and string escapes', () => {
    const body = '{"city":"Z\\u00fcrich","quote":"a \\"b\\" c","nl":"line\\nbreak"}';
    expect(minifyBody(formatBody(body))).toBe(body);
    expect(formatBody(body)).toContain('\\u00fcrich');
  });

  it('preserves duplicate keys', () => {
    const body = '{"a":1,"a":2}';
    const pretty = formatBody(body);
    expect(pretty).toContain('"a": 1');
    expect(pretty).toContain('"a": 2');
    expect(minifyBody(pretty)).toBe(body);
  });

  it('never reorders or normalizes keys', () => {
    const body = '{"2":"b","1":"a","10":"c"}';
    expect(minifyBody(formatBody(body))).toBe(body);
  });
});

describe('formatBody', () => {
  it('pretty-prints minified JSON with two-space default', () => {
    expect(formatBody(MINIFIED)).toBe(PRETTY);
  });

  it('honors a custom indent unit', () => {
    expect(formatBody('{"a":1}', '    ')).toBe('{\n    "a": 1\n}');
    expect(formatBody('{"a":1}', '\t')).toBe('{\n\t"a": 1\n}');
  });

  it('keeps empty containers glued', () => {
    expect(formatBody('{"a":{},"b":[]}')).toBe('{\n  "a": {},\n  "b": []\n}');
    expect(formatBody('{}')).toBe('{}');
    expect(formatBody('[]')).toBe('[]');
  });

  it('indents nested structures per depth', () => {
    expect(formatBody('{"a":{"b":[1,{"c":null}]}}')).toBe(
      '{\n  "a": {\n    "b": [\n      1,\n      {\n        "c": null\n      }\n    ]\n  }\n}',
    );
  });

  it('is idempotent', () => {
    expect(formatBody(formatBody(MINIFIED))).toBe(formatBody(MINIFIED));
  });

  it('fails open on non-JSON text', () => {
    expect(formatBody('not json')).toBe('not json');
    expect(formatBody('{"a":1')).toBe('{"a":1');
  });
});

describe('minifyBody', () => {
  it('minifies pretty JSON', () => {
    expect(minifyBody(PRETTY)).toBe(MINIFIED);
  });

  it('is idempotent and stable through format', () => {
    expect(minifyBody(minifyBody(PRETTY))).toBe(MINIFIED);
    expect(minifyBody(formatBody(MINIFIED))).toBe(MINIFIED);
  });

  it('fails open on non-JSON text', () => {
    expect(minifyBody('plain text')).toBe('plain text');
  });
});

describe('template atoms', () => {
  it('formats bodies with template values', () => {
    const body = '{"count":{{live.count}},"host":"api.openheaders.io"}';
    expect(formatBody(body)).toBe('{\n  "count": {{live.count}},\n  "host": "api.openheaders.io"\n}');
    expect(minifyBody(formatBody(body))).toBe(body);
  });

  it('keeps template atoms verbatim in nested and array positions', () => {
    const body = '{"a":[{{VAR}},1],"b":{"c":{{collection.TOKEN}}}}';
    expect(minifyBody(formatBody(body))).toBe(body);
  });

  it('treats templates inside strings as plain string content', () => {
    const body = '{"msg":"hello {{name}} bye"}';
    const tokens = tokenizeJsonish(body);
    expect(tokens?.some((tok) => tok.kind === 'template')).toBe(false);
    expect(minifyBody(formatBody(body))).toBe(body);
  });
});

describe('detectBodyProfile', () => {
  it('detects minified bodies', () => {
    expect(detectBodyProfile(MINIFIED)).toEqual({ kind: 'minified', trailingNewline: false });
    expect(detectBodyProfile(`${MINIFIED}\n`)).toEqual({ kind: 'minified', trailingNewline: true });
  });

  it('detects two- and four-space indentation', () => {
    expect(detectBodyProfile(PRETTY)).toEqual({ kind: 'indented', indent: '  ', trailingNewline: false });
    expect(detectBodyProfile('{\n    "a": 1\n}')).toEqual({
      kind: 'indented',
      indent: '    ',
      trailingNewline: false,
    });
  });

  it('detects tab indentation and trailing newline', () => {
    expect(detectBodyProfile('{\n\t"a": 1\n}\n')).toEqual({ kind: 'indented', indent: '\t', trailingNewline: true });
  });

  it('reads unknown for non-JSON and unindented multi-line bodies', () => {
    expect(detectBodyProfile('plain text')).toEqual({ kind: 'unknown' });
    expect(detectBodyProfile('{\n"a": 1\n}')).toEqual({ kind: 'unknown' });
  });
});

describe('reformatBody', () => {
  it('re-emits edited pretty text in a minified wire profile', () => {
    const profile = detectBodyProfile(MINIFIED);
    const edited = formatBody(MINIFIED).replace('"GET"', '"POST"');
    expect(reformatBody(edited, profile)).toBe(MINIFIED.replace('"GET"', '"POST"'));
  });

  it('keeps an indented origin in its own unit', () => {
    const origin = '{\n    "a": 1\n}\n';
    const profile = detectBodyProfile(origin);
    expect(reformatBody('{ "a": 1, "b": 2 }', profile)).toBe('{\n    "a": 1,\n    "b": 2\n}\n');
  });

  it('re-appends the trailing newline of the origin', () => {
    const profile = detectBodyProfile(`${MINIFIED}\n`);
    expect(reformatBody(PRETTY, profile)).toBe(`${MINIFIED}\n`);
  });

  it('returns edited text verbatim for unknown profiles', () => {
    expect(reformatBody('anything at all', { kind: 'unknown' })).toBe('anything at all');
  });

  it('round-trips an unedited body byte-identically', () => {
    for (const origin of [MINIFIED, `${MINIFIED}\n`, PRETTY, '{\n\t"a": 1\n}\n']) {
      const profile = detectBodyProfile(origin);
      expect(reformatBody(formatBody(origin), profile)).toBe(origin);
    }
  });
});

describe('encodeBodyForWire', () => {
  it('an untouched formatted view returns the original bytes exactly', () => {
    expect(encodeBodyForWire(MINIFIED, formatBody(MINIFIED))).toBe(MINIFIED);
    expect(encodeBodyForWire(`${MINIFIED}\n`, formatBody(`${MINIFIED}\n`))).toBe(`${MINIFIED}\n`);
  });

  it('an identical view returns the original bytes exactly (non-JSON included)', () => {
    expect(encodeBodyForWire('plain text', 'plain text')).toBe('plain text');
    expect(encodeBodyForWire(PRETTY, PRETTY)).toBe(PRETTY);
  });

  it('re-emits an edited view in the original profile', () => {
    const edited = formatBody(MINIFIED).replace('"GET"', '"PUT"');
    expect(encodeBodyForWire(MINIFIED, edited)).toBe(MINIFIED.replace('"GET"', '"PUT"'));
    expect(encodeBodyForWire('{\n    "a": 1\n}', '{ "a": 2 }')).toBe('{\n    "a": 2\n}');
  });

  it('passes unformattable edits through as typed', () => {
    expect(encodeBodyForWire(MINIFIED, 'broken {')).toBe('broken {');
    expect(encodeBodyForWire('plain text', 'edited text')).toBe('edited text');
  });

  it('preserves template atoms through the round-trip', () => {
    const original = '{"count":{{live.count}}}';
    const edited = formatBody(original).replace('{{live.count}}', '{{live.total}}');
    expect(encodeBodyForWire(original, edited)).toBe('{"count":{{live.total}}}');
  });
});

describe('isFormattableBody', () => {
  it('mirrors the tokenizer gate', () => {
    expect(isFormattableBody(MINIFIED)).toBe(true);
    expect(isFormattableBody('{"count":{{live.count}}}')).toBe(true);
    expect(isFormattableBody('plain text')).toBe(false);
    expect(isFormattableBody('{"a":1')).toBe(false);
  });
});
