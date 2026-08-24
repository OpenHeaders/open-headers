import { describe, expect, it } from 'vitest';
import { MQTT_CONNACK_RETURN_CODE_NAMES, mqttReasonCodeName } from '../../src/mqtt';

describe('mqttReasonCodeName', () => {
  it('names the common codes across contexts', () => {
    expect(mqttReasonCodeName(0x00, 'connack')).toBe('Success');
    expect(mqttReasonCodeName(0x87, 'connack')).toBe('Not authorized');
    expect(mqttReasonCodeName(0x10, 'puback')).toBe('No matching subscribers');
    expect(mqttReasonCodeName(0x11, 'unsuback')).toBe('No subscription existed');
    expect(mqttReasonCodeName(0x18, 'auth')).toBe('Continue authentication');
    expect(mqttReasonCodeName(0x8e, 'disconnect')).toBe('Session taken over');
  });

  it('names the context-sensitive zero and SUBACK grants', () => {
    expect(mqttReasonCodeName(0x00, 'disconnect')).toBe('Normal disconnection');
    expect(mqttReasonCodeName(0x00, 'suback')).toBe('Granted QoS 0');
    expect(mqttReasonCodeName(0x01, 'suback')).toBe('Granted QoS 1');
    expect(mqttReasonCodeName(0x02, 'suback')).toBe('Granted QoS 2');
    expect(mqttReasonCodeName(0x80, 'suback')).toBe('Unspecified error');
  });

  it('returns undefined for codes the spec does not define', () => {
    expect(mqttReasonCodeName(0x42, 'disconnect')).toBeUndefined();
  });

  it('keeps the 3.1.1 return-code space separate', () => {
    expect(MQTT_CONNACK_RETURN_CODE_NAMES[0]).toBe('Connection Accepted');
    expect(MQTT_CONNACK_RETURN_CODE_NAMES[5]).toBe('Not authorized');
  });
});
