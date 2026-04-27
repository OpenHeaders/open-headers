/**
 * Per-entity canonical YAML serializer.
 *
 * Used by the import preview's diff pane: serializing a target's
 * existing entity AND the incoming entity through the same canonical
 * shape (key order from `../codec/yaml/ordering`) means a Monaco diff
 * highlights actual content drift, not key-order churn.
 *
 * Mirrors the entity-bag projection inside `serializeWorkspaceExport`
 * but emits a standalone document per entity. Singletons
 * (`workspaceVars`, `vault`) get their own helpers.
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
  TEMPLATE_FIELD_ORDER,
  VAULT_FIELD_ORDER,
  WORKSPACE_VARIABLES_FIELD_ORDER,
} from '../codec/yaml/ordering';

export type SerializableEntityKind =
  | 'rule'
  | 'request'
  | 'template'
  | 'environment'
  | 'liveWorkflow'
  | 'liveVariable'
  | 'collection'
  | 'folder'
  | 'workspaceVars'
  | 'vault';

const ORDER_BY_KIND: Record<SerializableEntityKind, readonly string[]> = {
  rule: RULE_FIELD_ORDER,
  request: REQUEST_FIELD_ORDER,
  template: TEMPLATE_FIELD_ORDER,
  environment: ENVIRONMENT_FIELD_ORDER,
  liveWorkflow: LIVE_WORKFLOW_FIELD_ORDER,
  liveVariable: LIVE_VARIABLE_FIELD_ORDER,
  collection: COLLECTION_FIELD_ORDER,
  folder: FOLDER_FIELD_ORDER,
  workspaceVars: WORKSPACE_VARIABLES_FIELD_ORDER,
  vault: VAULT_FIELD_ORDER,
};

function ordered(value: Record<string, unknown>, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of order) {
    const v = value[k];
    if (v !== undefined) out[k] = v;
  }
  for (const k of Object.keys(value)) {
    if (!order.includes(k) && value[k] !== undefined) out[k] = value[k];
  }
  return out;
}

export function serializeEntityYaml(kind: SerializableEntityKind, entity: unknown): string {
  if (entity === null || entity === undefined || typeof entity !== 'object') return '';
  const order = ORDER_BY_KIND[kind];
  const shape = ordered(entity as Record<string, unknown>, order);
  const doc = new YAML.Document(shape);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
