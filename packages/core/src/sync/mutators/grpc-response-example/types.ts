/**
 * gRPC response-example mutator catalog — routing constant.
 *
 * Examples are captured snapshots that stay editable after capture:
 * `name` renames, and the `request` / `response` blocks patch as whole
 * LWW values so a capture can be reworked into an authored record.
 * Duplicate is a fresh create; everything else is lifecycle. No side
 * effects: examples are documentation-tier records, so no DNR
 * recompile and no resolver invalidation.
 */

import type { GRPC_REQUEST_ENTITY_TYPE } from '../grpc-request/types';

/** Routing key carried on every gRPC response-example mutation envelope. */
export const GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE = 'grpcResponseExample';

/** The one parent kind that can hold a gRPC response example — the request the exchange ran against. */
export interface GrpcResponseExampleParentRef {
  type: typeof GRPC_REQUEST_ENTITY_TYPE;
  uid: string;
}

/** Slot marker stored under `request.examples[exampleUid]`. */
export interface GrpcResponseExampleSlot {
  uid: string;
  type: typeof GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE;
}
