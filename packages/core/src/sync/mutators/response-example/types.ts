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

/** Routing key carried on every response-example mutation envelope. */
export const RESPONSE_EXAMPLE_ENTITY_TYPE = 'response-example';
