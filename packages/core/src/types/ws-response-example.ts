/**
 * WebSocket Response Example types — derived from the valibot schemas
 * in `../schemas/ws-response-example.ts` so the runtime validator and
 * the TypeScript types stay locked together.
 */

import type * as v from 'valibot';
import type {
  CapturedWsCloseSchema,
  CapturedWsMessageSchema,
  CapturedWsRequestSchema,
  CapturedWsResponseSchema,
  WsResponseExampleSchema,
} from '../schemas/ws-response-example';

/** Request shape as composed — authored values, variable refs unresolved. */
export type CapturedWsRequest = v.InferOutput<typeof CapturedWsRequestSchema>;

/** One captured message of the session, direction-tagged. */
export type CapturedWsMessage = v.InferOutput<typeof CapturedWsMessageSchema>;

/** The Close handshake as the wire answered it. */
export type CapturedWsClose = v.InferOutput<typeof CapturedWsCloseSchema>;

/** Response side of the captured session. */
export type CapturedWsResponse = v.InferOutput<typeof CapturedWsResponseSchema>;

/** A snapshot of one settled WebSocket session, saved under a WebSocketRequest. */
export type WsResponseExample = v.InferOutput<typeof WsResponseExampleSchema>;
