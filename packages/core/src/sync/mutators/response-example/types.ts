/**
 * Response-example mutator catalog — routing constant.
 *
 * Examples are captured snapshots that stay editable after capture:
 * `name` renames, and the `request` / `response` blocks patch as whole
 * LWW values so a capture can be reworked into an authored template.
 * Duplicate is a fresh create; everything else is lifecycle. No side
 * effects: examples are documentation-tier records, so no DNR
 * recompile and no resolver invalidation.
 */

import type { GRAPHQL_REQUEST_ENTITY_TYPE } from '../graphql-request/types';
import type { REQUEST_ENTITY_TYPE } from '../request/types';

/** Routing key carried on every response-example mutation envelope. */
export const RESPONSE_EXAMPLE_ENTITY_TYPE = 'response-example';

/**
 * The parent kinds that hold a response example — the request the
 * exchange ran against: an HTTP request, or a GraphQL request (whose
 * send compiles to one HTTP exchange, so it captures the same shape).
 * Both own the slot at their `examples` path.
 */
export interface ResponseExampleParentRef {
  type: typeof REQUEST_ENTITY_TYPE | typeof GRAPHQL_REQUEST_ENTITY_TYPE;
  uid: string;
}

/** Slot marker stored under `request.examples[exampleUid]`. */
export interface ResponseExampleSlot {
  uid: string;
  type: typeof RESPONSE_EXAMPLE_ENTITY_TYPE;
}
