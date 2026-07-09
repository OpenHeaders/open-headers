/**
 * Response-example mutator catalog — routing constant.
 *
 * Examples are frozen snapshots: the captured `request` / `response`
 * blocks never change after create. The only scalar that moves is
 * `name` (rename) — duplicate is a fresh create, and everything else
 * is lifecycle. No side effects: examples are documentation-tier
 * records, so no DNR recompile and no resolver invalidation.
 */

/** Routing key carried on every response-example mutation envelope. */
export const RESPONSE_EXAMPLE_ENTITY_TYPE = 'response-example';
