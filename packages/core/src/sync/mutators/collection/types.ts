/**
 * Collection mutator catalog — routing constants.
 *
 * Like Environment, set member identity for collection variables is
 * the variable NAME (not a synthetic itemId) — concurrent renames of
 * the same variable converge under per-(setPath, name) LWW; concurrent
 * adds of the same name converge to one entry, not two. The factory
 * shape (`MutatorContext` / `MutatorIntent`) lives in the parent
 * `mutators/types.ts` and is shared across every entity catalog.
 *
 * Collection scalar fields (`name`, `description`, `defaultEnvironmentId`,
 * `pinnedEnvironmentIds`) ride generic `setField` envelopes; the
 * dedicated factories below are named for awareness/UI clarity the
 * same way `toggleEnabled` is on rules and `renameEnvironment` is on
 * environments.
 */

/** Routing key carried on every collection mutation envelope. */
export const COLLECTION_ENTITY_TYPE = 'collection';

/** Set path holding the variable list on a collection entity. */
export const COLLECTION_VARS_PATH = 'variables';
