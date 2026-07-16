/**
 * Schema-driven protobuf codec — canonical JSON ⇄ wire round trips.
 *
 * Pins the Phase B codec contract: every scalar across all four wire
 * types (64-bit lanes exact at the extremes, as strings), packed and
 * expanded repeated forms, maps over each key family, oneofs (encode
 * rejects double-set arms, decode last-wins), nested and merged
 * singular messages, open enums, unknown-field retention under
 * `$unknown`, compose-side honesty (unknown JSON keys and
 * unresolved-type fields reject), and the well-known JSON forms —
 * Timestamp, Duration, wrappers, Struct/Value/ListValue, FieldMask,
 * and Any.
 */

import {
  buildRegistry,
  decodeMessage,
  encodeMessage,
  PROTO_UNKNOWN_FIELDS_KEY,
  ProtoCodecError,
  type ProtoJsonValue,
  type ProtoRegistry,
  parseProto,
} from '@openheaders/core/proto';
import { describe, expect, it } from 'vitest';

const registryOf = (source: string): ProtoRegistry =>
  buildRegistry([{ path: 'openheaders/test.proto', census: parseProto(source) }]);

const SCALARS = `syntax = "proto3";
package openheaders.codec.v1;

message Scalars {
  double f_double = 1;
  float f_float = 2;
  int32 f_int32 = 3;
  int64 f_int64 = 4;
  uint32 f_uint32 = 5;
  uint64 f_uint64 = 6;
  sint32 f_sint32 = 7;
  sint64 f_sint64 = 8;
  fixed32 f_fixed32 = 9;
  fixed64 f_fixed64 = 10;
  sfixed32 f_sfixed32 = 11;
  sfixed64 f_sfixed64 = 12;
  bool f_bool = 13;
  string f_string = 14;
  bytes f_bytes = 15;
}
`;

const SCALARS_TYPE = 'openheaders.codec.v1.Scalars';

const roundTrip = (registry: ProtoRegistry, type: string, value: ProtoJsonValue): ProtoJsonValue =>
  decodeMessage(registry, type, encodeMessage(registry, type, value));

describe('proto codec — scalars', () => {
  it('round-trips every scalar with 64-bit lanes exact at the extremes', () => {
    const registry = registryOf(SCALARS);
    const value: ProtoJsonValue = {
      fDouble: 1.5,
      fFloat: -2.5,
      fInt32: -2147483648,
      fInt64: '9223372036854775807',
      fUint32: 4294967295,
      fUint64: '18446744073709551615',
      fSint32: -123456,
      fSint64: '-9223372036854775808',
      fFixed32: 7,
      fFixed64: '81985529216486895',
      fSfixed32: -8,
      fSfixed64: '-42',
      fBool: true,
      fString: 'https://openheaders.io',
      fBytes: 'b3BlbmhlYWRlcnM=',
    };
    expect(roundTrip(registry, SCALARS_TYPE, value)).toEqual(value);
  });

  it('keeps non-finite floats as canonical JSON strings', () => {
    const registry = registryOf(SCALARS);
    const value: ProtoJsonValue = { fDouble: 'NaN', fFloat: 'Infinity' };
    expect(roundTrip(registry, SCALARS_TYPE, value)).toEqual({ fDouble: 'NaN', fFloat: 'Infinity' });
    expect(roundTrip(registry, SCALARS_TYPE, { fDouble: '-Infinity' })).toEqual({ fDouble: '-Infinity' });
  });

  it('accepts 64-bit values as safe numbers and decimal strings interchangeably', () => {
    const registry = registryOf(SCALARS);
    expect(roundTrip(registry, SCALARS_TYPE, { fInt64: 42 })).toEqual({ fInt64: '42' });
    expect(() => encodeMessage(registry, SCALARS_TYPE, { fInt64: 2 ** 53 })).toThrowError(ProtoCodecError);
    expect(() => encodeMessage(registry, SCALARS_TYPE, { fUint64: '-1' })).toThrowError(/out of range/);
  });

  it('accepts URL-safe base64 for bytes fields', () => {
    const registry = registryOf(SCALARS);
    const wire = encodeMessage(registry, SCALARS_TYPE, { fBytes: 'a-_x' });
    expect(decodeMessage(registry, SCALARS_TYPE, wire)).toEqual({ fBytes: 'a+/x' });
  });

  it('emits known golden wire bytes', () => {
    const registry = registryOf(`syntax = "proto3";
package openheaders.codec.v1;
message Golden { string id = 1; int32 n = 2; sint32 z = 3; }
`);
    expect([...encodeMessage(registry, 'openheaders.codec.v1.Golden', { id: 'a' })]).toEqual([0x0a, 1, 97]);
    expect([...encodeMessage(registry, 'openheaders.codec.v1.Golden', { n: 300 })]).toEqual([0x10, 0xac, 0x02]);
    expect([...encodeMessage(registry, 'openheaders.codec.v1.Golden', { z: -1 })]).toEqual([0x18, 0x01]);
  });
});

describe('proto codec — repeated and maps', () => {
  const REPEATED = `syntax = "proto3";
package openheaders.codec.v1;
message Batch {
  repeated int32 nums = 1;
  repeated string tags = 2;
  map<string, string> labels = 3;
  map<int64, string> by_id = 4;
  map<bool, string> flags = 5;
  map<string, Point> points = 6;
}
message Point { int32 x = 1; int32 y = 2; }
`;
  const BATCH = 'openheaders.codec.v1.Batch';

  it('packs repeated scalars and round-trips them', () => {
    const registry = registryOf(REPEATED);
    const wire = encodeMessage(registry, BATCH, { nums: [1, 2, 3] });
    expect([...wire]).toEqual([0x0a, 3, 1, 2, 3]);
    expect(decodeMessage(registry, BATCH, wire)).toEqual({ nums: [1, 2, 3] });
  });

  it('decodes the expanded (unpacked) repeated form too', () => {
    const registry = registryOf(REPEATED);
    const wire = Uint8Array.of(0x08, 1, 0x08, 2);
    expect(decodeMessage(registry, BATCH, wire)).toEqual({ nums: [1, 2] });
  });

  it('round-trips string, int64, bool, and message-valued maps', () => {
    const registry = registryOf(REPEATED);
    const value: ProtoJsonValue = {
      tags: ['alpha', 'beta'],
      labels: { env: 'openheaders', tier: 'pro' },
      byId: { '9007199254740993': 'big', '-1': 'neg' },
      flags: { true: 'on', false: 'off' },
      points: { origin: { x: 0, y: 0 }, far: { x: 7, y: -7 } },
    };
    expect(roundTrip(registry, BATCH, value)).toEqual(value);
  });

  it('rejects null map values and null repeated elements', () => {
    const registry = registryOf(REPEATED);
    expect(() => encodeMessage(registry, BATCH, { labels: { env: null } })).toThrowError(/null/);
    expect(() => encodeMessage(registry, BATCH, { tags: ['a', null] })).toThrowError(/null/);
  });
});

describe('proto codec — messages, oneofs, enums', () => {
  const SHAPES = `syntax = "proto3";
package openheaders.codec.v1;
message Outer { Inner inner = 1; repeated Inner many = 2; }
message Inner { string a = 1; string b = 2; }
message Choice {
  oneof pick {
    string name = 1;
    int32 code = 2;
  }
}
message Tagged { Genre genre = 1; repeated Genre genres = 2; }
enum Genre { GENRE_UNSPECIFIED = 0; FICTION = 1; REFERENCE = 2; }
`;

  it('round-trips nested and repeated messages', () => {
    const registry = registryOf(SHAPES);
    const value: ProtoJsonValue = { inner: { a: 'x', b: 'y' }, many: [{ a: '1' }, { b: '2' }] };
    expect(roundTrip(registry, 'openheaders.codec.v1.Outer', value)).toEqual(value);
  });

  it('merges split occurrences of a singular message field', () => {
    const registry = registryOf(SHAPES);
    const first = encodeMessage(registry, 'openheaders.codec.v1.Inner', { a: 'x' });
    const second = encodeMessage(registry, 'openheaders.codec.v1.Inner', { b: 'y' });
    const wire = Uint8Array.of(0x0a, first.length, ...first, 0x0a, second.length, ...second);
    expect(decodeMessage(registry, 'openheaders.codec.v1.Outer', wire)).toEqual({ inner: { a: 'x', b: 'y' } });
  });

  it('rejects a double-set oneof on encode and keeps the last arm on decode', () => {
    const registry = registryOf(SHAPES);
    expect(() => encodeMessage(registry, 'openheaders.codec.v1.Choice', { name: 'a', code: 1 })).toThrowError(/Oneof/);
    const name = encodeMessage(registry, 'openheaders.codec.v1.Choice', { name: 'a' });
    const code = encodeMessage(registry, 'openheaders.codec.v1.Choice', { code: 7 });
    const wire = Uint8Array.of(...name, ...code);
    expect(decodeMessage(registry, 'openheaders.codec.v1.Choice', wire)).toEqual({ code: 7 });
  });

  it('maps enums to names, accepts numbers, and keeps unknown numbers numeric', () => {
    const registry = registryOf(SHAPES);
    const type = 'openheaders.codec.v1.Tagged';
    expect(roundTrip(registry, type, { genre: 'FICTION', genres: ['REFERENCE', 'FICTION'] })).toEqual({
      genre: 'FICTION',
      genres: ['REFERENCE', 'FICTION'],
    });
    const byNumber = encodeMessage(registry, type, { genre: 2 });
    expect(decodeMessage(registry, type, byNumber)).toEqual({ genre: 'REFERENCE' });
    const unknown = encodeMessage(registry, type, { genre: 99 });
    expect(decodeMessage(registry, type, unknown)).toEqual({ genre: 99 });
    expect(() => encodeMessage(registry, type, { genre: 'MYSTERY' })).toThrowError(/Unknown enum value/);
  });

  it('accepts both original and JSON field names, rejecting duplicates and unknowns', () => {
    const registry = registryOf(SCALARS);
    const wire = encodeMessage(registry, SCALARS_TYPE, { f_int32: 5 });
    expect(decodeMessage(registry, SCALARS_TYPE, wire)).toEqual({ fInt32: 5 });
    expect(() => encodeMessage(registry, SCALARS_TYPE, { f_int32: 5, fInt32: 5 })).toThrowError(/more than once/);
    expect(() => encodeMessage(registry, SCALARS_TYPE, { mystery: 1 })).toThrowError(/Unknown field/);
  });
});

describe('proto codec — unknown and unresolved fields', () => {
  it('retains unknown wire fields structurally under $unknown', () => {
    const full = registryOf(`syntax = "proto3";
package openheaders.codec.v1;
message Grown { string id = 1; uint64 added = 2; bytes blob = 3; }
`);
    const reduced = registryOf(`syntax = "proto3";
package openheaders.codec.v1;
message Grown { string id = 1; }
`);
    const wire = encodeMessage(full, 'openheaders.codec.v1.Grown', {
      id: 'r1',
      added: '18446744073709551615',
      blob: 'b3BlbmhlYWRlcnM=',
    });
    expect(decodeMessage(reduced, 'openheaders.codec.v1.Grown', wire)).toEqual({
      id: 'r1',
      [PROTO_UNKNOWN_FIELDS_KEY]: { '2': '18446744073709551615', '3': 'b3BlbmhlYWRlcnM=' },
    });
  });

  it('rejects encoding through an unresolved-type field but decodes it as structure', () => {
    const registry = registryOf(`syntax = "proto3";
package openheaders.codec.v1;
message Holder { string id = 1; Missing thing = 2; }
`);
    const type = 'openheaders.codec.v1.Holder';
    expect(() => encodeMessage(registry, type, { thing: {} })).toThrowError(/unresolved type/);
    const okay = encodeMessage(registry, type, { id: 'r1' });
    expect(decodeMessage(registry, type, okay)).toEqual({ id: 'r1' });
    const wire = Uint8Array.of(...okay, 0x10, 0x2a);
    expect(decodeMessage(registry, type, wire)).toEqual({ id: 'r1', thing: '42' });
  });

  it('throws ProtoCodecError on truncated or malformed wire bytes', () => {
    const registry = registryOf(SCALARS);
    expect(() => decodeMessage(registry, SCALARS_TYPE, Uint8Array.of(0x72, 5, 97))).toThrowError(ProtoCodecError);
    expect(() => decodeMessage(registry, SCALARS_TYPE, Uint8Array.of(0x1b))).toThrowError(/wire type/i);
    expect(() => decodeMessage(registry, 'openheaders.codec.v1.Nope', new Uint8Array(0))).toThrowError(
      /Unknown message/,
    );
  });
});

describe('proto codec — well-known types', () => {
  const WELL_KNOWN = `syntax = "proto3";
package openheaders.codec.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/wrappers.proto";
import "google/protobuf/field_mask.proto";
import "google/protobuf/any.proto";
import "google/protobuf/empty.proto";

message Envelope {
  google.protobuf.Timestamp sent_at = 1;
  google.protobuf.Duration ttl = 2;
  google.protobuf.Struct meta = 3;
  google.protobuf.Value free = 4;
  google.protobuf.ListValue list = 5;
  google.protobuf.Int64Value big = 6;
  google.protobuf.StringValue note = 7;
  google.protobuf.BoolValue flag = 8;
  google.protobuf.FieldMask mask = 9;
  google.protobuf.Any payload = 10;
  google.protobuf.Empty nothing = 11;
}
message Ping { string msg = 1; }
`;
  const ENVELOPE = 'openheaders.codec.v1.Envelope';

  it('round-trips Timestamp with fractional digits and normalizes offsets', () => {
    const registry = registryOf(WELL_KNOWN);
    expect(roundTrip(registry, ENVELOPE, { sentAt: '2026-07-16T12:34:56.789Z' })).toEqual({
      sentAt: '2026-07-16T12:34:56.789Z',
    });
    expect(roundTrip(registry, ENVELOPE, { sentAt: '2026-07-16T00:00:00.000000001Z' })).toEqual({
      sentAt: '2026-07-16T00:00:00.000000001Z',
    });
    expect(roundTrip(registry, ENVELOPE, { sentAt: '2026-07-16T14:34:56+02:00' })).toEqual({
      sentAt: '2026-07-16T12:34:56Z',
    });
    expect(() => encodeMessage(registry, ENVELOPE, { sentAt: '2026-02-30T00:00:00Z' })).toThrowError(/calendar/);
    expect(() => encodeMessage(registry, ENVELOPE, { sentAt: 'yesterday' })).toThrowError(ProtoCodecError);
  });

  it('round-trips Duration including negative and sub-second values', () => {
    const registry = registryOf(WELL_KNOWN);
    // Canonical JSON pads fractional seconds to 3/6/9 digits.
    expect(roundTrip(registry, ENVELOPE, { ttl: '3.5s' })).toEqual({ ttl: '3.500s' });
    expect(roundTrip(registry, ENVELOPE, { ttl: '-2s' })).toEqual({ ttl: '-2s' });
    expect(roundTrip(registry, ENVELOPE, { ttl: '0.000000001s' })).toEqual({ ttl: '0.000000001s' });
    expect(() => encodeMessage(registry, ENVELOPE, { ttl: '5 seconds' })).toThrowError(ProtoCodecError);
  });

  it('maps wrappers to bare values', () => {
    const registry = registryOf(WELL_KNOWN);
    const value: ProtoJsonValue = { big: '9223372036854775807', note: 'openheaders', flag: false };
    expect(roundTrip(registry, ENVELOPE, value)).toEqual(value);
  });

  it('round-trips Struct, Value, and ListValue as plain JSON', () => {
    const registry = registryOf(WELL_KNOWN);
    const value: ProtoJsonValue = {
      meta: { env: 'openheaders.io', count: 2, ok: true, none: null, tags: ['a', 1], nested: { x: 1.5 } },
      free: 'loose',
      list: [true, 'two', 3, null, { four: 4 }],
    };
    expect(roundTrip(registry, ENVELOPE, value)).toEqual(value);
    expect(roundTrip(registry, ENVELOPE, { free: null })).toEqual({ free: null });
  });

  it('round-trips FieldMask through the camel/snake boundary', () => {
    const registry = registryOf(WELL_KNOWN);
    expect(roundTrip(registry, ENVELOPE, { mask: 'user.displayName,photo' })).toEqual({
      mask: 'user.displayName,photo',
    });
  });

  it('expands Any for registered types and passes unknown types through', () => {
    const registry = registryOf(WELL_KNOWN);
    const typed: ProtoJsonValue = {
      payload: { '@type': 'type.googleapis.com/openheaders.codec.v1.Ping', msg: 'hello openheaders.io' },
    };
    expect(roundTrip(registry, ENVELOPE, typed)).toEqual(typed);
    const passthrough: ProtoJsonValue = {
      payload: { '@type': 'type.googleapis.com/openheaders.unknown.Blob', value: 'b3BlbmhlYWRlcnM=' },
    };
    expect(roundTrip(registry, ENVELOPE, passthrough)).toEqual(passthrough);
    expect(() =>
      encodeMessage(registry, ENVELOPE, { payload: { '@type': 'type.googleapis.com/openheaders.unknown.Blob' } }),
    ).toThrowError(/pass through/);
  });

  it('treats Empty as an empty object and rejects extra keys', () => {
    const registry = registryOf(WELL_KNOWN);
    expect(roundTrip(registry, ENVELOPE, { nothing: {} })).toEqual({ nothing: {} });
    expect(() => encodeMessage(registry, ENVELOPE, { nothing: { extra: 1 } })).toThrowError(/Unknown field/);
  });
});
