import { describe, expect, it } from 'vitest';
import {
  decodeProperties,
  encodeProperties,
  hasProperties,
  MqttCodecError,
  type MqttProperties,
  MqttReader,
  MqttWriter,
} from '../../src/mqtt';

function roundTrip(properties: MqttProperties | undefined): MqttProperties {
  const writer = new MqttWriter();
  encodeProperties(writer, properties);
  return decodeProperties(new MqttReader(writer.finish()));
}

function decodeBlock(bytes: number[]): MqttProperties {
  return decodeProperties(new MqttReader(new Uint8Array(bytes)));
}

describe('property block round-trips', () => {
  it('round-trips the empty and absent block as {}', () => {
    expect(roundTrip(undefined)).toEqual({});
    expect(roundTrip({})).toEqual({});
  });

  it('round-trips every property at once', () => {
    const full: MqttProperties = {
      payloadFormatIndicator: 1,
      messageExpiryInterval: 3_600,
      contentType: 'application/json',
      responseTopic: 'replies/oh',
      correlationData: new Uint8Array([0xde, 0xad]),
      subscriptionIdentifiers: [1, 268_435_455],
      sessionExpiryInterval: 0xffff_ffff,
      assignedClientId: 'oh-assigned',
      serverKeepAlive: 30,
      authenticationMethod: 'SCRAM-SHA-1',
      authenticationData: new Uint8Array([1, 2, 3]),
      requestProblemInformation: 0,
      willDelayInterval: 5,
      requestResponseInformation: 1,
      responseInformation: 'response/base',
      serverReference: 'broker2.openheaders.io',
      reasonString: 'because',
      receiveMaximum: 100,
      topicAliasMaximum: 10,
      topicAlias: 3,
      maximumQos: 1,
      retainAvailable: 0,
      userProperties: [
        { key: 'trace', value: 'abc' },
        { key: 'trace', value: 'def' },
      ],
      maximumPacketSize: 1_048_576,
      wildcardSubscriptionAvailable: 1,
      subscriptionIdentifierAvailable: 1,
      sharedSubscriptionAvailable: 0,
    };
    expect(roundTrip(full)).toEqual(full);
  });

  it('keeps repeated user properties in model order, duplicate keys included', () => {
    const decoded = roundTrip({
      userProperties: [
        { key: 'b', value: '2' },
        { key: 'a', value: '1' },
        { key: 'b', value: '3' },
      ],
    });
    expect(decoded.userProperties).toEqual([
      { key: 'b', value: '2' },
      { key: 'a', value: '1' },
      { key: 'b', value: '3' },
    ]);
  });

  it('round-trips repeated subscription identifiers', () => {
    expect(roundTrip({ subscriptionIdentifiers: [1, 2, 128] }).subscriptionIdentifiers).toEqual([1, 2, 128]);
  });
});

describe('encode validation', () => {
  it('rejects a zero subscription identifier', () => {
    const writer = new MqttWriter();
    expect(() => encodeProperties(writer, { subscriptionIdentifiers: [0] })).toThrow(
      'Subscription identifier out of range: 0.',
    );
  });

  it('rejects out-of-range scalar values through the writer', () => {
    const writer = new MqttWriter();
    expect(() => encodeProperties(writer, { receiveMaximum: 0x1_0000 })).toThrow(MqttCodecError);
    expect(() => encodeProperties(writer, { payloadFormatIndicator: 256 })).toThrow(MqttCodecError);
  });
});

describe('decode malformed blocks', () => {
  it('rejects an unknown property identifier', () => {
    expect(() => decodeBlock([2, 0x7f, 0x00])).toThrow('Unknown property identifier 0x7f.');
  });

  it('rejects a duplicated non-repeatable property', () => {
    expect(() => decodeBlock([4, 0x23, 0x00, 0x01, 0x23])).toThrow('Duplicate property 0x23.');
  });

  it('rejects a block length that overruns the buffer', () => {
    expect(() => decodeBlock([5, 0x01, 0x01])).toThrow('Truncated packet.');
  });

  it('rejects a property value cut by the block boundary', () => {
    expect(() => decodeBlock([2, 0x02, 0x00])).toThrow('Truncated packet.');
  });
});

describe('hasProperties', () => {
  it('is false for undefined, empty, and empty-array-only objects', () => {
    expect(hasProperties(undefined)).toBe(false);
    expect(hasProperties({})).toBe(false);
    expect(hasProperties({ userProperties: [] })).toBe(false);
    expect(hasProperties({ subscriptionIdentifiers: [] })).toBe(false);
  });

  it('is true once any property would reach the wire', () => {
    expect(hasProperties({ topicAlias: 5 })).toBe(true);
    expect(hasProperties({ payloadFormatIndicator: 0 })).toBe(true);
    expect(hasProperties({ userProperties: [{ key: 'a', value: 'b' }] })).toBe(true);
    expect(hasProperties({ subscriptionIdentifiers: [1] })).toBe(true);
  });
});
