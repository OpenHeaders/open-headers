/**
 * MQTT 5.0 property block — the varint-length-prefixed property list a
 * 5.0 packet (and a 5.0 will) may carry. Decode is read-tolerant
 * across packet contexts: any known property decodes wherever it
 * appears (display truth), while an unknown identifier or a duplicated
 * non-repeatable property is the spec's Malformed Packet and reports
 * as one — an unknown id has no parseable value type, so tolerance is
 * impossible there. Encode emits exactly what the model carries, in
 * ascending identifier order; the 3.1.1 leg never reaches this module.
 */
import { MqttCodecError, MqttReader, MqttWriter } from './wire';

/** One 0x26 User Property pair — repeatable, order preserved. */
export interface MqttUserProperty {
  key: string;
  value: string;
}

/**
 * Every MQTT 5.0 property as an optional field, values verbatim (the
 * byte-typed ones stay numbers — 0/1 flags included — so the display
 * shows what the wire said, never a coerced boolean).
 */
export interface MqttProperties {
  /** 0x01 — PUBLISH / will. */
  payloadFormatIndicator?: number;
  /** 0x02 — PUBLISH / will, seconds. */
  messageExpiryInterval?: number;
  /** 0x03 — PUBLISH / will. */
  contentType?: string;
  /** 0x08 — PUBLISH / will. */
  responseTopic?: string;
  /** 0x09 — PUBLISH / will. */
  correlationData?: Uint8Array;
  /** 0x0B — SUBSCRIBE (one) and inbound PUBLISH (repeatable). */
  subscriptionIdentifiers?: number[];
  /** 0x11 — CONNECT / CONNACK / DISCONNECT, seconds. */
  sessionExpiryInterval?: number;
  /** 0x12 — CONNACK. */
  assignedClientId?: string;
  /** 0x13 — CONNACK, seconds. */
  serverKeepAlive?: number;
  /** 0x15 — CONNECT / CONNACK / AUTH. */
  authenticationMethod?: string;
  /** 0x16 — CONNECT / CONNACK / AUTH. */
  authenticationData?: Uint8Array;
  /** 0x17 — CONNECT. */
  requestProblemInformation?: number;
  /** 0x18 — will, seconds. */
  willDelayInterval?: number;
  /** 0x19 — CONNECT. */
  requestResponseInformation?: number;
  /** 0x1A — CONNACK. */
  responseInformation?: string;
  /** 0x1C — CONNACK / DISCONNECT. */
  serverReference?: string;
  /** 0x1F — acks / DISCONNECT / AUTH. */
  reasonString?: string;
  /** 0x21 — CONNECT / CONNACK. */
  receiveMaximum?: number;
  /** 0x22 — CONNECT / CONNACK. */
  topicAliasMaximum?: number;
  /** 0x23 — PUBLISH. */
  topicAlias?: number;
  /** 0x24 — CONNACK. */
  maximumQos?: number;
  /** 0x25 — CONNACK. */
  retainAvailable?: number;
  /** 0x26 — every packet, repeatable. */
  userProperties?: MqttUserProperty[];
  /** 0x27 — CONNECT / CONNACK, bytes. */
  maximumPacketSize?: number;
  /** 0x28 — CONNACK. */
  wildcardSubscriptionAvailable?: number;
  /** 0x29 — CONNACK. */
  subscriptionIdentifierAvailable?: number;
  /** 0x2A — CONNACK. */
  sharedSubscriptionAvailable?: number;
}

/** True when the object would put at least one property on the wire —
 *  the 3.1.1 encode guard's question. */
export function hasProperties(properties: MqttProperties | undefined): boolean {
  if (properties === undefined) return false;
  const { userProperties, subscriptionIdentifiers, ...scalars } = properties;
  if (userProperties !== undefined && userProperties.length > 0) return true;
  if (subscriptionIdentifiers !== undefined && subscriptionIdentifiers.length > 0) return true;
  return Object.values(scalars).some((value) => value !== undefined);
}

/**
 * Append the property block (varint length + properties) to `writer`.
 * Emission order is ascending identifier; user properties keep the
 * model's order. An `undefined` object writes the legal empty block.
 */
export function encodeProperties(writer: MqttWriter, properties: MqttProperties | undefined): void {
  const block = new MqttWriter();
  if (properties !== undefined) {
    const p = properties;
    if (p.payloadFormatIndicator !== undefined) {
      block.varint(0x01);
      block.byte(p.payloadFormatIndicator);
    }
    if (p.messageExpiryInterval !== undefined) {
      block.varint(0x02);
      block.fourByteInt(p.messageExpiryInterval);
    }
    if (p.contentType !== undefined) {
      block.varint(0x03);
      block.utf8String(p.contentType);
    }
    if (p.responseTopic !== undefined) {
      block.varint(0x08);
      block.utf8String(p.responseTopic);
    }
    if (p.correlationData !== undefined) {
      block.varint(0x09);
      block.binary(p.correlationData);
    }
    for (const value of p.subscriptionIdentifiers ?? []) {
      if (!Number.isInteger(value) || value < 1) {
        throw new MqttCodecError(`Subscription identifier out of range: ${value}.`);
      }
      block.varint(0x0b);
      block.varint(value);
    }
    if (p.sessionExpiryInterval !== undefined) {
      block.varint(0x11);
      block.fourByteInt(p.sessionExpiryInterval);
    }
    if (p.assignedClientId !== undefined) {
      block.varint(0x12);
      block.utf8String(p.assignedClientId);
    }
    if (p.serverKeepAlive !== undefined) {
      block.varint(0x13);
      block.twoByteInt(p.serverKeepAlive);
    }
    if (p.authenticationMethod !== undefined) {
      block.varint(0x15);
      block.utf8String(p.authenticationMethod);
    }
    if (p.authenticationData !== undefined) {
      block.varint(0x16);
      block.binary(p.authenticationData);
    }
    if (p.requestProblemInformation !== undefined) {
      block.varint(0x17);
      block.byte(p.requestProblemInformation);
    }
    if (p.willDelayInterval !== undefined) {
      block.varint(0x18);
      block.fourByteInt(p.willDelayInterval);
    }
    if (p.requestResponseInformation !== undefined) {
      block.varint(0x19);
      block.byte(p.requestResponseInformation);
    }
    if (p.responseInformation !== undefined) {
      block.varint(0x1a);
      block.utf8String(p.responseInformation);
    }
    if (p.serverReference !== undefined) {
      block.varint(0x1c);
      block.utf8String(p.serverReference);
    }
    if (p.reasonString !== undefined) {
      block.varint(0x1f);
      block.utf8String(p.reasonString);
    }
    if (p.receiveMaximum !== undefined) {
      block.varint(0x21);
      block.twoByteInt(p.receiveMaximum);
    }
    if (p.topicAliasMaximum !== undefined) {
      block.varint(0x22);
      block.twoByteInt(p.topicAliasMaximum);
    }
    if (p.topicAlias !== undefined) {
      block.varint(0x23);
      block.twoByteInt(p.topicAlias);
    }
    if (p.maximumQos !== undefined) {
      block.varint(0x24);
      block.byte(p.maximumQos);
    }
    if (p.retainAvailable !== undefined) {
      block.varint(0x25);
      block.byte(p.retainAvailable);
    }
    for (const pair of p.userProperties ?? []) {
      block.varint(0x26);
      block.utf8String(pair.key);
      block.utf8String(pair.value);
    }
    if (p.maximumPacketSize !== undefined) {
      block.varint(0x27);
      block.fourByteInt(p.maximumPacketSize);
    }
    if (p.wildcardSubscriptionAvailable !== undefined) {
      block.varint(0x28);
      block.byte(p.wildcardSubscriptionAvailable);
    }
    if (p.subscriptionIdentifierAvailable !== undefined) {
      block.varint(0x29);
      block.byte(p.subscriptionIdentifierAvailable);
    }
    if (p.sharedSubscriptionAvailable !== undefined) {
      block.varint(0x2a);
      block.byte(p.sharedSubscriptionAvailable);
    }
  }
  writer.varint(block.size);
  writer.raw(block.finish());
}

function checkOnce(existing: unknown, id: number): void {
  if (existing !== undefined) throw new MqttCodecError(`Duplicate property 0x${id.toString(16)}.`);
}

/**
 * Decode one property block off `reader`. Throws `MqttCodecError` on
 * an unknown identifier or a duplicated non-repeatable property — the
 * spec's Malformed Packet, and the only cases parsing cannot survive.
 */
export function decodeProperties(reader: MqttReader): MqttProperties {
  const length = reader.varint();
  const block = new MqttReader(reader.window(length));
  const p: MqttProperties = {};
  while (!block.atEnd) {
    const id = block.varint();
    switch (id) {
      case 0x01:
        checkOnce(p.payloadFormatIndicator, id);
        p.payloadFormatIndicator = block.byte();
        break;
      case 0x02:
        checkOnce(p.messageExpiryInterval, id);
        p.messageExpiryInterval = block.fourByteInt();
        break;
      case 0x03:
        checkOnce(p.contentType, id);
        p.contentType = block.utf8String();
        break;
      case 0x08:
        checkOnce(p.responseTopic, id);
        p.responseTopic = block.utf8String();
        break;
      case 0x09:
        checkOnce(p.correlationData, id);
        p.correlationData = block.binary().slice();
        break;
      case 0x0b:
        p.subscriptionIdentifiers = [...(p.subscriptionIdentifiers ?? []), block.varint()];
        break;
      case 0x11:
        checkOnce(p.sessionExpiryInterval, id);
        p.sessionExpiryInterval = block.fourByteInt();
        break;
      case 0x12:
        checkOnce(p.assignedClientId, id);
        p.assignedClientId = block.utf8String();
        break;
      case 0x13:
        checkOnce(p.serverKeepAlive, id);
        p.serverKeepAlive = block.twoByteInt();
        break;
      case 0x15:
        checkOnce(p.authenticationMethod, id);
        p.authenticationMethod = block.utf8String();
        break;
      case 0x16:
        checkOnce(p.authenticationData, id);
        p.authenticationData = block.binary().slice();
        break;
      case 0x17:
        checkOnce(p.requestProblemInformation, id);
        p.requestProblemInformation = block.byte();
        break;
      case 0x18:
        checkOnce(p.willDelayInterval, id);
        p.willDelayInterval = block.fourByteInt();
        break;
      case 0x19:
        checkOnce(p.requestResponseInformation, id);
        p.requestResponseInformation = block.byte();
        break;
      case 0x1a:
        checkOnce(p.responseInformation, id);
        p.responseInformation = block.utf8String();
        break;
      case 0x1c:
        checkOnce(p.serverReference, id);
        p.serverReference = block.utf8String();
        break;
      case 0x1f:
        checkOnce(p.reasonString, id);
        p.reasonString = block.utf8String();
        break;
      case 0x21:
        checkOnce(p.receiveMaximum, id);
        p.receiveMaximum = block.twoByteInt();
        break;
      case 0x22:
        checkOnce(p.topicAliasMaximum, id);
        p.topicAliasMaximum = block.twoByteInt();
        break;
      case 0x23:
        checkOnce(p.topicAlias, id);
        p.topicAlias = block.twoByteInt();
        break;
      case 0x24:
        checkOnce(p.maximumQos, id);
        p.maximumQos = block.byte();
        break;
      case 0x25:
        checkOnce(p.retainAvailable, id);
        p.retainAvailable = block.byte();
        break;
      case 0x26: {
        const key = block.utf8String();
        const value = block.utf8String();
        p.userProperties = [...(p.userProperties ?? []), { key, value }];
        break;
      }
      case 0x27:
        checkOnce(p.maximumPacketSize, id);
        p.maximumPacketSize = block.fourByteInt();
        break;
      case 0x28:
        checkOnce(p.wildcardSubscriptionAvailable, id);
        p.wildcardSubscriptionAvailable = block.byte();
        break;
      case 0x29:
        checkOnce(p.subscriptionIdentifierAvailable, id);
        p.subscriptionIdentifierAvailable = block.byte();
        break;
      case 0x2a:
        checkOnce(p.sharedSubscriptionAvailable, id);
        p.sharedSubscriptionAvailable = block.byte();
        break;
      default:
        throw new MqttCodecError(`Unknown property identifier 0x${id.toString(16)}.`);
    }
  }
  return p;
}
