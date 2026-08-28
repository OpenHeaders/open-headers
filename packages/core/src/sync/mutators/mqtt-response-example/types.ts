/**
 * MQTT response-example mutator catalog — routing constant.
 *
 * Examples are captured session snapshots that stay editable after
 * capture: `name` renames, and the `request` / `response` blocks patch
 * as whole LWW values so a capture can be reworked into an authored
 * record. Duplicate is a fresh create; everything else is lifecycle.
 * No side effects: examples are documentation-tier records, so no DNR
 * recompile and no resolver invalidation.
 */

import type { MQTT_REQUEST_ENTITY_TYPE } from '../mqtt-request/types';

/** Routing key carried on every MQTT response-example mutation envelope. */
export const MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE = 'mqttResponseExample';

/** The one parent kind that can hold an MQTT response example — the request the exchange ran against. */
export interface MqttResponseExampleParentRef {
  type: typeof MQTT_REQUEST_ENTITY_TYPE;
  uid: string;
}

/** Slot marker stored under `request.examples[exampleUid]`. */
export interface MqttResponseExampleSlot {
  uid: string;
  type: typeof MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE;
}
