/**
 * MQTT Response Example types — derived from the valibot schemas in
 * `../schemas/mqtt-response-example.ts` so the runtime validator and
 * the TypeScript types stay locked together.
 */

import type * as v from 'valibot';
import type {
  CapturedMqttEndSchema,
  CapturedMqttEventSchema,
  CapturedMqttRequestSchema,
  CapturedMqttResponseSchema,
  MqttResponseExampleSchema,
} from '../schemas/mqtt-response-example';

/** Request shape as composed — authored values, variable refs unresolved. */
export type CapturedMqttRequest = v.InferOutput<typeof CapturedMqttRequestSchema>;

/** One captured event of the session's log, in packet order. */
export type CapturedMqttEvent = v.InferOutput<typeof CapturedMqttEventSchema>;

/** The end record as the wire answered it. */
export type CapturedMqttEnd = v.InferOutput<typeof CapturedMqttEndSchema>;

/** Response side of the captured session. */
export type CapturedMqttResponse = v.InferOutput<typeof CapturedMqttResponseSchema>;

/** A snapshot of one settled MQTT session, saved under an MqttRequest. */
export type MqttResponseExample = v.InferOutput<typeof MqttResponseExampleSchema>;
