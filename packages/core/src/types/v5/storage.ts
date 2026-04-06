/**
 * Storage types for v5.
 *
 * Defines the on-disk file formats for the v5 directory tree:
 *
 *   workspace-root/
 *   ├── .openheaders/
 *   │   ├── workspace.json        # WorkspaceManifest
 *   │   ├── workspace-variables.json # WorkspaceVariablesFile
 *   │   └── vault.enc             # encrypted VaultFile (.gitignored)
 *   ├── collections/
 *   │   └── <name>/
 *   │       ├── collection.json   # CollectionFile
 *   │       └── <folder>/
 *   │           └── <name>.request.json  # RequestFile
 *   ├── rules/
 *   │   └── <tag>--<name>.rule.json      # RuleFile
 *   ├── environments/
 *   │   └── <name>.env.json       # EnvironmentFile (synced)
 *   ├── environments.local/
 *   │   └── <name>.values.json    # EnvironmentValuesFile (.gitignored)
 *   ├── recordings/
 *   │   └── <name>.recording.json
 *   └── .gitignore
 */

import type { Collection } from './collection';
import type { Request } from './request';
import type { Rule } from './rule';
import type { EnvironmentLocalValues, EnvironmentManifest, Variable, Vault, WorkspaceVariables } from './variable';

// ── Version ────────────────────────────────────────────────────────

export const STORAGE_VERSION = '5.0.0';

export interface StorageVersion {
  version: string;
  migratedFrom?: string;
  migratedAt?: string;
}

// ── Workspace manifest (.openheaders/workspace.json) ───────────────

export interface WorkspaceManifest extends StorageVersion {
  id: string;
  name: string;
  type: 'personal' | 'team';
  description?: string;
  /** Git remote URL (team workspaces only). */
  gitUrl?: string;
  /** Git branch (team workspaces only). */
  gitBranch?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Workspace variables file (.openheaders/workspace-variables.json)

export interface WorkspaceVariablesFile extends StorageVersion {
  variables: Variable[];
}

// ── Vault file (.openheaders/vault.enc) ────────────────────────────

/**
 * Vault file structure. The entire file is encrypted on disk.
 * This represents the decrypted content.
 */
export interface VaultFile extends StorageVersion {
  vault: Vault;
}

// ── Collection file (collections/<name>/collection.json) ───────────

export type CollectionFile = StorageVersion & Collection;

// ── Request file (collections/<name>/<path>/<name>.request.json) ───

export type RequestFile = StorageVersion & Request;

// ── Rule file (rules/<tag>--<name>.rule.json) ──────────────────────

export type RuleFile = StorageVersion & Rule;

// ── Environment file (environments/<name>.env.json) ────────────────
// Synced via Git — contains variable definitions but NOT secret values.

export type EnvironmentFile = StorageVersion & EnvironmentManifest;

// ── Environment values (environments.local/<name>.values.json) ─────
// Local only, .gitignored — contains actual secret values.

export type EnvironmentValuesFile = StorageVersion & EnvironmentLocalValues;

// ── Team sync config ───────────────────────────────────────────────

/**
 * Team sync config format (replaces v4 open-headers-config.json).
 *
 * In v5, the Git repo IS the directory tree — there's no separate
 * single-file export format. This type exists for backwards compatibility
 * with v4 imports and as the schema for the initial team config push.
 */
export interface TeamConfigV4Compat {
  version: string;
  environmentSchema?: {
    environments: Record<string, { variables: Array<{ name: string; isSecret: boolean }> }>;
    variableDefinitions?: Record<string, { description: string; sensitive: boolean; usedIn: string[] }>;
  };
  sources?: Array<Record<string, unknown>>;
  rules?: {
    header?: Array<Record<string, unknown>>;
    request?: Array<Record<string, unknown>>;
    response?: Array<Record<string, unknown>>;
  };
  proxyRules?: Array<Record<string, unknown>>;
  rulesMetadata?: {
    totalRules: number;
    lastUpdated: string;
  };
}

// ── Gitignore template ─────────────────────────────────────────────

export const V5_GITIGNORE = `# OpenHeaders v5 — local-only files
.openheaders/vault.enc
environments.local/
*.values.json

# Runtime state
*.cache.json
`;
