import { describe, expect, it } from 'vitest';
import {
  createMqttStreamDecoder,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttStreamEvent,
} from '../../src/mqtt';

const V5 = MQTT_PROTOCOL_VERSIONS.v5;

function bytesOf(packet: MqttPacket): Uint8Array {
  const result = encodeMqttPacket(packet, V5);
  if (!result.ok) throw new Error(result.error);
  return result.bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.byteLength;
  }
  return joined;
}

const CONNACK: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 0, properties: {} };
const PUBLISH: MqttPacket = {
  type: 'publish',
  topic: 'sensors/temp',
  payload: new Uint8Array([0x31, 0x38]),
  qos: 0,
  retain: false,
  dup: false,
  packetId: null,
  properties: {},
};

function okPackets(events: MqttStreamEvent[]): MqttPacket[] {
  return events.flatMap((event) => (event.ok ? [event.packet] : []));
}

describe('createMqttStreamDecoder', () => {
  it('decodes several packets from one chunk and reports wire sizes', () => {
    const decoder = createMqttStreamDecoder(V5);
    const connackBytes = bytesOf(CONNACK);
    const publishBytes = bytesOf(PUBLISH);
    const events = decoder.push(concat(connackBytes, publishBytes));
    expect(events).toHaveLength(2);
    expect(okPackets(events)).toEqual([CONNACK, PUBLISH]);
    expect(events.flatMap((event) => (event.ok ? [event.wireBytes] : []))).toEqual([
      connackBytes.byteLength,
      publishBytes.byteLength,
    ]);
    // Remaining Length is the observed fixed-header varint — the frame
    // minus the type byte and the length bytes themselves (single-byte
    // varints at these sizes).
    expect(events.flatMap((event) => (event.ok ? [event.remainingLength] : []))).toEqual([
      connackBytes.byteLength - 2,
      publishBytes.byteLength - 2,
    ]);
    expect(decoder.pendingBytes()).toBe(0);
  });

  it('reassembles packets fed one byte at a time', () => {
    const decoder = createMqttStreamDecoder(V5);
    const wire = concat(bytesOf(CONNACK), bytesOf(PUBLISH), bytesOf({ type: 'pingresp' }));
    const collected: MqttPacket[] = [];
    for (const byte of wire) {
      collected.push(...okPackets(decoder.push(new Uint8Array([byte]))));
    }
    expect(collected).toEqual([CONNACK, PUBLISH, { type: 'pingresp' }]);
    expect(decoder.pendingBytes()).toBe(0);
  });

  it('carries a split inside the remaining-length varint itself', () => {
    const big: MqttPacket = {
      ...PUBLISH,
      payload: new Uint8Array(200).fill(0x41),
    };
    const wire = bytesOf(big);
    expect(wire[1] & 0x80).not.toBe(0);
    const decoder = createMqttStreamDecoder(V5);
    expect(decoder.push(wire.subarray(0, 2))).toEqual([]);
    expect(decoder.pendingBytes()).toBe(2);
    const events = decoder.push(wire.subarray(2));
    expect(okPackets(events)).toEqual([big]);
  });

  it('survives a malformed body and resynchronizes at the next packet', () => {
    const decoder = createMqttStreamDecoder(V5);
    // A CONNACK whose reserved ack-flag bits are set — framed fine, body malformed.
    const bad = new Uint8Array([0x20, 3, 0xff, 0x00, 0x00]);
    const events = decoder.push(concat(bad, bytesOf(PUBLISH)));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ ok: false, error: 'CONNACK reserved flag bits are set.', fatal: false });
    expect(okPackets(events)).toEqual([PUBLISH]);
  });

  it('poisons the stream on a varint past 4 bytes', () => {
    const decoder = createMqttStreamDecoder(V5);
    const events = decoder.push(new Uint8Array([0x30, 0x80, 0x80, 0x80, 0x80, 0x01]));
    expect(events).toEqual([{ ok: false, error: 'Remaining length varint exceeds 4 bytes.', fatal: true }]);
    expect(decoder.push(bytesOf(CONNACK))).toEqual([]);
  });

  it('poisons the stream on the forbidden type nibble 0', () => {
    const decoder = createMqttStreamDecoder(V5);
    const events = decoder.push(new Uint8Array([0x00, 0x00]));
    expect(events).toEqual([{ ok: false, error: 'Unknown packet type 0.', fatal: true }]);
    expect(decoder.push(bytesOf(CONNACK))).toEqual([]);
  });

  it('poisons the stream past the packet-size ceiling', () => {
    const decoder = createMqttStreamDecoder(V5, { maxPacketBytes: 64 });
    const oversized = bytesOf({ ...PUBLISH, payload: new Uint8Array(100) });
    const events = decoder.push(oversized);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(!event.ok && event.fatal).toBe(true);
    expect(!event.ok && event.error).toContain('exceeds the 64 byte ceiling');
  });

  it('waits without events while a packet is incomplete', () => {
    const decoder = createMqttStreamDecoder(V5);
    const wire = bytesOf(PUBLISH);
    expect(decoder.push(wire.subarray(0, wire.byteLength - 1))).toEqual([]);
    expect(decoder.pendingBytes()).toBe(wire.byteLength - 1);
    expect(okPackets(decoder.push(wire.subarray(wire.byteLength - 1)))).toEqual([PUBLISH]);
  });

  it('owns its payload copies — mutating the pushed chunk changes nothing', () => {
    const decoder = createMqttStreamDecoder(V5);
    const wire = bytesOf(PUBLISH);
    const events = decoder.push(wire);
    wire.fill(0);
    const packet = okPackets(events)[0];
    expect(packet.type === 'publish' && [...packet.payload]).toEqual([0x31, 0x38]);
  });
});
