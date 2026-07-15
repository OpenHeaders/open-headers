/**
 * Schema-less binary decode laws for the response Preview: content-type
 * dispatch (CBOR / MessagePack, `cbor-seq` excluded), full decode
 * matrices for both formats (ints riding the F3 exact-display law,
 * diagnostic notation for byte strings / tags / extensions / non-string
 * map keys, indefinite lengths, half-precision floats), graceful
 * failure (`null`, never a throw) on malformed or truncated bytes, and
 * the hostile-input caps (depth, claimed lengths, byte-preview hex).
 *
 * The probe fixtures mirror the playground's deterministic `/api/cbor`
 * and `/api/msgpack` bodies (`playground/server/api-binary.ts`, each
 * validated against a reference decoder) — the e2e sweep drives the
 * same bytes through the real viewer.
 */

import { isJsonNumber } from '@openheaders/ui/workbench/components/request-editor/response/lossless-json';
import {
  binaryDecodeKind,
  DiagnosticText,
  decodeBinaryPreview,
  isDiagnosticText,
} from '@openheaders/ui/workbench/components/request-editor/response/response-binary-decode';
import { describe, expect, it } from 'vitest';

const bytesOf = (hex: string): Uint8Array => {
  const clean = hex.replaceAll(' ', '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const cbor = (hex: string): unknown => {
  const result = decodeBinaryPreview('cbor', bytesOf(hex));
  expect(result).not.toBeNull();
  return result?.value;
};

const msgpack = (hex: string): unknown => {
  const result = decodeBinaryPreview('msgpack', bytesOf(hex));
  expect(result).not.toBeNull();
  return result?.value;
};

const sourceOf = (value: unknown): string => {
  if (!isJsonNumber(value)) throw new Error(`expected a JsonNumber leaf, got ${String(value)}`);
  return value.source;
};

const textOf = (value: unknown): string => {
  if (!isDiagnosticText(value)) throw new Error(`expected a DiagnosticText leaf, got ${String(value)}`);
  return value.text;
};

const headersOf = (contentType: string) => [{ key: 'Content-Type', value: contentType }];

describe('binaryDecodeKind', () => {
  it('maps the CBOR and MessagePack media types, parameters included', () => {
    expect(binaryDecodeKind(headersOf('application/cbor'))).toBe('cbor');
    expect(binaryDecodeKind(headersOf('application/cbor; charset=binary'))).toBe('cbor');
    expect(binaryDecodeKind(headersOf('application/msgpack'))).toBe('msgpack');
    expect(binaryDecodeKind(headersOf('application/x-msgpack'))).toBe('msgpack');
    expect(binaryDecodeKind(headersOf('application/vnd.msgpack'))).toBe('msgpack');
  });

  it('stays dark for cbor-seq (multi-item framing) and unrelated types', () => {
    expect(binaryDecodeKind(headersOf('application/cbor-seq'))).toBeNull();
    expect(binaryDecodeKind(headersOf('application/json'))).toBeNull();
    expect(binaryDecodeKind([])).toBeNull();
  });
});

/** The `/api/cbor` probe body, verbatim (validated against a reference
 *  decoder at build time). */
const CBOR_PROBE = [
  'ae', // map(14)
  '646b696e64 6463626f72', // "kind": "cbor"
  '65636f756e74 190403', // "count": 1027
  '63626967 1b0020000000000001', // "big": 9007199254740993 (2^53+1)
  '636e6567 3829', // "neg": -42
  '627069 fb400921fb54442d18', // "pi": float64
  '626f6b f5', // "ok": true
  '676e6f7468696e67 f6', // "nothing": null
  '65756e646566 f7', // "undef": undefined
  '647768656e c11a66851e00', // "when": 1(1720000000)
  '656279746573 4300ff10', // "bytes": h'00FF10'
  '666269676e756d c249010000000000000000', // "bignum": 2(h'01…') = 2^64
  '656974656d73 83 01 6374776f a1 6464656570 41ff', // "items": [1, "two", {"deep": h'FF'}]
  '6673747265616d 9f0102ff', // "stream": [_ 1, 2]
  '07 67696e742d6b6579', // 7: "int-key"
].join('');

describe('CBOR decode — probe fixture', () => {
  it('decodes the full probe map, every leaf in its display shape', () => {
    const value = cbor(CBOR_PROBE) as Record<string, unknown>;
    // Integer-like keys enumerate first in JS objects — '7' leads.
    expect(Object.keys(value)).toEqual([
      '7',
      'kind',
      'count',
      'big',
      'neg',
      'pi',
      'ok',
      'nothing',
      'undef',
      'when',
      'bytes',
      'bignum',
      'items',
      'stream',
    ]);
    expect(value.kind).toBe('cbor');
    expect(value.count).toBe(1027);
    expect(sourceOf(value.big)).toBe('9007199254740993');
    expect(value.neg).toBe(-42);
    expect(value.pi).toBe(Math.PI);
    expect(value.ok).toBe(true);
    expect(value.nothing).toBeNull();
    expect(textOf(value.undef)).toBe('undefined');
    expect(textOf(value.when)).toBe('1(1720000000)');
    expect(textOf(value.bytes)).toBe("h'00FF10'");
    expect(sourceOf(value.bignum)).toBe('18446744073709551616');
    const items = value.items as unknown[];
    expect(items[0]).toBe(1);
    expect(items[1]).toBe('two');
    expect(textOf((items[2] as Record<string, unknown>).deep)).toBe("h'FF'");
    expect(value.stream).toEqual([1, 2]);
    expect(value['7']).toBe('int-key');
  });

  it('never rewrites the input bytes (display-only law)', () => {
    const input = bytesOf(CBOR_PROBE);
    const pristine = Uint8Array.from(input);
    decodeBinaryPreview('cbor', input);
    expect(input).toEqual(pristine);
  });
});

describe('CBOR decode — value shapes', () => {
  it('keeps exact-double integers plain and wraps past safe range (F3 law)', () => {
    expect(cbor('17')).toBe(23); // direct
    expect(cbor('1b001fffffffffffff')).toBe(9007199254740991); // 2^53-1, exact
    expect(sourceOf(cbor('1bffffffffffffffff'))).toBe('18446744073709551615'); // uint64 max
    expect(cbor('3a00000029')).toBe(-42); // 4-byte argument form
    expect(sourceOf(cbor('3bffffffffffffffff'))).toBe('-18446744073709551616'); // -2^64
  });

  it('renders negative bignums (tag 3) exactly', () => {
    // 3(h'0100000000000000') = -(2^56) - 1
    expect(sourceOf(cbor('c3480100000000000000'))).toBe('-72057594037927937');
  });

  it('decodes half-precision floats (additional info 25)', () => {
    expect(cbor('f93c00')).toBe(1);
    expect(cbor('f9c400')).toBe(-4);
    expect(cbor('f97c00')).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(cbor('f97e00'))).toBe(true);
    expect(cbor('f90001')).toBe(2 ** -24); // smallest subnormal
  });

  it('decodes single-precision floats', () => {
    expect(cbor('fa3fc00000')).toBe(1.5);
  });

  it('concatenates indefinite-length string chunks', () => {
    expect(cbor('7f63666f6f63626172ff')).toBe('foobar');
    expect(textOf(cbor('5f41ff4200ffff'))).toBe("h'FF00FF'");
  });

  it('decodes indefinite-length maps', () => {
    expect(cbor('bf6161016162820203ff')).toEqual({ a: 1, b: [2, 3] });
  });

  it('wraps tagged containers as a single diagnostic key', () => {
    expect(cbor('d82a820102')).toEqual({ '42(…)': [1, 2] });
  });

  it('prints tagged primitives inline, strings quoted', () => {
    expect(textOf(cbor('c06a323032362d30372d3135'))).toBe('0("2026-07-15")');
  });

  it('stringifies non-string map keys diagnostically, last value on collision', () => {
    expect(cbor('a1f5182a')).toEqual({ true: 42 });
    // {h'00': "x", 1: "int", "1": "str"} — the int key and the string
    // key stringify identically; the later pair wins (JSON precedent).
    expect(cbor('a3410061780163696e74613163737472')).toEqual({ "h'00'": 'x', '1': 'str' });
  });

  it('renders unassigned simple values diagnostically', () => {
    expect(textOf(cbor('f0'))).toBe('simple(16)');
    expect(textOf(cbor('f863'))).toBe('simple(99)');
  });

  it('caps the byte-string hex preview and reports the true size', () => {
    const hex = `59012c${'ab'.repeat(300)}`; // 300-byte string
    const text = textOf(cbor(hex));
    expect(text.startsWith("h'")).toBe(true);
    expect(text).toContain('…');
    expect(text).toContain('(300 bytes)');
    expect(text.length).toBeLessThan(300 * 2);
  });
});

describe('CBOR decode — graceful failure', () => {
  const rejects = (hex: string) => expect(decodeBinaryPreview('cbor', bytesOf(hex))).toBeNull();

  it('rejects malformed, truncated, and trailing-byte inputs', () => {
    rejects(''); // empty body
    rejects('1b0020'); // truncated uint64 argument
    rejects('8201'); // array(2) with one element
    rejects('0100'); // trailing byte after the root item
    rejects('ff'); // break with no open container
    rejects('1c'); // reserved additional info 28
    rejects('f800'); // simple < 32 in two-byte form (RFC 8949)
    rejects('62c328'); // text string that is not valid UTF-8
    rejects('5b7fffffffffffffff'); // byte string claiming 2^63 bytes
    rejects('9b0000001000000000'); // array claiming 2^36 elements
  });

  it('rejects hostile nesting past the depth cap, keeps sane nesting', () => {
    rejects(`${'81'.repeat(200)}01`);
    expect(cbor(`${'81'.repeat(10)}01`)).toEqual([[[[[[[[[[1]]]]]]]]]]);
  });
});

/** The `/api/msgpack` probe body, verbatim (validated against a
 *  reference decoder at build time). */
const MSGPACK_PROBE = [
  '8b', // fixmap(11)
  'a46b696e64 a76d73677061636b', // "kind": "msgpack"
  'a5636f756e74 cd0403', // "count": 1027
  'a3626967 cf0020000000000001', // "big": 9007199254740993
  'a36e6567 d0d6', // "neg": -42
  'a27069 cb400921fb54442d18', // "pi": float64
  'a26f6b c3', // "ok": true
  'a76e6f7468696e67 c0', // "nothing": nil
  'a56279746573 c40300ff10', // "bytes": bin8
  'a3657874 d62adeadbeef', // "ext": fixext4, type 42
  'a56974656d73 93 01 a374776f 81 a464656570 c401ff', // "items": [1, "two", {"deep": bin8 FF}]
  '07 a7696e742d6b6579', // 7: "int-key"
].join('');

describe('MessagePack decode — probe fixture', () => {
  it('decodes the full probe map, every leaf in its display shape', () => {
    const value = msgpack(MSGPACK_PROBE) as Record<string, unknown>;
    expect(Object.keys(value)).toHaveLength(11);
    expect(value.kind).toBe('msgpack');
    expect(value.count).toBe(1027);
    expect(sourceOf(value.big)).toBe('9007199254740993');
    expect(value.neg).toBe(-42);
    expect(value.pi).toBe(Math.PI);
    expect(value.ok).toBe(true);
    expect(value.nothing).toBeNull();
    expect(textOf(value.bytes)).toBe("h'00FF10'");
    expect(textOf(value.ext)).toBe("ext(42, h'DEADBEEF')");
    const items = value.items as unknown[];
    expect(items[0]).toBe(1);
    expect(items[1]).toBe('two');
    expect(textOf((items[2] as Record<string, unknown>).deep)).toBe("h'FF'");
    expect(value['7']).toBe('int-key');
  });

  it('never rewrites the input bytes (display-only law)', () => {
    const input = bytesOf(MSGPACK_PROBE);
    const pristine = Uint8Array.from(input);
    decodeBinaryPreview('msgpack', input);
    expect(input).toEqual(pristine);
  });
});

describe('MessagePack decode — value shapes', () => {
  it('covers the integer families, wrapping past safe range (F3 law)', () => {
    expect(msgpack('7f')).toBe(127); // positive fixint
    expect(msgpack('e0')).toBe(-32); // negative fixint
    expect(msgpack('ccff')).toBe(255);
    expect(msgpack('cdffff')).toBe(65535);
    expect(msgpack('ceffffffff')).toBe(4294967295);
    expect(sourceOf(msgpack('cfffffffffffffffff'))).toBe('18446744073709551615');
    expect(msgpack('d3ffffffffffffffff')).toBe(-1); // int64 within safe range stays plain
    expect(sourceOf(msgpack('d38000000000000000'))).toBe('-9223372036854775808');
  });

  it('decodes float32 and float64', () => {
    expect(msgpack('ca3fc00000')).toBe(1.5);
    expect(msgpack('cb3ff0000000000000')).toBe(1);
  });

  it('decodes the sized string, array, and map heads', () => {
    expect(msgpack('d903616263')).toBe('abc'); // str8
    expect(msgpack('dc00020102')).toEqual([1, 2]); // array16
    expect(msgpack('de0001a161c2')).toEqual({ a: false }); // map16
  });

  it('renders every extension family diagnostically', () => {
    expect(textOf(msgpack('d4 01 ab'))).toBe("ext(1, h'AB')");
    expect(textOf(msgpack('d8 ff 000102030405060708090a0b0c0d0e0f'))).toBe(
      "ext(-1, h'000102030405060708090A0B0C0D0E0F')",
    );
    expect(textOf(msgpack('c7 03 2a 010203'))).toBe("ext(42, h'010203')");
  });

  it('stringifies non-string map keys diagnostically', () => {
    expect(msgpack('81c32a')).toEqual({ true: 42 });
  });
});

describe('MessagePack decode — graceful failure', () => {
  const rejects = (hex: string) => expect(decodeBinaryPreview('msgpack', bytesOf(hex))).toBeNull();

  it('rejects malformed, truncated, and trailing-byte inputs', () => {
    rejects(''); // empty body
    rejects('c1'); // the reserved never-used head byte
    rejects('cf0020'); // truncated uint64
    rejects('9201'); // fixarray(2) with one element
    rejects('0100'); // trailing byte after the root item
    rejects('a2c328'); // fixstr that is not valid UTF-8
    rejects('dbffffffff'); // str32 claiming 4 GB
    rejects('ddffffffff'); // array32 claiming 2^32 elements
  });

  it('rejects hostile nesting past the depth cap, keeps sane nesting', () => {
    rejects(`${'91'.repeat(200)}01`);
    expect(msgpack(`${'91'.repeat(10)}01`)).toEqual([[[[[[[[[[1]]]]]]]]]]);
  });
});

describe('decodeBinaryPreview result wrapping', () => {
  it('keeps a legitimately decoded null distinguishable from failure', () => {
    expect(decodeBinaryPreview('msgpack', bytesOf('c0'))).toEqual({ value: null });
    expect(decodeBinaryPreview('cbor', bytesOf('f6'))).toEqual({ value: null });
  });

  it('DiagnosticText round-trips through toString', () => {
    expect(String(new DiagnosticText("h'00'"))).toBe("h'00'");
  });
});
