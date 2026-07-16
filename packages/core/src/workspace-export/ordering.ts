/**
 * Canonical top-level field order for a workspace-export envelope.
 *
 * Mirrors the per-entity ordering convention in
 * `packages/core/src/codec/yaml/ordering.ts`: metadata top, payload
 * nested. Keeps two clients exporting the same workspace producing
 * byte-identical YAML.
 */

export const WORKSPACE_EXPORT_FIELD_ORDER = [
  'kind',
  'schemaVersion',
  'exportFormatVersion',
  'exportId',
  'exportedAt',
  'source',
  'scope',
  'notes',
  'workspace',
  'entities',
  'secrets',
  'meta',
] as const;

export const WORKSPACE_EXPORT_SOURCE_FIELD_ORDER = ['app', 'appVersion', 'platform', 'workspaceLabel'] as const;

/**
 * Inside `entities`, list the bag in dependency-friendly order:
 * collections / folders before rules + requests, environments before
 * the variable bags that may reference them, live workflows before
 * live variables that bind to them.
 */
export const WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER = [
  'collections',
  'folders',
  'environments',
  'workspaceVars',
  'vault',
  'templates',
  'requests',
  'rules',
  'liveWorkflows',
  'liveVariables',
  'specs',
] as const;

export const WORKSPACE_EXPORT_META_FIELD_ORDER = ['redactions', 'counts'] as const;

export const WORKSPACE_EXPORT_SECRETS_FIELD_ORDER = ['encryption', 'ciphertext'] as const;
