/**
 * YAML serializer for the workspace-export envelope.
 *
 * Round-trips through `eemeli/yaml` (invariant #16) using the canonical
 * stringify options that produce byte-identical output across clients.
 * Field order at every nested level is governed by the constants in
 * `./ordering.ts`; nested entity arrays serialize their entity-level
 * fields in the orders declared by the existing codec layer
 * (`packages/core/src/codec/yaml/ordering.ts`) — same constants the
 * per-entity YAML files use, so an export's embedded entity is
 * structurally indistinguishable from a free-standing entity file.
 *
 * `path` is preserved in the YAML output. Rationale: the runtime has
 * three parallel collection trees (`rules/...`, `requests/...`,
 * `templates/...`) flattened into single `entities.collections` /
 * `entities.folders` arrays in the envelope. The path prefix is the
 * only thing that disambiguates which tree a collection or folder
 * belongs to. Stripping path without adding a `kind` discriminator
 * would lose tree affiliation. This deviates from design §1.1's "path
 * is omitted on export" line and is captured in V5_WORKSPACE_EXPORT_STATUS.md
 * as a divergence to revisit when the importer lands (PR 2). The path
 * value is already canonical (`toFolderName(name, uid)`) so re-imports
 * stay round-trip stable.
 */

import * as YAML from 'yaml';
import { CANONICAL_STRINGIFY_OPTIONS } from '../codec/yaml/canonical';
import {
  COLLECTION_FIELD_ORDER,
  ENVIRONMENT_FIELD_ORDER,
  FOLDER_FIELD_ORDER,
  LIVE_VARIABLE_FIELD_ORDER,
  LIVE_WORKFLOW_FIELD_ORDER,
  REQUEST_FIELD_ORDER,
  RULE_FIELD_ORDER,
  SPEC_FIELD_ORDER,
  TEMPLATE_FIELD_ORDER,
  VAULT_FIELD_ORDER,
  WORKSPACE_VARIABLES_FIELD_ORDER,
} from '../codec/yaml/ordering';
import {
  WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER,
  WORKSPACE_EXPORT_FIELD_ORDER,
  WORKSPACE_EXPORT_META_FIELD_ORDER,
  WORKSPACE_EXPORT_SECRETS_FIELD_ORDER,
  WORKSPACE_EXPORT_SOURCE_FIELD_ORDER,
} from './ordering';
import type { WorkspaceExport } from './schema';

/** Build a plain object whose key insertion order matches `order` (skips undefined). */
function ordered<T extends Record<string, unknown>>(value: T, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of order) {
    const v = value[k as keyof T];
    if (v !== undefined) out[k] = v;
  }
  // Preserve any extra keys after the known block (preserve-unknown discipline).
  for (const k of Object.keys(value)) {
    if (!order.includes(k) && (value as Record<string, unknown>)[k] !== undefined) {
      out[k] = (value as Record<string, unknown>)[k];
    }
  }
  return out;
}

/**
 * Order an entity's known fields per the codec layer's per-entity
 * ordering. `ordered()` already preserves extra keys after the known
 * block — `path` lands there automatically (the canonical orderings
 * exclude it since it's runtime-only at the codec layer; we preserve
 * it here for tree-affiliation, see file header).
 */
function entityOrdered<T extends Record<string, unknown>>(
  entity: T,
  order: readonly string[],
): Record<string, unknown> {
  return ordered(entity, order);
}

/**
 * Project a `WorkspaceExport` to the canonical key-ordered plain object
 * that `YAML.Document` will stringify in stable order. Nested entities
 * lose their `path` here (see file header).
 */
function toCanonicalShape(exp: WorkspaceExport): Record<string, unknown> {
  const entities: Record<string, unknown> = {
    collections: exp.entities.collections.map((c) => entityOrdered(c, COLLECTION_FIELD_ORDER)),
    folders: exp.entities.folders.map((f) => entityOrdered(f, FOLDER_FIELD_ORDER)),
    environments: exp.entities.environments.map((e) => entityOrdered(e, ENVIRONMENT_FIELD_ORDER)),
    workspaceVars: ordered(
      exp.entities.workspaceVars as unknown as Record<string, unknown>,
      WORKSPACE_VARIABLES_FIELD_ORDER,
    ),
    ...(exp.entities.vault !== undefined
      ? { vault: ordered(exp.entities.vault as unknown as Record<string, unknown>, VAULT_FIELD_ORDER) }
      : {}),
    templates: exp.entities.templates.map((t) => entityOrdered(t, TEMPLATE_FIELD_ORDER)),
    requests: exp.entities.requests.map((r) => entityOrdered(r, REQUEST_FIELD_ORDER)),
    rules: exp.entities.rules.map((r) => entityOrdered(r, RULE_FIELD_ORDER)),
    liveWorkflows: exp.entities.liveWorkflows.map((w) => entityOrdered(w, LIVE_WORKFLOW_FIELD_ORDER)),
    liveVariables: exp.entities.liveVariables.map((lv) => entityOrdered(lv, LIVE_VARIABLE_FIELD_ORDER)),
    specs: exp.entities.specs.map((s) => entityOrdered(s, SPEC_FIELD_ORDER)),
  };
  // Reproject `entities` via the canonical entities-bag ordering.
  const orderedEntities = ordered(entities, WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER);

  const projected: Record<string, unknown> = {
    kind: exp.kind,
    schemaVersion: exp.schemaVersion,
    exportFormatVersion: exp.exportFormatVersion,
    exportId: exp.exportId,
    exportedAt: exp.exportedAt,
    source: ordered(exp.source as unknown as Record<string, unknown>, WORKSPACE_EXPORT_SOURCE_FIELD_ORDER),
    scope: exp.scope,
    ...(exp.notes !== undefined ? { notes: exp.notes } : {}),
    workspace: exp.workspace,
    entities: orderedEntities,
    ...(exp.secrets !== undefined
      ? { secrets: ordered(exp.secrets as unknown as Record<string, unknown>, WORKSPACE_EXPORT_SECRETS_FIELD_ORDER) }
      : {}),
    meta: ordered(exp.meta as unknown as Record<string, unknown>, WORKSPACE_EXPORT_META_FIELD_ORDER),
  };
  return ordered(projected, WORKSPACE_EXPORT_FIELD_ORDER);
}

export function serializeWorkspaceExport(exp: WorkspaceExport): string {
  const shape = toCanonicalShape(exp);
  const doc = new YAML.Document(shape);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
