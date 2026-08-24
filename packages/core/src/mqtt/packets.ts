/**
 * MQTT packet grammar — the control-packet codec over the wire
 * primitives: every packet type of MQTT 5.0 with the 3.1.1 leg as a
 * version knob (protocol level 4), pure data in, pure data out. The
 * session driver encodes with it, display surfaces decode captured
 * packets with it, and the incremental stream decoder shares its body
 * grammar — one module, so the framing rules never fork.
 *
 * Posture: encode-strict, decode-tolerant. Encode validates the model
 * against the TARGET version (a 3.1.1 packet cannot carry properties
 * or reason codes — reported, never dropped silently) and reports
 * failures as results, never throws. Decode records what the wire
 * said verbatim and errors only on the spec's Malformed Packet
 * conditions — bad reserved bits, truncation, unknown properties —
 * so a captured packet always renders honestly or names why not.
 */
import { decodeProperties, encodeProperties, hasProperties, type MqttProperties } from './properties';
import { topicFilterError, topicNameError } from './topic';
import { MqttCodecError, MqttReader, MqttWriter } from './wire';

/** Protocol level byte the version knob dials: 3.1.1 = 4, 5.0 = 5. */
export const MQTT_PROTOCOL_VERSIONS = { v311: 4, v5: 5 } as const;

export type MqttProtocolVersion = (typeof MQTT_PROTOCOL_VERSIONS)[keyof typeof MQTT_PROTOCOL_VERSIONS];

/** Control-packet type nibbles (fixed-header bits 7–4). */
export const MQTT_PACKET_TYPES = {
  connect: 1,
  connack: 2,
  publish: 3,
  puback: 4,
  pubrec: 5,
  pubrel: 6,
  pubcomp: 7,
  subscribe: 8,
  suback: 9,
  unsubscribe: 10,
  unsuback: 11,
  pingreq: 12,
  pingresp: 13,
  disconnect: 14,
  auth: 15,
} as const;

export type MqttQos = 0 | 1 | 2;

/** The will message a CONNECT registers with the broker. */
export interface MqttWill {
  topic: string;
  payload: Uint8Array;
  qos: MqttQos;
  retain: boolean;
  /** 5.0 will properties (will delay interval lives here). */
  properties?: MqttProperties;
}

export interface MqttConnectPacket {
  type: 'connect';
  clientId: string;
  cleanStart: boolean;
  /** Seconds; 0 disables the keep-alive contract. */
  keepAlive: number;
  username?: string;
  password?: Uint8Array;
  will?: MqttWill;
  properties?: MqttProperties;
}

export interface MqttConnackPacket {
  type: 'connack';
  sessionPresent: boolean;
  /** 5.0 reason code, or the 3.1.1 return code (0–5) — the version
   *  scopes the numeric space. */
  reasonCode: number;
  properties?: MqttProperties;
}

export interface MqttPublishPacket {
  type: 'publish';
  topic: string;
  payload: Uint8Array;
  qos: MqttQos;
  retain: boolean;
  dup: boolean;
  /** Non-null exactly when QoS > 0. */
  packetId: number | null;
  properties?: MqttProperties;
}

/** PUBACK / PUBREC / PUBREL / PUBCOMP — the QoS 1/2 ack family.
 *  `reasonCode` null = the 3.1.1 wire, which carries none. */
export interface MqttPubAckLikePacket {
  type: 'puback' | 'pubrec' | 'pubrel' | 'pubcomp';
  packetId: number;
  reasonCode: number | null;
  properties?: MqttProperties;
}

/** One SUBSCRIBE row. The three option flags and `retainHandling` are
 *  5.0-only; 3.1.1 encode rejects non-default values (disabled-honest,
 *  never dropped). */
export interface MqttSubscription {
  topicFilter: string;
  qos: MqttQos;
  noLocal?: boolean;
  retainAsPublished?: boolean;
  retainHandling?: 0 | 1 | 2;
}

export interface MqttSubscribePacket {
  type: 'subscribe';
  packetId: number;
  subscriptions: MqttSubscription[];
  properties?: MqttProperties;
}

export interface MqttSubackPacket {
  type: 'suback';
  packetId: number;
  /** Per-row grants verbatim: granted QoS or the failure code. */
  reasonCodes: number[];
  properties?: MqttProperties;
}

export interface MqttUnsubscribePacket {
  type: 'unsubscribe';
  packetId: number;
  topicFilters: string[];
  properties?: MqttProperties;
}

export interface MqttUnsubackPacket {
  type: 'unsuback';
  packetId: number;
  /** Empty on the 3.1.1 wire — it acknowledges without codes. */
  reasonCodes: number[];
  properties?: MqttProperties;
}

export interface MqttPingreqPacket {
  type: 'pingreq';
}

export interface MqttPingrespPacket {
  type: 'pingresp';
}

/** `reasonCode` null = the 3.1.1 wire (a bare DISCONNECT). */
export interface MqttDisconnectPacket {
  type: 'disconnect';
  reasonCode: number | null;
  properties?: MqttProperties;
}

/** 5.0 only — decode under 3.1.1 reports the honest error. */
export interface MqttAuthPacket {
  type: 'auth';
  reasonCode: number;
  properties?: MqttProperties;
}

export type MqttPacket =
  | MqttConnectPacket
  | MqttConnackPacket
  | MqttPublishPacket
  | MqttPubAckLikePacket
  | MqttSubscribePacket
  | MqttSubackPacket
  | MqttUnsubscribePacket
  | MqttUnsubackPacket
  | MqttPingreqPacket
  | MqttPingrespPacket
  | MqttDisconnectPacket
  | MqttAuthPacket;

export type MqttEncodeResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string };

export type MqttDecodeResult = { ok: true; packet: MqttPacket } | { ok: false; error: string };

const ACK_TYPE_NIBBLES = {
  puback: MQTT_PACKET_TYPES.puback,
  pubrec: MQTT_PACKET_TYPES.pubrec,
  pubrel: MQTT_PACKET_TYPES.pubrel,
  pubcomp: MQTT_PACKET_TYPES.pubcomp,
} as const;

function assertNoProperties(properties: MqttProperties | undefined, where: string): void {
  if (hasProperties(properties)) throw new MqttCodecError(`MQTT 3.1.1 carries no properties (${where}).`);
}

function assertPacketId(packetId: number, where: string): void {
  if (!Number.isInteger(packetId) || packetId < 1 || packetId > 0xffff) {
    throw new MqttCodecError(`Packet identifier out of range on ${where}: ${packetId}.`);
  }
}

function assertTopicName(topic: string, where: string): void {
  const error = topicNameError(topic);
  if (error !== null) throw new MqttCodecError(`${where}: ${error}`);
}

function assertTopicFilter(filter: string, where: string): void {
  const error = topicFilterError(filter);
  if (error !== null) throw new MqttCodecError(`${where}: ${error}`);
}

function legalQos(value: number, where: string): MqttQos {
  if (value === 0 || value === 1 || value === 2) return value;
  throw new MqttCodecError(`${where} QoS ${value} is not a legal QoS.`);
}

function legalRetainHandling(value: number): 0 | 1 | 2 {
  if (value === 0 || value === 1 || value === 2) return value;
  throw new MqttCodecError(`Retain handling ${value} is not a legal value.`);
}

function encodeConnect(body: MqttWriter, packet: MqttConnectPacket, version: MqttProtocolVersion): void {
  const will = packet.will;
  if (version === MQTT_PROTOCOL_VERSIONS.v311) {
    assertNoProperties(packet.properties, 'CONNECT');
    if (will !== undefined) assertNoProperties(will.properties, 'the will');
    if (packet.clientId === '' && !packet.cleanStart) {
      throw new MqttCodecError('MQTT 3.1.1 requires a clean session when the client id is empty.');
    }
    if (packet.password !== undefined && packet.username === undefined) {
      throw new MqttCodecError('MQTT 3.1.1 cannot carry a password without a username.');
    }
  }
  if (will !== undefined) assertTopicName(will.topic, 'Will topic');

  body.utf8String('MQTT');
  body.byte(version);
  let flags = 0;
  if (packet.cleanStart) flags |= 0x02;
  if (will !== undefined) flags |= 0x04 | (will.qos << 3) | (will.retain ? 0x20 : 0);
  if (packet.password !== undefined) flags |= 0x40;
  if (packet.username !== undefined) flags |= 0x80;
  body.byte(flags);
  body.twoByteInt(packet.keepAlive);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) encodeProperties(body, packet.properties);
  body.utf8String(packet.clientId);
  if (will !== undefined) {
    if (version === MQTT_PROTOCOL_VERSIONS.v5) encodeProperties(body, will.properties);
    body.utf8String(will.topic);
    body.binary(will.payload);
  }
  if (packet.username !== undefined) body.utf8String(packet.username);
  if (packet.password !== undefined) body.binary(packet.password);
}

function encodeConnack(body: MqttWriter, packet: MqttConnackPacket, version: MqttProtocolVersion): void {
  body.byte(packet.sessionPresent ? 0x01 : 0x00);
  body.byte(packet.reasonCode);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) {
    encodeProperties(body, packet.properties);
  } else {
    assertNoProperties(packet.properties, 'CONNACK');
  }
}

function encodePublish(body: MqttWriter, packet: MqttPublishPacket, version: MqttProtocolVersion): number {
  assertTopicName(packet.topic, 'Topic');
  if (packet.qos === 0) {
    if (packet.dup) throw new MqttCodecError('DUP must be 0 on a QoS 0 publish.');
    if (packet.packetId !== null) throw new MqttCodecError('A QoS 0 publish carries no packet identifier.');
  } else {
    if (packet.packetId === null) throw new MqttCodecError(`A QoS ${packet.qos} publish needs a packet identifier.`);
    assertPacketId(packet.packetId, 'PUBLISH');
  }
  body.utf8String(packet.topic);
  if (packet.packetId !== null) body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) {
    encodeProperties(body, packet.properties);
  } else {
    assertNoProperties(packet.properties, 'PUBLISH');
  }
  body.raw(packet.payload);
  return (packet.dup ? 0x08 : 0) | (packet.qos << 1) | (packet.retain ? 0x01 : 0);
}

function encodePubAckLike(body: MqttWriter, packet: MqttPubAckLikePacket, version: MqttProtocolVersion): void {
  assertPacketId(packet.packetId, packet.type.toUpperCase());
  body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v311) {
    assertNoProperties(packet.properties, packet.type.toUpperCase());
    if (packet.reasonCode !== null && packet.reasonCode !== 0) {
      throw new MqttCodecError('MQTT 3.1.1 acks carry no reason code.');
    }
    return;
  }
  const reasonCode = packet.reasonCode ?? 0;
  if (reasonCode === 0 && !hasProperties(packet.properties)) return;
  body.byte(reasonCode);
  encodeProperties(body, packet.properties);
}

function encodeSubscribe(body: MqttWriter, packet: MqttSubscribePacket, version: MqttProtocolVersion): void {
  assertPacketId(packet.packetId, 'SUBSCRIBE');
  if (packet.subscriptions.length === 0) throw new MqttCodecError('SUBSCRIBE needs at least one topic filter.');
  body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) {
    encodeProperties(body, packet.properties);
  } else {
    assertNoProperties(packet.properties, 'SUBSCRIBE');
  }
  for (const subscription of packet.subscriptions) {
    assertTopicFilter(subscription.topicFilter, 'Topic filter');
    const retainHandling = subscription.retainHandling ?? 0;
    if (version === MQTT_PROTOCOL_VERSIONS.v311) {
      if (subscription.noLocal === true || subscription.retainAsPublished === true || retainHandling !== 0) {
        throw new MqttCodecError('MQTT 3.1.1 subscriptions carry no 5.0 subscription options.');
      }
    }
    body.utf8String(subscription.topicFilter);
    body.byte(
      subscription.qos |
        (subscription.noLocal === true ? 0x04 : 0) |
        (subscription.retainAsPublished === true ? 0x08 : 0) |
        (retainHandling << 4),
    );
  }
}

function encodeSuback(body: MqttWriter, packet: MqttSubackPacket, version: MqttProtocolVersion): void {
  assertPacketId(packet.packetId, 'SUBACK');
  if (packet.reasonCodes.length === 0) throw new MqttCodecError('SUBACK needs at least one reason code.');
  body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) {
    encodeProperties(body, packet.properties);
  } else {
    assertNoProperties(packet.properties, 'SUBACK');
  }
  for (const code of packet.reasonCodes) body.byte(code);
}

function encodeUnsubscribe(body: MqttWriter, packet: MqttUnsubscribePacket, version: MqttProtocolVersion): void {
  assertPacketId(packet.packetId, 'UNSUBSCRIBE');
  if (packet.topicFilters.length === 0) throw new MqttCodecError('UNSUBSCRIBE needs at least one topic filter.');
  body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v5) {
    encodeProperties(body, packet.properties);
  } else {
    assertNoProperties(packet.properties, 'UNSUBSCRIBE');
  }
  for (const filter of packet.topicFilters) {
    assertTopicFilter(filter, 'Topic filter');
    body.utf8String(filter);
  }
}

function encodeUnsuback(body: MqttWriter, packet: MqttUnsubackPacket, version: MqttProtocolVersion): void {
  assertPacketId(packet.packetId, 'UNSUBACK');
  body.twoByteInt(packet.packetId);
  if (version === MQTT_PROTOCOL_VERSIONS.v311) {
    assertNoProperties(packet.properties, 'UNSUBACK');
    if (packet.reasonCodes.length > 0) throw new MqttCodecError('MQTT 3.1.1 UNSUBACK carries no reason codes.');
    return;
  }
  encodeProperties(body, packet.properties);
  for (const code of packet.reasonCodes) body.byte(code);
}

function encodeDisconnect(body: MqttWriter, packet: MqttDisconnectPacket, version: MqttProtocolVersion): void {
  if (version === MQTT_PROTOCOL_VERSIONS.v311) {
    assertNoProperties(packet.properties, 'DISCONNECT');
    if (packet.reasonCode !== null && packet.reasonCode !== 0) {
      throw new MqttCodecError('MQTT 3.1.1 DISCONNECT carries no reason code.');
    }
    return;
  }
  const reasonCode = packet.reasonCode ?? 0;
  if (reasonCode === 0 && !hasProperties(packet.properties)) return;
  body.byte(reasonCode);
  encodeProperties(body, packet.properties);
}

function encodeAuth(body: MqttWriter, packet: MqttAuthPacket, version: MqttProtocolVersion): void {
  if (version === MQTT_PROTOCOL_VERSIONS.v311) throw new MqttCodecError('AUTH is MQTT 5.0 only.');
  if (packet.reasonCode === 0 && !hasProperties(packet.properties)) return;
  body.byte(packet.reasonCode);
  encodeProperties(body, packet.properties);
}

/**
 * Encode one packet for the target protocol version. Reports instead
 * of throwing — a model the version cannot carry (properties on a
 * 3.1.1 packet, AUTH under 3.1.1, an invalid topic) fails alone, never
 * the session.
 */
export function encodeMqttPacket(packet: MqttPacket, version: MqttProtocolVersion): MqttEncodeResult {
  try {
    const body = new MqttWriter();
    let headerByte: number;
    switch (packet.type) {
      case 'connect':
        encodeConnect(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.connect << 4;
        break;
      case 'connack':
        encodeConnack(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.connack << 4;
        break;
      case 'publish':
        headerByte = (MQTT_PACKET_TYPES.publish << 4) | encodePublish(body, packet, version);
        break;
      case 'puback':
      case 'pubrec':
      case 'pubrel':
      case 'pubcomp':
        encodePubAckLike(body, packet, version);
        headerByte = (ACK_TYPE_NIBBLES[packet.type] << 4) | (packet.type === 'pubrel' ? 0x02 : 0);
        break;
      case 'subscribe':
        encodeSubscribe(body, packet, version);
        headerByte = (MQTT_PACKET_TYPES.subscribe << 4) | 0x02;
        break;
      case 'suback':
        encodeSuback(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.suback << 4;
        break;
      case 'unsubscribe':
        encodeUnsubscribe(body, packet, version);
        headerByte = (MQTT_PACKET_TYPES.unsubscribe << 4) | 0x02;
        break;
      case 'unsuback':
        encodeUnsuback(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.unsuback << 4;
        break;
      case 'pingreq':
        headerByte = MQTT_PACKET_TYPES.pingreq << 4;
        break;
      case 'pingresp':
        headerByte = MQTT_PACKET_TYPES.pingresp << 4;
        break;
      case 'disconnect':
        encodeDisconnect(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.disconnect << 4;
        break;
      case 'auth':
        encodeAuth(body, packet, version);
        headerByte = MQTT_PACKET_TYPES.auth << 4;
        break;
    }
    const frame = new MqttWriter();
    frame.byte(headerByte);
    frame.varint(body.size);
    frame.raw(body.finish());
    return { ok: true, bytes: frame.finish() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function decodeConnect(reader: MqttReader): MqttConnectPacket {
  const protocolName = reader.utf8String();
  if (protocolName !== 'MQTT') throw new MqttCodecError(`Unknown protocol name "${protocolName}".`);
  const level = reader.byte();
  if (level !== MQTT_PROTOCOL_VERSIONS.v311 && level !== MQTT_PROTOCOL_VERSIONS.v5) {
    throw new MqttCodecError(`Unsupported protocol level ${level}.`);
  }
  const flags = reader.byte();
  if ((flags & 0x01) !== 0) throw new MqttCodecError('CONNECT reserved flag bit is set.');
  const willFlag = (flags & 0x04) !== 0;
  const willQosBits = (flags >> 3) & 0x03;
  if (!willFlag && (willQosBits !== 0 || (flags & 0x20) !== 0)) {
    throw new MqttCodecError('Will flags are set without a will.');
  }
  const willQos = willFlag ? legalQos(willQosBits, 'Will') : 0;
  const keepAlive = reader.twoByteInt();
  const properties = level === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
  const clientId = reader.utf8String();
  let will: MqttWill | undefined;
  if (willFlag) {
    const willProperties = level === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
    const topic = reader.utf8String();
    const payload = reader.binary().slice();
    will = {
      topic,
      payload,
      qos: willQos,
      retain: (flags & 0x20) !== 0,
      ...(willProperties !== undefined ? { properties: willProperties } : {}),
    };
  }
  const username = (flags & 0x80) !== 0 ? reader.utf8String() : undefined;
  const password = (flags & 0x40) !== 0 ? reader.binary().slice() : undefined;
  if (level === MQTT_PROTOCOL_VERSIONS.v311 && password !== undefined && username === undefined) {
    throw new MqttCodecError('MQTT 3.1.1 cannot carry a password without a username.');
  }
  return {
    type: 'connect',
    clientId,
    cleanStart: (flags & 0x02) !== 0,
    keepAlive,
    ...(username !== undefined ? { username } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(will !== undefined ? { will } : {}),
    ...(properties !== undefined ? { properties } : {}),
  };
}

function decodeConnack(reader: MqttReader, version: MqttProtocolVersion): MqttConnackPacket {
  const ackFlags = reader.byte();
  if ((ackFlags & 0xfe) !== 0) throw new MqttCodecError('CONNACK reserved flag bits are set.');
  const reasonCode = reader.byte();
  // Read-tolerance: a 3.1.1-only broker refusing a 5.0 CONNECT answers
  // in 3.1.1 form — two bytes, no properties field (aedes does exactly
  // this, return code 0x01). Properties absent at end-of-body read as
  // none so the refusal reason surfaces VERBATIM instead of dying as a
  // malformed packet (the stock MQTT.js client tolerates it the same
  // way).
  const properties = version === MQTT_PROTOCOL_VERSIONS.v5 && !reader.atEnd ? decodeProperties(reader) : undefined;
  return {
    type: 'connack',
    sessionPresent: (ackFlags & 0x01) !== 0,
    reasonCode,
    ...(properties !== undefined ? { properties } : {}),
  };
}

function decodePublish(reader: MqttReader, flags: number, version: MqttProtocolVersion): MqttPublishPacket {
  const qos = legalQos((flags >> 1) & 0x03, 'PUBLISH');
  const topic = reader.utf8String();
  const packetId = qos > 0 ? reader.twoByteInt() : null;
  const properties = version === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
  return {
    type: 'publish',
    topic,
    payload: reader.rest(),
    qos,
    retain: (flags & 0x01) !== 0,
    dup: (flags & 0x08) !== 0,
    packetId,
    ...(properties !== undefined ? { properties } : {}),
  };
}

function decodePubAckLike(
  reader: MqttReader,
  type: MqttPubAckLikePacket['type'],
  version: MqttProtocolVersion,
): MqttPubAckLikePacket {
  const packetId = reader.twoByteInt();
  if (version === MQTT_PROTOCOL_VERSIONS.v311) return { type, packetId, reasonCode: null };
  if (reader.atEnd) return { type, packetId, reasonCode: 0 };
  const reasonCode = reader.byte();
  if (reader.atEnd) return { type, packetId, reasonCode };
  return { type, packetId, reasonCode, properties: decodeProperties(reader) };
}

function decodeSubscribe(reader: MqttReader, version: MqttProtocolVersion): MqttSubscribePacket {
  const packetId = reader.twoByteInt();
  const properties = version === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
  const subscriptions: MqttSubscription[] = [];
  while (!reader.atEnd) {
    const topicFilter = reader.utf8String();
    const options = reader.byte();
    const qos = legalQos(options & 0x03, 'Subscription');
    if ((options & 0xc0) !== 0) throw new MqttCodecError('Subscription option reserved bits are set.');
    if (version === MQTT_PROTOCOL_VERSIONS.v311 && (options & 0xfc) !== 0) {
      throw new MqttCodecError('MQTT 3.1.1 subscription options carry only a QoS.');
    }
    subscriptions.push({
      topicFilter,
      qos,
      ...(version === MQTT_PROTOCOL_VERSIONS.v5
        ? {
            noLocal: (options & 0x04) !== 0,
            retainAsPublished: (options & 0x08) !== 0,
            retainHandling: legalRetainHandling((options >> 4) & 0x03),
          }
        : {}),
    });
  }
  if (subscriptions.length === 0) throw new MqttCodecError('SUBSCRIBE carries no topic filters.');
  return { type: 'subscribe', packetId, subscriptions, ...(properties !== undefined ? { properties } : {}) };
}

function decodeSuback(reader: MqttReader, version: MqttProtocolVersion): MqttSubackPacket {
  const packetId = reader.twoByteInt();
  const properties = version === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
  const reasonCodes: number[] = [];
  while (!reader.atEnd) reasonCodes.push(reader.byte());
  if (reasonCodes.length === 0) throw new MqttCodecError('SUBACK carries no reason codes.');
  return { type: 'suback', packetId, reasonCodes, ...(properties !== undefined ? { properties } : {}) };
}

function decodeUnsubscribe(reader: MqttReader, version: MqttProtocolVersion): MqttUnsubscribePacket {
  const packetId = reader.twoByteInt();
  const properties = version === MQTT_PROTOCOL_VERSIONS.v5 ? decodeProperties(reader) : undefined;
  const topicFilters: string[] = [];
  while (!reader.atEnd) topicFilters.push(reader.utf8String());
  if (topicFilters.length === 0) throw new MqttCodecError('UNSUBSCRIBE carries no topic filters.');
  return { type: 'unsubscribe', packetId, topicFilters, ...(properties !== undefined ? { properties } : {}) };
}

function decodeUnsuback(reader: MqttReader, version: MqttProtocolVersion): MqttUnsubackPacket {
  const packetId = reader.twoByteInt();
  if (version === MQTT_PROTOCOL_VERSIONS.v311) return { type: 'unsuback', packetId, reasonCodes: [] };
  const properties = decodeProperties(reader);
  const reasonCodes: number[] = [];
  while (!reader.atEnd) reasonCodes.push(reader.byte());
  return { type: 'unsuback', packetId, reasonCodes, properties };
}

function decodeDisconnect(reader: MqttReader, version: MqttProtocolVersion): MqttDisconnectPacket {
  if (version === MQTT_PROTOCOL_VERSIONS.v311) {
    if (!reader.atEnd) throw new MqttCodecError('MQTT 3.1.1 DISCONNECT carries no body.');
    return { type: 'disconnect', reasonCode: null };
  }
  if (reader.atEnd) return { type: 'disconnect', reasonCode: 0 };
  const reasonCode = reader.byte();
  if (reader.atEnd) return { type: 'disconnect', reasonCode };
  return { type: 'disconnect', reasonCode, properties: decodeProperties(reader) };
}

function decodeAuth(reader: MqttReader, version: MqttProtocolVersion): MqttAuthPacket {
  if (version === MQTT_PROTOCOL_VERSIONS.v311) throw new MqttCodecError('AUTH is MQTT 5.0 only.');
  if (reader.atEnd) return { type: 'auth', reasonCode: 0 };
  const reasonCode = reader.byte();
  if (reader.atEnd) return { type: 'auth', reasonCode };
  return { type: 'auth', reasonCode, properties: decodeProperties(reader) };
}

function expectFlags(flags: number, expected: number, typeName: string): void {
  if (flags !== expected)
    throw new MqttCodecError(`${typeName} fixed-header flags must be 0x${expected.toString(16)}.`);
}

/**
 * Decode one packet BODY given its fixed-header nibbles — the shared
 * grammar under {@link decodeMqttPacket} and the stream decoder.
 * Throws `MqttCodecError`; the public entry points catch and report.
 */
export function decodeMqttPacketBody(
  typeNibble: number,
  flags: number,
  body: Uint8Array,
  version: MqttProtocolVersion,
): MqttPacket {
  const reader = new MqttReader(body);
  let packet: MqttPacket;
  switch (typeNibble) {
    case MQTT_PACKET_TYPES.connect:
      expectFlags(flags, 0, 'CONNECT');
      packet = decodeConnect(reader);
      break;
    case MQTT_PACKET_TYPES.connack:
      expectFlags(flags, 0, 'CONNACK');
      packet = decodeConnack(reader, version);
      break;
    case MQTT_PACKET_TYPES.publish:
      packet = decodePublish(reader, flags, version);
      break;
    case MQTT_PACKET_TYPES.puback:
      expectFlags(flags, 0, 'PUBACK');
      packet = decodePubAckLike(reader, 'puback', version);
      break;
    case MQTT_PACKET_TYPES.pubrec:
      expectFlags(flags, 0, 'PUBREC');
      packet = decodePubAckLike(reader, 'pubrec', version);
      break;
    case MQTT_PACKET_TYPES.pubrel:
      expectFlags(flags, 0x02, 'PUBREL');
      packet = decodePubAckLike(reader, 'pubrel', version);
      break;
    case MQTT_PACKET_TYPES.pubcomp:
      expectFlags(flags, 0, 'PUBCOMP');
      packet = decodePubAckLike(reader, 'pubcomp', version);
      break;
    case MQTT_PACKET_TYPES.subscribe:
      expectFlags(flags, 0x02, 'SUBSCRIBE');
      packet = decodeSubscribe(reader, version);
      break;
    case MQTT_PACKET_TYPES.suback:
      expectFlags(flags, 0, 'SUBACK');
      packet = decodeSuback(reader, version);
      break;
    case MQTT_PACKET_TYPES.unsubscribe:
      expectFlags(flags, 0x02, 'UNSUBSCRIBE');
      packet = decodeUnsubscribe(reader, version);
      break;
    case MQTT_PACKET_TYPES.unsuback:
      expectFlags(flags, 0, 'UNSUBACK');
      packet = decodeUnsuback(reader, version);
      break;
    case MQTT_PACKET_TYPES.pingreq:
      expectFlags(flags, 0, 'PINGREQ');
      packet = { type: 'pingreq' };
      break;
    case MQTT_PACKET_TYPES.pingresp:
      expectFlags(flags, 0, 'PINGRESP');
      packet = { type: 'pingresp' };
      break;
    case MQTT_PACKET_TYPES.disconnect:
      expectFlags(flags, 0, 'DISCONNECT');
      packet = decodeDisconnect(reader, version);
      break;
    case MQTT_PACKET_TYPES.auth:
      expectFlags(flags, 0, 'AUTH');
      packet = decodeAuth(reader, version);
      break;
    default:
      throw new MqttCodecError(`Unknown packet type ${typeNibble}.`);
  }
  if (!reader.atEnd) throw new MqttCodecError('Packet body has trailing bytes.');
  return packet;
}

/**
 * Decode exactly ONE complete packet from a buffer — the display-side
 * decode of a captured packet's verbatim bytes. Trailing bytes after
 * the packet report as an error (use the stream decoder for a byte
 * stream). Payload fields are subarray views over the input.
 */
export function decodeMqttPacket(bytes: Uint8Array, version: MqttProtocolVersion): MqttDecodeResult {
  try {
    const reader = new MqttReader(bytes);
    const header = reader.byte();
    const remainingLength = reader.varint();
    if (remainingLength !== reader.remaining) {
      throw new MqttCodecError(
        `Remaining length says ${remainingLength} bytes but ${reader.remaining} follow the header.`,
      );
    }
    return { ok: true, packet: decodeMqttPacketBody(header >> 4, header & 0x0f, reader.rest(), version) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
