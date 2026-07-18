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

/** Routing key carried on every WebSocket response-example mutation envelope. */
export const WS_RESPONSE_EXAMPLE_ENTITY_TYPE = 'wsResponseExample';
