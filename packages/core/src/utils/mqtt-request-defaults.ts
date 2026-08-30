/**
 * Empty-MqttRequest seed factory. Mirrors `websocket-request-defaults.ts`:
 * one source of truth for the freshly-created MQTT request shape so
 * every creation gesture stays byte-identical.
 *
 * Defaults:
 *   - url: empty (user fills the mqtt/mqtts/ws/wss target)
 *   - protocolVersion: absent — 5.0, the first-class default
 *   - topic / payload: empty; topics / savedMessages / userProperties: empty
 *   - auth: inherit (collection / folder default)
 */

import type { MqttRequest } from '../types';

export interface BuildEmptyMqttRequestInput {
  uid: string;
  /** Full request path: `${parentPath}/${pathSegment}`. */
  path: string;
  name: string;
}

export function buildEmptyMqttRequest(input: BuildEmptyMqttRequestInput): MqttRequest {
  return {
    schemaVersion: 5,
    uid: input.uid,
    path: input.path,
    name: input.name,
    url: '',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [],
    userProperties: [],
    auth: { type: 'inherit' },
  };
}
