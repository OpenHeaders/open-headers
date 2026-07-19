/**
 * Workspace-tree layout constants — the single authority for where each
 * entity's files live inside a materialized workspace folder
 * (SYNC_ENGINE_DESIGN.md §23.8, GIT_PLAN.md §4).
 *
 * Placement of tree-resident entities (collections, folders, requests,
 * rules, templates, specs, live workflows/variables) comes from the
 * entity's own mutator-maintained `path` field; this module only names
 * the files inside each entity directory plus the root-level singleton
 * files. Environments have no `path` — their file name derives from
 * `toFolderName(name, uid)`.
 */

import type { Environment } from '../types/variable';
import { toFolderName } from '../utils/workspace';

/** Root identity manifest — the clone join key lives here. */
export const WORKSPACE_MANIFEST_FILE = 'workspace.yaml';

/** Workspace-scope non-secret variables. */
export const WORKSPACE_VARS_FILE = 'workspace-vars.yaml';

/** Vault — matched by the `*.secret.yaml` gitignore rule, never committed. */
export const VAULT_FILE = 'workspace-vars.secret.yaml';

export const ENVIRONMENTS_DIR = 'environments';

/** Engine sidecar directory — gitignored, rebuildable (§23.9). */
export const OH_SIDECAR_DIR = '.oh';

export const GITIGNORE_FILE = '.gitignore';

/**
 * Authored at bind (GIT_PLAN.md §10 Phase 2). `.oh/` is the engine's
 * cache tier; `*.secret.yaml` keeps environment secrets and the vault
 * out of every commit (the committed `.secret.yaml.template` skeletons
 * carry the key names teammates need to fill in).
 */
export const WORKSPACE_GITIGNORE_CONTENT = '.oh/\n*.secret.yaml\n';

// ── Per-entity manifest file names (one per entity directory) ────────

export const COLLECTION_MANIFEST_FILE = '_collection.yaml';
export const FOLDER_MANIFEST_FILE = '_folder.yaml';
export const RULE_MANIFEST_FILE = 'rule.yaml';
export const REQUEST_MANIFEST_FILE = 'request.yaml';
export const GRPC_REQUEST_MANIFEST_FILE = 'grpc.yaml';
export const WEBSOCKET_REQUEST_MANIFEST_FILE = 'websocket.yaml';
export const TEMPLATE_MANIFEST_FILE = 'template.yaml';
export const SPEC_MANIFEST_FILE = 'spec.yaml';
export const LIVE_WORKFLOW_MANIFEST_FILE = 'workflow.yaml';
export const LIVE_VARIABLE_MANIFEST_FILE = 'variable.yaml';

// ── Environment file naming (no `path` field — name-derived) ─────────

export const SECRET_FILE_SUFFIX = '.secret.yaml';
export const SECRET_TEMPLATE_FILE_SUFFIX = '.secret.yaml.template';

/** `environments/<slug>-<uid>.yaml`. */
export function environmentFilePath(environment: Pick<Environment, 'uid' | 'name'>): string {
  return `${ENVIRONMENTS_DIR}/${toFolderName(environment.name, environment.uid)}.yaml`;
}

/** `environments/<slug>-<uid>.secret.yaml` — gitignored. */
export function environmentSecretFilePath(environment: Pick<Environment, 'uid' | 'name'>): string {
  return `${ENVIRONMENTS_DIR}/${toFolderName(environment.name, environment.uid)}${SECRET_FILE_SUFFIX}`;
}

/** `environments/<slug>-<uid>.secret.yaml.template` — committed skeleton. */
export function environmentSecretTemplateFilePath(environment: Pick<Environment, 'uid' | 'name'>): string {
  return `${ENVIRONMENTS_DIR}/${toFolderName(environment.name, environment.uid)}${SECRET_TEMPLATE_FILE_SUFFIX}`;
}

// ── Unknown-field document keys ──────────────────────────────────────

/**
 * Keys for the per-document unknown-field rows map ({@link
 * TreeUnknownFields}). Entities key by uid; the three singleton
 * documents use these reserved keys (uids are 8-char lowercase
 * alphanumerics, so the bracketed forms can never collide).
 */
export const WORKSPACE_DOC_KEY = '[workspace]';
export const WORKSPACE_VARS_DOC_KEY = '[workspace-vars]';
export const VAULT_DOC_KEY = '[vault]';
