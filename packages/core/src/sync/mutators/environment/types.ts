/**
 * Environment mutator catalog — routing constants.
 *
 * The factory context (`MutatorContext`) and return shape
 * (`MutatorIntent`) live in the parent `mutators/types.ts` because
 * they're identical across entity types — same authorship metadata
 * (workspaceId / hlc / surfaceId / deviceId / batchId? / userId?) and
 * same return shape (batch + side-effects).
 *
 * The set member identity for env variables is the variable NAME, not
 * a synthetic itemId. §8's "renameEnvVar = remove + add" semantics
 * depend on that — without name-as-id, two devices independently
 * adding `API_KEY` produce two distinct entries and the catalog
 * couldn't express rename atomically. Convergence is per-(path, name)
 * LWW.
 */

/** Routing key carried on every environment mutation envelope. */
export const ENVIRONMENT_ENTITY_TYPE = 'environment';

/** Set path holding the variable list on an environment entity. */
export const ENV_VARS_PATH = 'variables';
