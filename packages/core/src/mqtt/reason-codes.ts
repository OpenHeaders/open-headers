/**
 * MQTT reason-code vocabulary — spec names for the 5.0 reason codes
 * and the 3.1.1 CONNACK return codes, for display surfaces that label
 * a captured code (the code itself always shows verbatim; these names
 * ride beside it, never instead of it).
 */

/** 3.1.1 CONNACK return codes (a different numeric space from 5.0). */
export const MQTT_CONNACK_RETURN_CODE_NAMES: Readonly<Record<number, string>> = {
  0: 'Connection Accepted',
  1: 'Unacceptable protocol version',
  2: 'Identifier rejected',
  3: 'Server unavailable',
  4: 'Bad user name or password',
  5: 'Not authorized',
};

/** The packet context a 5.0 reason code appeared in — a handful of
 *  values name differently by context (0x00 most of all). */
export type MqttReasonContext =
  | 'connack'
  | 'puback'
  | 'pubrec'
  | 'pubrel'
  | 'pubcomp'
  | 'suback'
  | 'unsuback'
  | 'disconnect'
  | 'auth';

const COMMON_REASON_NAMES: Readonly<Record<number, string>> = {
  0: 'Success',
  4: 'Disconnect with Will Message',
  16: 'No matching subscribers',
  17: 'No subscription existed',
  24: 'Continue authentication',
  25: 'Re-authenticate',
  128: 'Unspecified error',
  129: 'Malformed Packet',
  130: 'Protocol Error',
  131: 'Implementation specific error',
  132: 'Unsupported Protocol Version',
  133: 'Client Identifier not valid',
  134: 'Bad User Name or Password',
  135: 'Not authorized',
  136: 'Server unavailable',
  137: 'Server busy',
  138: 'Banned',
  139: 'Server shutting down',
  140: 'Bad authentication method',
  141: 'Keep Alive timeout',
  142: 'Session taken over',
  143: 'Topic Filter invalid',
  144: 'Topic Name invalid',
  145: 'Packet Identifier in use',
  146: 'Packet Identifier not found',
  147: 'Receive Maximum exceeded',
  148: 'Topic Alias invalid',
  149: 'Packet too large',
  150: 'Message rate too high',
  151: 'Quota exceeded',
  152: 'Administrative action',
  153: 'Payload format invalid',
  154: 'Retain not supported',
  155: 'QoS not supported',
  156: 'Use another server',
  157: 'Server moved',
  158: 'Shared Subscriptions not supported',
  159: 'Connection rate exceeded',
  160: 'Maximum connect time',
  161: 'Subscription Identifiers not supported',
  162: 'Wildcard Subscriptions not supported',
};

/** Spec name of a 5.0 reason code in its packet context; `undefined`
 *  for a code the spec does not define (shown bare). */
export function mqttReasonCodeName(code: number, context: MqttReasonContext): string | undefined {
  if (context === 'suback' && code <= 0x02) {
    return `Granted QoS ${code}`;
  }
  if (context === 'disconnect' && code === 0x00) return 'Normal disconnection';
  return COMMON_REASON_NAMES[code];
}
