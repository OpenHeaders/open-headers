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
 *
 * Persisted shapes (Variable, VaultSecret, Vault, WorkspaceVariables,
 * Environment) are derived from the valibot schemas so drift between the
 * type and the runtime validator is impossible by construction.
 */

import type * as v from 'valibot';
import type {
  EnvironmentSchema,
  VariableSchema,
  VariableTypeSchema,
  VaultSchema,
  VaultSecretSchema,
  WorkspaceVariablesSchema,
} from '../../schemas/variable';

// ── Variable scope ─────────────────────────────────────────────────

/** Resolution priority: vault (highest) > environment > collection > workspace (lowest). */
export type VariableScope = 'vault' | 'environment' | 'collection' | 'workspace';

// ── Variable ───────────────────────────────────────────────────────

export type VariableType = v.InferOutput<typeof VariableTypeSchema>;
export type Variable = v.InferOutput<typeof VariableSchema>;

// ── Vault ──────────────────────────────────────────────────────────

export type VaultSecret = v.InferOutput<typeof VaultSecretSchema>;
export type Vault = v.InferOutput<typeof VaultSchema>;

// ── Environment ────────────────────────────────────────────────────

export type Environment = v.InferOutput<typeof EnvironmentSchema>;

// ── Workspace variables ────────────────────────────────────────────

export type WorkspaceVariables = v.InferOutput<typeof WorkspaceVariablesSchema>;

// ── Resolution (runtime-only, not persisted) ──────────────────────

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
