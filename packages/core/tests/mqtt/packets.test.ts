import { describe, expect, it } from 'vitest';
import {
  decodeMqttPacket,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttProtocolVersion,
} from '../../src/mqtt';

const V4 = MQTT_PROTOCOL_VERSIONS.v311;
const V5 = MQTT_PROTOCOL_VERSIONS.v5;

const text = (value: string): number[] => [
  value.length >> 8,
  value.length & 0xff,
  ...[...value].map((c) => c.charCodeAt(0)),
];

function encodeOk(packet: MqttPacket, version: MqttProtocolVersion): Uint8Array {
  const result = encodeMqttPacket(packet, version);
  if (!result.ok) throw new Error(`encode failed: ${result.error}`);
  return result.bytes;
}

function encodeError(packet: MqttPacket, version: MqttProtocolVersion): string {
  const result = encodeMqttPacket(packet, version);
  if (result.ok) throw new Error('encode unexpectedly succeeded');
  return result.error;
}

function reDecode(packet: MqttPacket, version: MqttProtocolVersion): MqttPacket {
  const decoded = decodeMqttPacket(encodeOk(packet, version), version);
  if (!decoded.ok) throw new Error(`decode failed: ${decoded.error}`);
  return decoded.packet;
}

function decodeError(bytes: number[], version: MqttProtocolVersion): string {
  const decoded = decodeMqttPacket(new Uint8Array(bytes), version);
  if (decoded.ok) throw new Error('decode unexpectedly succeeded');
  return decoded.error;
}

describe('pinned wire vectors', () => {
  it('encodes the canonical 3.1.1 CONNECT', () => {
    const bytes = encodeOk({ type: 'connect', clientId: 'oh', cleanStart: true, keepAlive: 60 }, V4);
    expect([...bytes]).toEqual([0x10, 14, ...text('MQTT'), 4, 0x02, 0, 60, ...text('oh')]);
  });

  it('encodes a QoS 0 3.1.1 PUBLISH with no packet identifier', () => {
    const bytes = encodeOk(
      {
        type: 'publish',
        topic: 'a/b',
        payload: new Uint8Array([0x68, 0x69]),
        qos: 0,
        retain: false,
        dup: false,
        packetId: null,
      },
      V4,
    );
    expect([...bytes]).toEqual([0x30, 7, ...text('a/b'), 0x68, 0x69]);
  });

  it('encodes PINGREQ and PINGRESP as bare fixed headers', () => {
    expect([...encodeOk({ type: 'pingreq' }, V5)]).toEqual([0xc0, 0]);
    expect([...encodeOk({ type: 'pingresp' }, V4)]).toEqual([0xd0, 0]);
  });

  it('encodes a 5.0 DISCONNECT reason with an empty property block', () => {
    expect([...encodeOk({ type: 'disconnect', reasonCode: 0x04 }, V5)]).toEqual([0xe0, 2, 0x04, 0]);
  });

  it('encodes a 5.0 SUBSCRIBE with retain handling in the options byte', () => {
    const bytes = encodeOk(
      { type: 'subscribe', packetId: 10, subscriptions: [{ topicFilter: 'a/+', qos: 1, retainHandling: 1 }] },
      V5,
    );
    expect([...bytes]).toEqual([0x82, 9, 0, 10, 0, ...text('a/+'), 0x11]);
  });

  it('carries the mandatory 0x02 flags on PUBREL', () => {
    const bytes = encodeOk({ type: 'pubrel', packetId: 7, reasonCode: null }, V4);
    expect([...bytes]).toEqual([0x62, 2, 0, 7]);
  });

  it('uses the short ack form when reason is 0 with no properties', () => {
    expect([...encodeOk({ type: 'puback', packetId: 9, reasonCode: 0 }, V5)]).toEqual([0x40, 2, 0, 9]);
    expect([...encodeOk({ type: 'disconnect', reasonCode: 0 }, V5)]).toEqual([0xe0, 0]);
    expect([...encodeOk({ type: 'auth', reasonCode: 0 }, V5)]).toEqual([0xf0, 0]);
  });
});

describe('5.0 round-trips', () => {
  it('round-trips a fully loaded CONNECT', () => {
    const decoded = reDecode(
      {
        type: 'connect',
        clientId: 'oh-client',
        cleanStart: false,
        keepAlive: 30,
        username: 'john.doe',
        password: new Uint8Array([1, 2, 3]),
        will: {
          topic: 'status/oh-client',
          payload: new Uint8Array([0x7b, 0x7d]),
          qos: 2,
          retain: true,
          properties: { willDelayInterval: 5, userProperties: [{ key: 'via', value: 'test' }] },
        },
        properties: { sessionExpiryInterval: 300, receiveMaximum: 20, maximumPacketSize: 4096 },
      },
      V5,
    );
    expect(decoded).toEqual({
      type: 'connect',
      clientId: 'oh-client',
      cleanStart: false,
      keepAlive: 30,
      username: 'john.doe',
      password: new Uint8Array([1, 2, 3]),
      will: {
        topic: 'status/oh-client',
        payload: new Uint8Array([0x7b, 0x7d]),
        qos: 2,
        retain: true,
        properties: { willDelayInterval: 5, userProperties: [{ key: 'via', value: 'test' }] },
      },
      properties: { sessionExpiryInterval: 300, receiveMaximum: 20, maximumPacketSize: 4096 },
    });
  });

  it('round-trips CONNACK with broker capability properties', () => {
    const packet: MqttPacket = {
      type: 'connack',
      sessionPresent: true,
      reasonCode: 0,
      properties: {
        assignedClientId: 'oh-assigned',
        serverKeepAlive: 45,
        maximumQos: 1,
        retainAvailable: 1,
        topicAliasMaximum: 8,
        wildcardSubscriptionAvailable: 1,
        subscriptionIdentifierAvailable: 1,
        sharedSubscriptionAvailable: 0,
        serverReference: 'broker2.openheaders.io',
        reasonString: 'welcome',
      },
    };
    expect(reDecode(packet, V5)).toEqual(packet);
  });

  it('round-trips a QoS 1 PUBLISH with per-message properties', () => {
    const packet: MqttPacket = {
      type: 'publish',
      topic: 'sensors/temp',
      payload: new Uint8Array([0x31, 0x38]),
      qos: 1,
      retain: true,
      dup: false,
      packetId: 42,
      properties: {
        payloadFormatIndicator: 1,
        messageExpiryInterval: 60,
        contentType: 'text/plain',
        responseTopic: 'replies/temp',
        correlationData: new Uint8Array([9, 9]),
        topicAlias: 2,
        userProperties: [{ key: 'unit', value: 'C' }],
      },
    };
    expect(reDecode(packet, V5)).toEqual(packet);
  });

  it('round-trips a QoS 2 PUBLISH with the DUP flag', () => {
    const packet: MqttPacket = {
      type: 'publish',
      topic: 't',
      payload: new Uint8Array(0),
      qos: 2,
      retain: false,
      dup: true,
      packetId: 0xffff,
      properties: {},
    };
    expect(reDecode(packet, V5)).toEqual(packet);
  });

  it('round-trips every QoS ack type with a reason and reason string', () => {
    for (const type of ['puback', 'pubrec', 'pubrel', 'pubcomp'] as const) {
      const packet: MqttPacket = {
        type,
        packetId: 5,
        reasonCode: 0x92,
        properties: { reasonString: 'Packet Identifier not found' },
      };
      expect(reDecode(packet, V5)).toEqual(packet);
    }
  });

  it('decodes the short ack form to reason 0 without properties', () => {
    expect(reDecode({ type: 'pubrec', packetId: 3, reasonCode: 0 }, V5)).toEqual({
      type: 'pubrec',
      packetId: 3,
      reasonCode: 0,
    });
  });

  it('round-trips SUBSCRIBE option combinations and a subscription identifier', () => {
    const packet: MqttPacket = {
      type: 'subscribe',
      packetId: 11,
      subscriptions: [
        { topicFilter: 'a/#', qos: 0, noLocal: false, retainAsPublished: false, retainHandling: 0 },
        { topicFilter: '+/b', qos: 1, noLocal: true, retainAsPublished: false, retainHandling: 1 },
        { topicFilter: 'c', qos: 2, noLocal: true, retainAsPublished: true, retainHandling: 2 },
      ],
      properties: { subscriptionIdentifiers: [7] },
    };
    expect(reDecode(packet, V5)).toEqual(packet);
  });

  it('round-trips SUBACK grants verbatim, failures included', () => {
    const packet: MqttPacket = { type: 'suback', packetId: 11, reasonCodes: [0, 1, 2, 0x80], properties: {} };
    expect(reDecode(packet, V5)).toEqual(packet);
  });

  it('round-trips UNSUBSCRIBE and UNSUBACK', () => {
    const unsubscribe: MqttPacket = { type: 'unsubscribe', packetId: 12, topicFilters: ['a/#', 'b'], properties: {} };
    expect(reDecode(unsubscribe, V5)).toEqual(unsubscribe);
    const unsuback: MqttPacket = { type: 'unsuback', packetId: 12, reasonCodes: [0, 0x11], properties: {} };
    expect(reDecode(unsuback, V5)).toEqual(unsuback);
  });

  it('round-trips DISCONNECT with a reason and session expiry', () => {
    const packet: MqttPacket = {
      type: 'disconnect',
      reasonCode: 0x8e,
      properties: { sessionExpiryInterval: 0, reasonString: 'Session taken over' },
    };
    expect(reDecode(packet, V5)).toEqual(packet);
    expect(reDecode({ type: 'disconnect', reasonCode: 0 }, V5)).toEqual({ type: 'disconnect', reasonCode: 0 });
  });

  it('round-trips AUTH with method and data', () => {
    const packet: MqttPacket = {
      type: 'auth',
      reasonCode: 0x18,
      properties: { authenticationMethod: 'SCRAM-SHA-1', authenticationData: new Uint8Array([4, 5]) },
    };
    expect(reDecode(packet, V5)).toEqual(packet);
  });
});

describe('3.1.1 round-trips', () => {
  it('round-trips CONNECT with will and credentials, no property blocks', () => {
    const packet: MqttPacket = {
      type: 'connect',
      clientId: 'oh',
      cleanStart: true,
      keepAlive: 10,
      username: 'john.doe',
      password: new Uint8Array([7]),
      will: { topic: 'gone', payload: new Uint8Array([1]), qos: 1, retain: false },
    };
    expect(reDecode(packet, V4)).toEqual(packet);
  });

  it('round-trips CONNACK return codes in the 3.1.1 space', () => {
    const packet: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 5 };
    expect(reDecode(packet, V4)).toEqual(packet);
  });

  it('round-trips acks and DISCONNECT with reasonCode null', () => {
    expect(reDecode({ type: 'puback', packetId: 2, reasonCode: null }, V4)).toEqual({
      type: 'puback',
      packetId: 2,
      reasonCode: null,
    });
    expect(reDecode({ type: 'disconnect', reasonCode: null }, V4)).toEqual({ type: 'disconnect', reasonCode: null });
  });

  it('round-trips SUBSCRIBE as bare QoS options', () => {
    const packet: MqttPacket = {
      type: 'subscribe',
      packetId: 3,
      subscriptions: [
        { topicFilter: 'a/+', qos: 1 },
        { topicFilter: '#', qos: 0 },
      ],
    };
    expect(reDecode(packet, V4)).toEqual(packet);
  });

  it('round-trips the code-less 3.1.1 UNSUBACK', () => {
    expect(reDecode({ type: 'unsuback', packetId: 4, reasonCodes: [] }, V4)).toEqual({
      type: 'unsuback',
      packetId: 4,
      reasonCodes: [],
    });
  });

  it('decodes a wire-level-4 CONNECT self-describingly under either version knob', () => {
    const bytes = encodeOk({ type: 'connect', clientId: 'oh', cleanStart: true, keepAlive: 60 }, V4);
    const decoded = decodeMqttPacket(bytes, V5);
    expect(decoded.ok && decoded.packet.type === 'connect' && decoded.packet.clientId).toBe('oh');
  });
});

describe('3.1.1 encode honesty — reported, never dropped', () => {
  it('rejects properties on every packet family', () => {
    expect(
      encodeError(
        { type: 'connect', clientId: 'a', cleanStart: true, keepAlive: 0, properties: { receiveMaximum: 1 } },
        V4,
      ),
    ).toContain('MQTT 3.1.1 carries no properties');
    expect(
      encodeError(
        {
          type: 'publish',
          topic: 't',
          payload: new Uint8Array(0),
          qos: 0,
          retain: false,
          dup: false,
          packetId: null,
          properties: { contentType: 'text/plain' },
        },
        V4,
      ),
    ).toContain('MQTT 3.1.1 carries no properties');
    expect(
      encodeError(
        {
          type: 'subscribe',
          packetId: 1,
          subscriptions: [{ topicFilter: 'a', qos: 0 }],
          properties: { subscriptionIdentifiers: [1] },
        },
        V4,
      ),
    ).toContain('MQTT 3.1.1 carries no properties');
  });

  it('rejects will properties', () => {
    expect(
      encodeError(
        {
          type: 'connect',
          clientId: 'a',
          cleanStart: true,
          keepAlive: 0,
          will: { topic: 'w', payload: new Uint8Array(0), qos: 0, retain: false, properties: { willDelayInterval: 1 } },
        },
        V4,
      ),
    ).toContain('MQTT 3.1.1 carries no properties');
  });

  it('rejects reason codes the 3.1.1 wire cannot carry', () => {
    expect(encodeError({ type: 'puback', packetId: 1, reasonCode: 0x92 }, V4)).toBe(
      'MQTT 3.1.1 acks carry no reason code.',
    );
    expect(encodeError({ type: 'disconnect', reasonCode: 0x04 }, V4)).toBe(
      'MQTT 3.1.1 DISCONNECT carries no reason code.',
    );
    expect(encodeError({ type: 'unsuback', packetId: 1, reasonCodes: [0] }, V4)).toBe(
      'MQTT 3.1.1 UNSUBACK carries no reason codes.',
    );
  });

  it('rejects AUTH outright', () => {
    expect(encodeError({ type: 'auth', reasonCode: 0 }, V4)).toBe('AUTH is MQTT 5.0 only.');
  });

  it('rejects 5.0 subscription options', () => {
    expect(
      encodeError({ type: 'subscribe', packetId: 1, subscriptions: [{ topicFilter: 'a', qos: 0, noLocal: true }] }, V4),
    ).toBe('MQTT 3.1.1 subscriptions carry no 5.0 subscription options.');
    expect(
      encodeError(
        { type: 'subscribe', packetId: 1, subscriptions: [{ topicFilter: 'a', qos: 0, retainHandling: 2 }] },
        V4,
      ),
    ).toBe('MQTT 3.1.1 subscriptions carry no 5.0 subscription options.');
  });

  it('rejects an empty client id on a persistent session', () => {
    expect(encodeError({ type: 'connect', clientId: '', cleanStart: false, keepAlive: 0 }, V4)).toBe(
      'MQTT 3.1.1 requires a clean session when the client id is empty.',
    );
  });

  it('rejects a password without a username', () => {
    expect(
      encodeError(
        { type: 'connect', clientId: 'a', cleanStart: true, keepAlive: 0, password: new Uint8Array([1]) },
        V4,
      ),
    ).toBe('MQTT 3.1.1 cannot carry a password without a username.');
  });
});

describe('encode validation', () => {
  it('rejects illegal topics and filters', () => {
    expect(
      encodeError(
        {
          type: 'publish',
          topic: 'a/+',
          payload: new Uint8Array(0),
          qos: 0,
          retain: false,
          dup: false,
          packetId: null,
        },
        V5,
      ),
    ).toBe('Topic: Topic names cannot contain wildcards.');
    expect(encodeError({ type: 'subscribe', packetId: 1, subscriptions: [{ topicFilter: 'a/#/b', qos: 0 }] }, V5)).toBe(
      'Topic filter: "#" is only legal as the last topic level.',
    );
    expect(encodeError({ type: 'unsubscribe', packetId: 1, topicFilters: [''] }, V5)).toBe(
      'Topic filter: Topic filter is empty.',
    );
  });

  it('rejects packet-identifier misuse across the QoS split', () => {
    expect(
      encodeError(
        { type: 'publish', topic: 't', payload: new Uint8Array(0), qos: 1, retain: false, dup: false, packetId: null },
        V5,
      ),
    ).toBe('A QoS 1 publish needs a packet identifier.');
    expect(
      encodeError(
        { type: 'publish', topic: 't', payload: new Uint8Array(0), qos: 0, retain: false, dup: false, packetId: 5 },
        V5,
      ),
    ).toBe('A QoS 0 publish carries no packet identifier.');
    expect(
      encodeError(
        { type: 'publish', topic: 't', payload: new Uint8Array(0), qos: 0, retain: false, dup: true, packetId: null },
        V5,
      ),
    ).toBe('DUP must be 0 on a QoS 0 publish.');
    expect(
      encodeError(
        { type: 'publish', topic: 't', payload: new Uint8Array(0), qos: 2, retain: false, dup: false, packetId: 0 },
        V5,
      ),
    ).toBe('Packet identifier out of range on PUBLISH: 0.');
    expect(encodeError({ type: 'suback', packetId: 0x1_0000, reasonCodes: [0] }, V5)).toBe(
      'Packet identifier out of range on SUBACK: 65536.',
    );
  });

  it('rejects empty row lists', () => {
    expect(encodeError({ type: 'subscribe', packetId: 1, subscriptions: [] }, V5)).toBe(
      'SUBSCRIBE needs at least one topic filter.',
    );
    expect(encodeError({ type: 'unsubscribe', packetId: 1, topicFilters: [] }, V5)).toBe(
      'UNSUBSCRIBE needs at least one topic filter.',
    );
    expect(encodeError({ type: 'suback', packetId: 1, reasonCodes: [] }, V5)).toBe(
      'SUBACK needs at least one reason code.',
    );
  });
});

describe('decode malformed packets', () => {
  it('rejects a remaining length that disagrees with the buffer', () => {
    expect(decodeError([0xc0, 1], V5)).toBe('Remaining length says 1 bytes but 0 follow the header.');
    expect(decodeError([0xc0, 0, 0xff], V5)).toBe('Remaining length says 0 bytes but 1 follow the header.');
  });

  it('rejects the forbidden type nibble 0', () => {
    expect(decodeError([0x00, 0], V5)).toBe('Unknown packet type 0.');
  });

  it('rejects wrong fixed-header flags', () => {
    expect(decodeError([0x11, 0], V5)).toBe('CONNECT fixed-header flags must be 0x0.');
    expect(decodeError([0x60, 2, 0, 1], V5)).toBe('PUBREL fixed-header flags must be 0x2.');
    expect(decodeError([0x80, 2, 0, 1], V5)).toBe('SUBSCRIBE fixed-header flags must be 0x2.');
    expect(decodeError([0xc1, 0], V5)).toBe('PINGREQ fixed-header flags must be 0x0.');
  });

  it('rejects QoS 3 on the PUBLISH flags', () => {
    expect(decodeError([0x36, 5, 0, 1, 0x61, 0, 0], V5)).toBe('PUBLISH QoS 3 is not a legal QoS.');
  });

  it('rejects CONNECT header violations', () => {
    const base = [...text('MQTT'), 4];
    expect(decodeError([0x10, base.length + 3, ...base, 0x03, 0, 0], V5)).toBe('CONNECT reserved flag bit is set.');
    expect(decodeError([0x10, base.length + 3, ...base, 0x20, 0, 0], V5)).toBe('Will flags are set without a will.');
    expect(decodeError([0x10, 9, ...text('MQIsdp'), 3], V5)).toBe('Unknown protocol name "MQIsdp".');
    expect(decodeError([0x10, base.length + 3, ...text('MQTT'), 3, 0x02, 0, 0], V5)).toBe(
      'Unsupported protocol level 3.',
    );
  });

  it('rejects trailing bytes after a complete body', () => {
    expect(decodeError([0x20, 3, 0, 0, 0xff], V4)).toBe('Packet body has trailing bytes.');
  });

  it('rejects a truncated body', () => {
    expect(decodeError([0x20, 1, 0], V4)).toBe('Truncated packet.');
  });

  it('rejects an unknown property inside a 5.0 packet', () => {
    expect(decodeError([0xe0, 4, 0x00, 2, 0x7f, 0], V5)).toBe('Unknown property identifier 0x7f.');
  });

  it('rejects AUTH under the 3.1.1 knob', () => {
    expect(decodeError([0xf0, 0], V4)).toBe('AUTH is MQTT 5.0 only.');
  });

  it('rejects 5.0 option bits under the 3.1.1 knob', () => {
    expect(decodeError([0x82, 6, 0, 1, ...text('a'), 0x04], V4)).toBe(
      'MQTT 3.1.1 subscription options carry only a QoS.',
    );
  });

  it('rejects subscription option reserved bits under 5.0', () => {
    expect(decodeError([0x82, 7, 0, 1, 0, ...text('a'), 0x40], V5)).toBe('Subscription option reserved bits are set.');
  });

  it('rejects empty SUBSCRIBE and UNSUBSCRIBE payloads', () => {
    expect(decodeError([0x82, 3, 0, 1, 0], V5)).toBe('SUBSCRIBE carries no topic filters.');
    expect(decodeError([0xa2, 3, 0, 1, 0], V5)).toBe('UNSUBSCRIBE carries no topic filters.');
    expect(decodeError([0x90, 3, 0, 1, 0], V5)).toBe('SUBACK carries no reason codes.');
  });

  it('rejects a 3.1.1 DISCONNECT with a body', () => {
    expect(decodeError([0xe0, 1, 0], V4)).toBe('MQTT 3.1.1 DISCONNECT carries no body.');
  });
});
