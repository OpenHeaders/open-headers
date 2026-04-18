/**
 * Variable and scoping types for the git-based workspace format.
 *
 * Variables power {{VAR}} interpolation in requests, rules, and domains.
 * Four scopes with strict priority (Postman model):
 *   vault (secrets) > environment > collection > workspace (globals)
 *
 * On disk:
 *   workspace-vars.yaml           — workspace-level variables
 *   workspace-vars.secret.yaml    — workspace secrets (.gitignored)
 *   environments/staging.yaml     — environment variables (flat key-value)
 *   environments/prod.secret.yaml — environment secrets (.gitignored)
 *   _collection.yaml vars:        — collection-scoped variables
 */

// ── Variable scope ─────────────────────────────────────────────────

/** Resolution priority: vault (highest) > environment > collection > workspace (lowest). */
export type VariableScope = 'vault' | 'environment' | 'collection' | 'workspace';

// ── Variable ───────────────────────────────────────────────────────

export interface Variable {
  name: string;
  value: string;
  type: 'default' | 'secret';
}

// ── Vault ──────────────────────────────────────────────────────────

/** A secret stored in the local vault. Encrypted at rest, never synced via Git. */
export interface VaultSecret {
  name: string;
  value: string;
}

export interface Vault {
  secrets: VaultSecret[];
}

// ── Environment ────────────────────────────────────────────────────

export interface Environment {
  /** Stable identity; generated on create, never changes. Used for all
   *  in-memory links and the `activeEnvironmentId` pointer. */
  uid: string;
  /** Display name (e.g. "staging"). Freely renamed; never used as an
   *  identity key. For team workspaces, also drives the YAML filename. */
  name: string;
  /** Relative path within workspace for team workspaces (e.g.
   *  "environments/staging.yaml"). Optional — omitted for personal
   *  workspaces, which live purely in chrome.storage.local. */
  path?: string;
  variables: Variable[];
}

// ── Workspace variables ────────────────────────────────────────────

/** Workspace-wide variables. Lowest resolution priority. */
export interface WorkspaceVariables {
  variables: Variable[];
}

// ── Resolution ─────────────────────────────────────────────────────

/** Result of resolving a single {{VAR}} reference. */
export interface ResolvedVariable {
  name: string;
  value: string;
  scope: VariableScope;
  isSensitive: boolean;
}

/** Resolution context — determines which scopes to check. */
export interface ResolutionContext {
  /** Override the active environment for this resolution only. When
   *  omitted, the resolver uses its configured active environment. */
  environmentId?: string;
  /** Collection uid for collection-scoped variable lookup. */
  collectionId?: string;
}
