/**
 * WebSocket response-example mutator catalog — routing constant.
 *
 * Examples are captured session snapshots that stay editable after
 * capture: `name` renames, and the `request` / `response` blocks patch
 * as whole LWW values so a capture can be reworked into an authored
 * record. Duplicate is a fresh create; everything else is lifecycle.
 * No side effects: examples are documentation-tier records, so no DNR
 * recompile and no resolver invalidation.
 */

import type { WEBSOCKET_REQUEST_ENTITY_TYPE } from '../websocket-request/types';

/** Routing key carried on every WebSocket response-example mutation envelope. */
export const WS_RESPONSE_EXAMPLE_ENTITY_TYPE = 'wsResponseExample';

/** The one parent kind that can hold a WebSocket response example — the request the exchange ran against. */
export interface WsResponseExampleParentRef {
  type: typeof WEBSOCKET_REQUEST_ENTITY_TYPE;
  uid: string;
}

/** Slot marker stored under `request.examples[exampleUid]`. */
export interface WsResponseExampleSlot {
  uid: string;
  type: typeof WS_RESPONSE_EXAMPLE_ENTITY_TYPE;
}
