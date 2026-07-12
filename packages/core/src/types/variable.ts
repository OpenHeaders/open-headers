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
  TotpAlgorithmSchema,
  VariableSchema,
  VariableTypeSchema,
  VaultSchema,
  VaultSecretClientCertificateSchema,
  VaultSecretKindSchema,
  VaultSecretSchema,
  VaultSecretStringSchema,
  VaultSecretTotpSchema,
  WorkspaceVariablesSchema,
} from '../schemas/variable';

// ── Variable scope ─────────────────────────────────────────────────

/**
 * Resolution priority: vault (highest) > environment > collection > workspace (lowest).
 *
 * `file` is a distinct, content-addressed scope — `{{file.X}}` resolves to the
 * file's sha256 hash string (NOT bytes). Unlike the other scopes, `file` is
 * not part of the flat `{{X}}` walk; it's only reachable via the explicit
 * `{{file.X}}` form to keep the 4-scope precedence semantics stable.
 *
 * `live` resolves an auto-refreshing Live Variable — the extracted value
 * of a Live Workflow capture. Only reachable via the explicit `{{live.X}}`
 * form so rule templates never silently pick up an in-flight refresh
 * value when a workspace/env variable of the same name exists.
 *
 * `step` resolves a capture from an in-flight Live Workflow chain —
 * `{{step.<stepId>.<captureName>}}`. Only meaningful while a chain is
 * executing; surfaces a `step-out-of-context` error when absent.
 *
 * `dynamic` resolves a built-in generator (`{{dynamic.uuid}}`,
 * `{{dynamic.timestamp}}`, …) — a fresh value per resolution pass.
 * Only reachable via the explicit form; never part of the flat walk.
 */
export type VariableScope = 'vault' | 'environment' | 'collection' | 'workspace' | 'file' | 'live' | 'step' | 'dynamic';

// ── Variable ───────────────────────────────────────────────────────

export type VariableType = v.InferOutput<typeof VariableTypeSchema>;
export type Variable = v.InferOutput<typeof VariableSchema>;

// ── Vault ──────────────────────────────────────────────────────────

/**
 * Vault entries are kind-discriminated:
 *   - `string` — literal value returned verbatim by `{{vault.X}}`.
 *   - `totp`   — base32 seed + RFC 6238 parameters; `{{vault.X}}` resolves
 *                to the current code, never the seed.
 *   - `client-certificate` — TLS client cert + key PEM pair (+ optional
 *                passphrase). Not template-resolvable — requests reference
 *                it by NAME via `clientCertificateRef` and the executor
 *                resolves the pair at send time.
 *
 * All kinds are local-per-device (highest scope priority, never synced).
 * The discriminated union keeps the storage shape, the suggester, the
 * resolver, and the editor in lockstep — adding a future kind (HOTP,
 * etc.) is one schema variant + one resolver arm + one row renderer.
 */
export type VaultSecretKind = v.InferOutput<typeof VaultSecretKindSchema>;
export type TotpAlgorithm = v.InferOutput<typeof TotpAlgorithmSchema>;
export type VaultSecretString = v.InferOutput<typeof VaultSecretStringSchema>;
export type VaultSecretTotp = v.InferOutput<typeof VaultSecretTotpSchema>;
export type VaultSecretClientCertificate = v.InferOutput<typeof VaultSecretClientCertificateSchema>;
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
  /**
   * Set on a resolved-but-deferred vault TOTP entry — the entry exists
   * but its code wasn't precomputed in this resolver pass. Callers that
   * SERIALIZE the value (DNR compile, request executor) must treat this
   * as unresolved; callers that only need an existence check (renderer
   * syntax highlighting, Inspector) treat it as resolved. Only emitted
   * when the resolver's `DeferredVaultMode` is `'defer'`; the default
   * `'reject'` returns `null` instead of a deferred entry.
   */
  deferred?: boolean;
}

/** Resolution context — determines which scopes to check. */
export interface ResolutionContext {
  /** Override the active environment for this resolution only. When
   *  omitted, the resolver uses its configured active environment. */
  environmentId?: string;
  /** Collection uid for collection-scoped variable lookup. */
  collectionId?: string;
}
