/**
 * Canonical top-level field ordering for every persisted v5 entity.
 *
 * Matches invariant #6 — metadata top, payload nested — from
 * docs/V5_FOUNDATION_PLAN.md §Phase 0. The codec serializes known
 * fields in this order; unknown keys (preserve-unknown, invariant #4)
 * retain their original position beneath the known block.
 */

export const WORKSPACE_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'description', 'defaultEnvironmentId'] as const;

export const COLLECTION_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'description', 'order', 'variables'] as const;

export const FOLDER_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'order'] as const;

/**
 * Rule entries — shared across all 8 variants. Each variant carries its
 * own `type` literal + type-specific `action`, but the base fields
 * always serialize in this order. `version` sits right after
 * `schemaVersion` so both "version" concepts live next to each other
 * at the top of the file (Phase 10 write counter vs. Phase 0 shape
 * version).
 */
export const RULE_FIELD_ORDER = [
  'schemaVersion',
  'version',
  'uid',
  'name',
  'type',
  'enabled',
  'conditions',
  'action',
] as const;

export const TEMPLATE_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'ruleType',
  'icon',
  'description',
  'includes',
  'conditions',
  'formValues',
  'createdAt',
  'updatedAt',
] as const;

export const WORKSPACE_VARIABLES_FIELD_ORDER = ['schemaVersion', 'variables'] as const;

export const VAULT_FIELD_ORDER = ['schemaVersion', 'secrets'] as const;

export const ENVIRONMENT_FIELD_ORDER = ['schemaVersion', 'version', 'uid', 'name', 'variables'] as const;

export const REQUEST_FIELD_ORDER = [
  'schemaVersion',
  'version',
  'uid',
  'name',
  'method',
  'url',
  'headers',
  'params',
  'auth',
  'credentialsMode',
  'body',
] as const;

/**
 * `path` is excluded from persisted YAML on purpose — it's the folder
 * name on disk (slug-uid), derivable from the filesystem. The runtime
 * Rule / Collection / Request value carries `path`; the codec strips it
 * on serialize and re-populates it on parse (the caller tells the codec
 * what path the document came from).
 */
export const RUNTIME_ONLY_FIELDS = ['path'] as const;
