/**
 * Variable and scoping types for v5.
 *
 * Variables power {{VAR}} interpolation in requests, rules, and domains.
 * Four scopes with strict priority: Vault > Environment > Collection > Globals.
 *
 * Storage rules:
 * - Vault: encrypted on disk, never synced via Git
 * - Environment: names+types synced, actual values are local-only (.gitignored)
 * - Collection: synced (non-secret defaults only)
 * - Globals: synced (non-secret defaults only)
 */

// ── Variable scope ─────────────────────────────────────────────────

/** Resolution priority: secret (highest) → environment → collection → workspace (lowest). */
export type VariableScope = 'secret' | 'environment' | 'collection' | 'workspace';

/** Where the variable's value comes from. */
export type VariableValueSource = 'static' | 'file';

// ── Variable ───────────────────────────────────────────────────────

export interface Variable {
  name: string;
  value: string;
  type: 'default' | 'secret';
  source: VariableValueSource;
  /** File path (when source is 'file'). */
  filePath?: string;
  /** File format for parsing (when source is 'file'). */
  fileFormat?: 'env' | 'json' | 'yaml';
  /** Key within file to extract value (when source is 'file'). */
  fileKey?: string;
  updatedAt?: string;
}

// ── Vault ──────────────────────────────────────────────────────────

/**
 * A secret stored in the local vault.
 * Vault has the highest resolution priority.
 * Encrypted at rest, never synced via Git, never exported.
 */
export interface VaultSecret {
  name: string;
  /** Encrypted at rest on disk, decrypted in memory. */
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vault {
  secrets: VaultSecret[];
}

// ── Environment ────────────────────────────────────────────────────

export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
  isActive: boolean;
}

/**
 * Variable definition synced via Git (name + metadata, NO value).
 * Teammates see which variables exist and whether they're secret,
 * then fill in their own values locally.
 */
export interface EnvironmentVariableDefinition {
  name: string;
  type: 'default' | 'secret';
  source: VariableValueSource;
  description?: string;
}

/**
 * Environment manifest stored on disk and synced via Git.
 * Contains variable definitions but NOT secret values.
 */
export interface EnvironmentManifest {
  id: string;
  name: string;
  variables: EnvironmentVariableDefinition[];
}

/**
 * Environment values stored locally (.gitignored).
 * Maps variable names to their actual values.
 */
export interface EnvironmentLocalValues {
  environmentId: string;
  values: Record<string, string>;
}

// ── Workspace ─────────────────────────────────────────────────────

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

/** Resolution context — determines which collection scope to check. */
export interface ResolutionContext {
  /** Active environment ID. */
  environmentId?: string;
  /** Collection ID for collection-scoped variable lookup. */
  collectionId?: string;
}
