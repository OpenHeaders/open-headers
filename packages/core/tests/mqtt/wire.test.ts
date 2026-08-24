import { describe, expect, it } from 'vitest';
import { MQTT_VARINT_MAX, MqttCodecError, MqttReader, MqttWriter } from '../../src/mqtt';

const NUL = String.fromCharCode(0);

function varintBytes(value: number): Uint8Array {
  const writer = new MqttWriter();
  writer.varint(value);
  return writer.finish();
}

describe('variable byte integer', () => {
  it('round-trips every encoding-length boundary', () => {
    const boundaries: Array<[number, number]> = [
      [0, 1],
      [1, 1],
      [127, 1],
      [128, 2],
      [16_383, 2],
      [16_384, 3],
      [2_097_151, 3],
      [2_097_152, 4],
      [MQTT_VARINT_MAX, 4],
    ];
    for (const [value, byteLength] of boundaries) {
      const bytes = varintBytes(value);
      expect(bytes.byteLength).toBe(byteLength);
      expect(new MqttReader(bytes).varint()).toBe(value);
    }
  });

  it('encodes the low group first with continuation bits', () => {
    expect([...varintBytes(128)]).toEqual([0x80, 0x01]);
    expect([...varintBytes(MQTT_VARINT_MAX)]).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });

  it('rejects out-of-range values on encode', () => {
    const writer = new MqttWriter();
    expect(() => writer.varint(MQTT_VARINT_MAX + 1)).toThrow(MqttCodecError);
    expect(() => writer.varint(-1)).toThrow(MqttCodecError);
    expect(() => writer.varint(1.5)).toThrow(MqttCodecError);
  });

  it('rejects a varint past 4 bytes on decode', () => {
    const reader = new MqttReader(new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x01]));
    expect(() => reader.varint()).toThrow('Variable byte integer exceeds 4 bytes.');
  });

  it('reports truncation instead of inventing bytes', () => {
    const reader = new MqttReader(new Uint8Array([0x80]));
    expect(() => reader.varint()).toThrow('Truncated packet.');
  });
});

describe('fixed-width integers', () => {
  it('round-trips big-endian two-byte integers', () => {
    const writer = new MqttWriter();
    writer.twoByteInt(0);
    writer.twoByteInt(0x1234);
    writer.twoByteInt(0xffff);
    const reader = new MqttReader(writer.finish());
    expect(reader.twoByteInt()).toBe(0);
    expect(reader.twoByteInt()).toBe(0x1234);
    expect(reader.twoByteInt()).toBe(0xffff);
  });

  it('round-trips big-endian four-byte integers', () => {
    const writer = new MqttWriter();
    writer.fourByteInt(0);
    writer.fourByteInt(0x0102_0304);
    writer.fourByteInt(0xffff_ffff);
    const reader = new MqttReader(writer.finish());
    expect(reader.fourByteInt()).toBe(0);
    expect(reader.fourByteInt()).toBe(0x0102_0304);
    expect(reader.fourByteInt()).toBe(0xffff_ffff);
  });

  it('writes big-endian byte order', () => {
    const writer = new MqttWriter();
    writer.twoByteInt(0x0102);
    writer.fourByteInt(0x0304_0506);
    expect([...writer.finish()]).toEqual([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
  });

  it('rejects out-of-range integers', () => {
    const writer = new MqttWriter();
    expect(() => writer.twoByteInt(0x1_0000)).toThrow(MqttCodecError);
    expect(() => writer.twoByteInt(-1)).toThrow(MqttCodecError);
    expect(() => writer.fourByteInt(0x1_0000_0000)).toThrow(MqttCodecError);
    expect(() => writer.byte(256)).toThrow(MqttCodecError);
  });
});

describe('UTF-8 strings', () => {
  it('round-trips multi-byte text under the length prefix', () => {
    const writer = new MqttWriter();
    writer.utf8String('sensors/température/☀');
    const bytes = writer.finish();
    expect(((bytes[0] << 8) | bytes[1]) + 2).toBe(bytes.byteLength);
    expect(new MqttReader(bytes).utf8String()).toBe('sensors/température/☀');
  });

  it('rejects U+0000 on both sides', () => {
    const writer = new MqttWriter();
    expect(() => writer.utf8String(`a${NUL}b`)).toThrow('String contains U+0000.');
    const reader = new MqttReader(new Uint8Array([0x00, 0x01, 0x00]));
    expect(() => reader.utf8String()).toThrow('String contains U+0000.');
  });

  it('rejects ill-formed UTF-8 on decode', () => {
    const reader = new MqttReader(new Uint8Array([0x00, 0x01, 0xff]));
    expect(() => reader.utf8String()).toThrow('String is not well-formed UTF-8.');
  });

  it('rejects strings past the two-byte length prefix', () => {
    const writer = new MqttWriter();
    expect(() => writer.utf8String('x'.repeat(65_536))).toThrow(MqttCodecError);
  });
});

describe('binary fields', () => {
  it('round-trips length-prefixed bytes', () => {
    const writer = new MqttWriter();
    writer.binary(new Uint8Array([1, 2, 3]));
    writer.binary(new Uint8Array(0));
    const reader = new MqttReader(writer.finish());
    expect([...reader.binary()]).toEqual([1, 2, 3]);
    expect(reader.binary().byteLength).toBe(0);
    expect(reader.atEnd).toBe(true);
  });

  it('rejects binary fields past the length prefix', () => {
    const writer = new MqttWriter();
    expect(() => writer.binary(new Uint8Array(65_536))).toThrow(MqttCodecError);
  });

  it('reports a truncated field', () => {
    const reader = new MqttReader(new Uint8Array([0x00, 0x05, 0x01]));
    expect(() => reader.binary()).toThrow('Truncated packet.');
  });
});

describe('reader windows', () => {
  it('rest() consumes to the end', () => {
    const reader = new MqttReader(new Uint8Array([1, 2, 3]));
    reader.byte();
    expect([...reader.rest()]).toEqual([2, 3]);
    expect(reader.atEnd).toBe(true);
    expect(reader.rest().byteLength).toBe(0);
  });

  it('grows the writer past its initial buffer', () => {
    const writer = new MqttWriter();
    const big = new Uint8Array(10_000).fill(7);
    writer.raw(big);
    expect(writer.finish()).toEqual(big);
  });
});
