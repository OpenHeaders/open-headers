/**
 * VariableResolver — centralized {{VAR}} resolution across the 4-scope chain.
 *
 * Resolution priority (highest → lowest):
 *   1. Vault (per-user secrets, never synced)
 *   2. Active environment (switchable: dev/staging/prod)
 *   3. Default environment (falls back here when active misses — ARCHITECTURE §5)
 *   4. Collection (scoped to a collection, synced)
 *   5. Workspace (workspace-wide, synced)
 *
 * This is pure domain logic — no I/O, no framework deps.
 * Both the main process and renderer use this.
 */

import { buildFileRegistry, EMPTY_FILE_REGISTRY, type FileRegistry, resolveFileRef } from '../files';
import type {
  Environment,
  FileRef,
  ResolutionContext,
  ResolvedVariable,
  Variable,
  VariableScope,
  Vault,
  VaultSecret,
  WorkspaceVariables,
} from '../types';
import { parseReference, parseStepRefName, type VariableNamespace } from './namespaces';

// ── Live / step scope helpers ──────────────────────────────────────

/**
 * A snapshot of Live Variables currently available to the resolver.
 *
 * Keys are Live Variable names (referenced as `{{live.<name>}}`);
 * values carry the most recent cached extraction. Callers build this
 * once per compile pass from the live-cache-store + live-variable-store;
 * staleness + async-warm rebuild semantics live in the caller, not here.
 *
 * `isSensitive` defaults to `true` in {@link resolveScopedLive} because
 * live values are overwhelmingly auth tokens / session ids — masking in
 * UI previews is the safer default.
 */
export interface ResolvedLiveValue {
  value: string;
  /** Backing workflow uid — lets UI link back for navigation + ref-counting. */
  workflowUid: string;
  /** When true, the value is past its expiry but still served (async-warm). */
  stale?: boolean;
  /** Override the default `true` sensitivity. Rare — most LVs are tokens. */
  isSensitive?: boolean;
}

export type LiveRegistry = ReadonlyMap<string, ResolvedLiveValue>;

/** An empty {@link LiveRegistry} used as the default when callers haven't wired live vars. */
export const EMPTY_LIVE_REGISTRY: LiveRegistry = new Map();

// ── TOTP registry ──────────────────────────────────────────────────

/**
 * Snapshot of currently-valid TOTP codes, keyed by the vault entry's
 * `name`. Built once per request execution from every `kind: 'totp'`
 * vault entry; resolution looks the code up here instead of computing
 * synchronously (the resolver is sync, RFC-6238 needs async WebCrypto).
 *
 * Critically, callers that don't precompute (DNR rule compile) leave
 * the registry empty — TOTP-kind vault entries then surface as
 * `unset-in-scope` and the rule is dropped from DNR. This is the
 * architectural gate that prevents 30s-lifetime codes from being
 * baked into static rules.
 */
export type TotpRegistry = ReadonlyMap<string, string>;

/** An empty {@link TotpRegistry} — the DNR-compile default. */
export const EMPTY_TOTP_REGISTRY: TotpRegistry = new Map();

/**
 * How the resolver treats a `kind: 'totp'` vault entry whose code is
 * not in the {@link TotpRegistry}.
 *
 *   - `reject` (default) — return `null`. The reference surfaces as
 *     `unset-in-scope`. This is the DNR-compile contract: codes have
 *     ~30s lifetime, they can't be baked into static rules that live
 *     for hours.
 *   - `defer`             — return a {@link ResolvedVariable} with
 *     `deferred: true` and an empty `value`. Renderer-only contexts
 *     (template syntax highlighting, Inspector "exists?" check) opt
 *     into this so a TOTP reference that EXISTS in the vault renders
 *     as "resolvable" (the actual code is computed at request time
 *     in the SW's request-executor, not here).
 *
 * Switching modes is purely a caller policy — the resolver still
 * walks the same data structure. The default `reject` keeps the DNR
 * pipeline architecturally safe by construction; renderer surfaces
 * have to opt in explicitly.
 */
export type DeferredVaultMode = 'reject' | 'defer';

/**
 * Step-capture context — installed by the chain runner ONLY while a
 * Live Workflow step is being resolved. Keys are step ids; values are
 * the step's name → extracted-value map.
 *
 * Presence is the signal: `null` means "no chain context" and
 * `{{step.X.Y}}` surfaces a `step-out-of-context` error; a non-null
 * (even if empty) map means "chain context active" and a missing
 * stepId / captureName falls through to `unset-in-scope`.
 */
export type StepCaptureContext = ReadonlyMap<string, ReadonlyMap<string, string>> | null;

// ── Regex for {{VAR}} matching ─────────────────────────────────────

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

/** Map an explicit namespace to the scope it resolves from. */
const NAMESPACE_TO_SCOPE: Partial<Record<VariableNamespace, VariableScope>> = {
  vault: 'vault',
  env: 'environment',
  collection: 'collection',
  workspace: 'workspace',
  file: 'file',
  live: 'live',
  step: 'step',
};

// ── Resolution errors ──────────────────────────────────────────────

/**
 * Why a specific `{{...}}` reference didn't resolve. Passed to the UI so it
 * can show an actionable message next to the field — not a generic
 * "undefined variable" dead-end. See ARCHITECTURE.md §5 — "errors-as-spec".
 */
export type ResolutionErrorReason =
  | 'empty' // `{{}}` or `{{ns.}}`
  | 'unknown-namespace' // `{{foo.X}}` — foo is not a registered namespace
  | 'reserved-namespace' // `{{dynamic.X}}` — reserved for features not yet shipped
  | 'unset-in-scope' // `{{env.X}}` but X not in active env (and no default fallback)
  | 'step-out-of-context' // `{{step.X.Y}}` outside an active Live Workflow step
  | 'unresolved' // `{{X}}` — nowhere in the 4-scope chain
  // The reference resolved cleanly, but the resolved value isn't a legal
  // hostname for `requestDomains` (scheme, path, wildcard, whitespace,
  // non-ASCII, …). We sanitize at compile time so the rule still ships,
  // but surface the diagnosis so the user knows their variable is shaped
  // wrong.
  | 'invalid-resolved-value';

/**
 * Return shape of the diagnostic scoped-resolver. `failureReason` is
 * set when resolution failed for a reason richer than "not in scope"
 * — today only `step-out-of-context`, but the field exists so future
 * namespaces can surface their own structured failures without
 * changing the callsite.
 */
export interface ScopedResolution {
  resolved: ResolvedVariable | null;
  failureReason?: ResolutionErrorReason;
}

export interface ResolutionError {
  /** The raw text between the braces, trimmed. E.g. "env.API_URL" or "foo.X". */
  reference: string;
  /** Specific failure category. */
  reason: ResolutionErrorReason;
  /**
   * Parsed namespace, or `null` if the reference is flat. `'unknown'` if the
   * segment before the dot is not a registered namespace.
   */
  namespace: VariableNamespace | 'unknown' | null;
  /** The variable name portion (without the namespace prefix). Empty for `empty` reason. */
  variableName: string;
  /** Active env uid at resolution time, or null if "no environment". */
  activeEnvironmentId: string | null;
  /** Default env uid at resolution time, or null if none is configured. */
  defaultEnvironmentId: string | null;
  /** Short human-readable fix hint. UI may replace with a richer message. */
  hint: string;
}

/**
 * Construct a `ResolutionError` for a `{{ref}}` whose resolution
 * succeeded at the resolver layer but whose resolved value is rejected
 * downstream (post-resolve domain sanitization, type coercion failure,
 * …). Lives here so the namespace parsing + hint generation stays
 * colocated with the rest of the error-construction code.
 *
 * `reference` is the raw text between the braces, e.g. `'env.API_HOST'`
 * or `'API_HOST'`. The `customHint` overrides the default per-reason
 * hint when the caller has site-specific advice (e.g. "got
 * `https://...` — drop the scheme").
 */
export function buildPostResolveError(
  reference: string,
  reason: ResolutionErrorReason,
  env: ResolutionEnvSnapshot | undefined,
  customHint?: string,
): ResolutionError {
  const trimmed = reference.trim();
  const parsed = parseReference(trimmed);
  const namespace: VariableNamespace | 'unknown' | null = parsed.ok
    ? parsed.ref.namespace
    : parsed.reason === 'unknown-namespace'
      ? 'unknown'
      : null;
  const variableName = parsed.ok ? parsed.ref.name : trimmed;
  const activeEnvironmentId = env?.activeEnvironmentId ?? null;
  const defaultEnvironmentId = env?.defaultEnvironmentId ?? null;
  return {
    reference: trimmed,
    reason,
    namespace,
    variableName,
    activeEnvironmentId,
    defaultEnvironmentId,
    hint: customHint ?? buildHint(reason, namespace, activeEnvironmentId),
  };
}

function buildHint(
  reason: ResolutionErrorReason,
  namespace: VariableNamespace | 'unknown' | null,
  activeEnvironmentId: string | null,
): string {
  switch (reason) {
    case 'empty':
      return 'Reference is empty. Use {{name}} or {{namespace.name}}.';
    case 'unknown-namespace':
      return 'Unknown namespace. Valid namespaces: env, vault, collection, workspace, file, live, step, dynamic.';
    case 'reserved-namespace':
      if (namespace === 'dynamic') return 'Dynamic variables ($timestamp, $guid, …) are coming soon.';
      return 'This namespace is reserved.';
    case 'unset-in-scope':
      if (namespace === 'env') {
        return activeEnvironmentId
          ? 'Set this variable in Environments → active environment (or in the default environment as a fallback).'
          : 'No active environment is selected. Select one in Environments, or set a default environment.';
      }
      if (namespace === 'vault') return 'Set this secret in the Vault.';
      if (namespace === 'collection') return 'Set this variable in the current collection.';
      if (namespace === 'workspace') return 'Set this variable in Workspace Variables.';
      if (namespace === 'file') return 'Upload this file in Settings → Files (or reference it by its sha256 hash).';
      if (namespace === 'live')
        return 'No Live Variable by that name. Create one in Live Variables, or wait for its first refresh to populate.';
      if (namespace === 'step')
        return 'Step id or capture name not found in this workflow run. Check the workflow step configuration.';
      return 'Not set in this scope.';
    case 'step-out-of-context':
      return 'Step references ({{step.<stepId>.<captureName>}}) are only valid inside a Live Workflow step.';
    case 'unresolved':
      return 'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.';
    case 'invalid-resolved-value':
      return 'Variable resolved to a value Chrome rejects in this slot — check the variable definition and use bare hostnames (no scheme, no path, no wildcard).';
  }
}

// ── VariableResolver ───────────────────────────────────────────────

/**
 * Stateful resolver that holds the current variable scopes.
 * Update scopes when data changes (workspace switch, env switch, etc.).
 */
export class VariableResolver {
  private vault: Vault;
  private environments: Environment[];
  private activeEnvironmentId: string | null;
  private defaultEnvironmentId: string | null;
  private collectionVariables: Map<string, Variable[]>;
  private workspaceVariables: WorkspaceVariables;
  private fileRegistry: FileRegistry;
  private liveRegistry: LiveRegistry;
  private totpRegistry: TotpRegistry;
  private deferredVaultMode: DeferredVaultMode;
  private stepCaptures: StepCaptureContext;

  constructor() {
    this.vault = { schemaVersion: 5, secrets: [] };
    this.environments = [];
    this.activeEnvironmentId = null;
    this.defaultEnvironmentId = null;
    this.collectionVariables = new Map();
    this.workspaceVariables = { schemaVersion: 5, variables: [] };
    this.fileRegistry = EMPTY_FILE_REGISTRY;
    this.liveRegistry = EMPTY_LIVE_REGISTRY;
    this.totpRegistry = EMPTY_TOTP_REGISTRY;
    this.deferredVaultMode = 'reject';
    this.stepCaptures = null;
  }

  // ── Scope setters ────────────────────────────────────────────────

  setVault(vault: Vault): void {
    this.vault = vault;
  }

  setEnvironments(environments: Environment[]): void {
    this.environments = environments;
  }

  /**
   * Identify which environment resolves {{VAR}} references at runtime.
   * `null` means "no environment" (Postman semantics — valid state, not
   * an error; the resolver still resolves from lower scopes and from the
   * default environment if one is set).
   */
  setActiveEnvironmentId(id: string | null): void {
    this.activeEnvironmentId = id;
  }

  /**
   * Configure the workspace's default environment uid. Resolution falls back
   * to this env when the active env doesn't define a variable (or when
   * there is no active env). `null` disables the fallback.
   */
  setDefaultEnvironmentId(id: string | null): void {
    this.defaultEnvironmentId = id;
  }

  setCollectionVariables(collectionId: string, variables: Variable[]): void {
    this.collectionVariables.set(collectionId, variables);
  }

  removeCollectionVariables(collectionId: string): void {
    this.collectionVariables.delete(collectionId);
  }

  setWorkspaceVariables(vars: WorkspaceVariables): void {
    this.workspaceVariables = vars;
  }

  /**
   * Install the workspace's file registry. Accepts the already-built
   * `FileRegistry` (see `@openheaders/core/files`) so callers can
   * share the snapshot across resolver instances. Pass an array for
   * the ergonomic path; we'll build the registry inline.
   */
  setFileRegistry(refsOrRegistry: readonly FileRef[] | FileRegistry): void {
    if (Array.isArray(refsOrRegistry)) {
      this.fileRegistry = buildFileRegistry(refsOrRegistry);
    } else {
      this.fileRegistry = refsOrRegistry as FileRegistry;
    }
  }

  /**
   * Install the Live Variables registry — a snapshot of `{{live.X}}` →
   * {@link ResolvedLiveValue}. Pass an empty map (or
   * {@link EMPTY_LIVE_REGISTRY}) to clear.
   */
  setLiveRegistry(registry: LiveRegistry): void {
    this.liveRegistry = registry;
  }

  /**
   * Install the TOTP registry — a precomputed snapshot of `name → code`
   * for every `kind: 'totp'` vault entry. Pass {@link EMPTY_TOTP_REGISTRY}
   * (the default) on the DNR compile path — TOTP-kind entries then
   * surface as `unset-in-scope` and the rule is dropped from DNR, which
   * is the correct semantics for codes whose validity is bounded by
   * `period` seconds.
   */
  setTotpRegistry(registry: TotpRegistry): void {
    this.totpRegistry = registry;
  }

  /**
   * Pick how to handle a `kind: 'totp'` vault entry whose code is not
   * in the registry. See {@link DeferredVaultMode} for the contract.
   * Defaults to `'reject'` — keeps DNR safe.
   */
  setDeferredVaultMode(mode: DeferredVaultMode): void {
    this.deferredVaultMode = mode;
  }

  /**
   * Install (or clear) the step-capture context for the duration of a
   * Live Workflow step's template resolution. Callers set this
   * immediately before resolving templates in a step's request, then
   * clear it with `setStepCaptures(null)` when the step finishes.
   *
   * `null` means "no chain context active" — resolution of
   * `{{step.X.Y}}` surfaces a `step-out-of-context` error instead of
   * `unset-in-scope`, so the hint can tell the user exactly what's
   * wrong.
   */
  setStepCaptures(ctx: StepCaptureContext): void {
    this.stepCaptures = ctx;
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /**
   * Project a `VaultSecret` to a {@link ResolvedVariable} for the
   * caller's resolution pass.
   *
   * `string` kind returns its stored value verbatim.
   *
   * `totp` kind first tries the precomputed code in the TOTP registry.
   * On miss, the behavior depends on {@link deferredVaultMode}:
   *   - `reject` (DNR-compile default) — return `null` so the entry
   *     surfaces as `unset-in-scope` and the rule is dropped before
   *     reaching Chrome's static rule store.
   *   - `defer` (renderer opt-in) — return a `ResolvedVariable` with
   *     `deferred: true` and an empty value. Renderer surfaces use
   *     this for "is the reference valid?" checks without needing
   *     a real code (the SW computes the actual code at request time).
   */
  private projectVaultValue(secret: VaultSecret, name: string): ResolvedVariable | null {
    if (secret.kind === 'string') {
      return { name, value: secret.value, scope: 'vault', isSensitive: true };
    }
    const code = this.totpRegistry.get(secret.name);
    if (code !== undefined) {
      return { name, value: code, scope: 'vault', isSensitive: true };
    }
    if (this.deferredVaultMode === 'defer') {
      return { name, value: '', scope: 'vault', isSensitive: true, deferred: true };
    }
    return null;
  }

  /**
   * Try to resolve `name` from a single environment by uid. Returns null
   * when the env doesn't exist or doesn't carry `name`.
   */
  private tryResolveFromEnv(envId: string | null, name: string): ResolvedVariable | null {
    if (!envId) return null;
    const env = this.environments.find((e) => e.uid === envId);
    if (!env) return null;
    const envVar = env.variables.find((v) => v.name === name);
    if (!envVar || envVar.value === '') return null;
    return {
      name,
      value: envVar.value,
      scope: 'environment',
      isSensitive: envVar.type === 'secret',
    };
  }

  // ── Resolution ───────────────────────────────────────────────────

  /**
   * Resolve a single variable name across all scopes.
   * Returns the resolved value + which scope it came from, or null if unresolved.
   */
  resolve(name: string, context?: ResolutionContext): ResolvedVariable | null {
    // 1. Vault (highest priority)
    const vaultSecret = this.vault.secrets.find((s) => s.name === name);
    if (vaultSecret) {
      const projected = this.projectVaultValue(vaultSecret, name);
      // String-kind: only fall through on empty string (preserves the
      //   pre-discriminator behavior of "empty = look further down").
      // TOTP-kind: a deferred entry is an explicit "yes, exists" — do
      //   NOT fall through. A null projection means the registry is
      //   empty AND mode='reject' — fall through is correct.
      if (projected !== null && (projected.deferred || projected.value !== '')) {
        return projected;
      }
    }

    // 2. Active environment (context-override first, then configured active).
    const activeEnvId = context?.environmentId ?? this.activeEnvironmentId;
    const fromActive = this.tryResolveFromEnv(activeEnvId, name);
    if (fromActive) return fromActive;

    // 3. Default environment — fallback when active doesn't define `name`
    //    (or when there's no active env at all).
    if (this.defaultEnvironmentId && this.defaultEnvironmentId !== activeEnvId) {
      const fromDefault = this.tryResolveFromEnv(this.defaultEnvironmentId, name);
      if (fromDefault) return fromDefault;
    }

    // 4. Collection (if context specifies one)
    if (context?.collectionId) {
      const collVars = this.collectionVariables.get(context.collectionId);
      if (collVars) {
        const collVar = collVars.find((v) => v.name === name);
        if (collVar && collVar.value !== '') {
          return {
            name,
            value: collVar.value,
            scope: 'collection',
            isSensitive: collVar.type === 'secret',
          };
        }
      }
    }

    // 5. Workspace (lowest priority)
    const workspaceVar = this.workspaceVariables.variables.find((v) => v.name === name);
    if (workspaceVar && workspaceVar.value !== '') {
      return {
        name,
        value: workspaceVar.value,
        scope: 'workspace',
        isSensitive: workspaceVar.type === 'secret',
      };
    }

    return null;
  }

  /**
   * Resolve a variable restricted to a single namespace.
   * Flat `{{X}}` callers should use {@link resolve}; this is the
   * explicit-namespace (`{{env.X}}`, `{{vault.X}}`, etc.) path.
   *
   * Returns `null` for any miss — the `resolveTemplate` caller decides
   * whether the miss is "unset in scope" or the more specific
   * `step-out-of-context`. For callers that need that distinction, use
   * {@link resolveScopedWithDiagnostics} instead.
   */
  resolveScoped(name: string, namespace: VariableNamespace, context?: ResolutionContext): ResolvedVariable | null {
    return this.resolveScopedWithDiagnostics(name, namespace, context).resolved;
  }

  /**
   * Variant of {@link resolveScoped} that returns a diagnostic failure
   * reason when resolution fails. Enables callers (notably
   * `resolveTemplate`) to distinguish "namespace reserved / not
   * available in this context" from a plain "unset-in-scope" miss.
   */
  resolveScopedWithDiagnostics(
    name: string,
    namespace: VariableNamespace,
    context?: ResolutionContext,
  ): ScopedResolution {
    const scope = NAMESPACE_TO_SCOPE[namespace];
    if (!scope) return { resolved: null };

    switch (scope) {
      case 'vault': {
        const secret = this.vault.secrets.find((s) => s.name === name);
        if (!secret) return { resolved: null };
        const projected = this.projectVaultValue(secret, name);
        if (projected === null) return { resolved: null };
        // Empty string-kind value falls through to `unset-in-scope` so
        // the user fixes the underlying empty entry. Deferred TOTP
        // entries report as resolved — the actual code lands at
        // request execution.
        if (!projected.deferred && projected.value === '') return { resolved: null };
        return { resolved: projected };
      }
      case 'environment': {
        const activeEnvId = context?.environmentId ?? this.activeEnvironmentId;
        const fromActive = this.tryResolveFromEnv(activeEnvId, name);
        if (fromActive) return { resolved: fromActive };
        if (this.defaultEnvironmentId && this.defaultEnvironmentId !== activeEnvId) {
          return { resolved: this.tryResolveFromEnv(this.defaultEnvironmentId, name) };
        }
        return { resolved: null };
      }
      case 'collection': {
        if (!context?.collectionId) return { resolved: null };
        const collVars = this.collectionVariables.get(context.collectionId);
        if (!collVars) return { resolved: null };
        const collVar = collVars.find((v) => v.name === name);
        if (collVar && collVar.value !== '') {
          return {
            resolved: {
              name,
              value: collVar.value,
              scope: 'collection',
              isSensitive: collVar.type === 'secret',
            },
          };
        }
        return { resolved: null };
      }
      case 'workspace': {
        const wsVar = this.workspaceVariables.variables.find((v) => v.name === name);
        if (wsVar && wsVar.value !== '') {
          return {
            resolved: {
              name,
              value: wsVar.value,
              scope: 'workspace',
              isSensitive: wsVar.type === 'secret',
            },
          };
        }
        return { resolved: null };
      }
      case 'file': {
        // `{{file.X}}` resolves by filename OR explicit `sha256:<hex>`.
        // Returns the hash string — the BYTES are looked up by the
        // request executor via the per-platform BlobStore. Keeping
        // the resolver string-only preserves its synchronous-pure
        // contract; binary attachment is the executor's concern.
        const fileRef = resolveFileRef(this.fileRegistry, name);
        if (!fileRef) return { resolved: null };
        return {
          resolved: {
            name,
            value: fileRef.hash,
            scope: 'file',
            // File refs are not sensitive in the secret sense — the
            // hash is content-derived and doesn't reveal bytes. A
            // later tier might mark blobs uploaded from the vault
            // scope as sensitive; v1 treats them as plain data.
            isSensitive: false,
          },
        };
      }
      case 'live': {
        const entry = this.liveRegistry.get(name);
        if (!entry) return { resolved: null };
        return {
          resolved: {
            name,
            value: entry.value,
            scope: 'live',
            // Default to masked — live values are overwhelmingly tokens.
            isSensitive: entry.isSensitive ?? true,
          },
        };
      }
      case 'step': {
        // Two distinct failure modes: no chain context at all (fires
        // a `step-out-of-context` error so the hint explains the fix),
        // or chain context exists but the specific stepId / capture
        // isn't available (plain `unset-in-scope`).
        if (this.stepCaptures == null) {
          return { resolved: null, failureReason: 'step-out-of-context' };
        }
        const parts = parseStepRefName(name);
        if (!parts) return { resolved: null };
        const step = this.stepCaptures.get(parts.stepId);
        if (!step) return { resolved: null };
        const value = step.get(parts.captureName);
        if (value === undefined) return { resolved: null };
        return {
          resolved: {
            name,
            value,
            scope: 'step',
            // Treat step values as sensitive by default — they often
            // carry intermediate auth tokens that feed into later
            // steps. Masking in UI previews is the safer default.
            isSensitive: true,
          },
        };
      }
    }
  }

  /**
   * Resolve all {{VAR}} references in a template string.
   *
   * Supports both flat (`{{X}}`) and explicit (`{{env.X}}`, `{{vault.X}}`, …)
   * forms. Unresolved variables are left as-is: `{{UNKNOWN}}` stays in the
   * output. This is intentional — for DNR compatibility, literal references
   * must pass through when unresolved. The caller surfaces errors via the
   * returned `errors` list (one structured `ResolutionError` per unique
   * unresolved reference).
   */
  resolveTemplate(
    template: string,
    context?: ResolutionContext,
  ): { result: string; variables: TemplateVariable[]; errors: ResolutionError[] } {
    return resolveTemplate(
      template,
      (name) => this.resolve(name, context),
      (name, ns) => this.resolveScopedWithDiagnostics(name, ns, context),
      {
        activeEnvironmentId: context?.environmentId ?? this.activeEnvironmentId,
        defaultEnvironmentId: this.defaultEnvironmentId,
      },
    );
  }

  /**
   * Snapshot of the active/default env IDs the resolver is currently
   * configured with. Used by post-resolve diagnostic builders that need
   * to construct `ResolutionError` shapes carrying the same env context
   * the live resolver did.
   */
  getEnvSnapshot(context?: ResolutionContext): ResolutionEnvSnapshot {
    return {
      activeEnvironmentId: context?.environmentId ?? this.activeEnvironmentId,
      defaultEnvironmentId: this.defaultEnvironmentId,
    };
  }

  /**
   * Find all variable names referenced in a template string.
   */
  extractVariableNames(template: string): string[] {
    const names: string[] = [];
    const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
    for (const match of template.matchAll(regex)) {
      const name = match[1].trim();
      if (!names.includes(name)) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Check if all variables in a template are resolvable.
   */
  allResolved(template: string, context?: ResolutionContext): boolean {
    const names = this.extractVariableNames(template);
    return names.every((name) => this.resolve(name, context) !== null);
  }

  /**
   * Get all unresolved variable names in a template.
   */
  getUnresolved(template: string, context?: ResolutionContext): string[] {
    const names = this.extractVariableNames(template);
    return names.filter((name) => this.resolve(name, context) === null);
  }
}

// ── Standalone functions ───────────────────────────────────────────

export interface TemplateVariable {
  name: string;
  resolved: boolean;
  value?: string;
  scope?: VariableScope;
  /**
   * Whether the resolved source marked this variable as sensitive.
   * Lets UIs mask secret values by default (vault secrets, env vars
   * tagged `type: 'secret'`). Absent on unresolved references.
   */
  isSensitive?: boolean;
}

/**
 * Resolve a single variable using a lookup function.
 * Standalone version for cases where you don't need the full VariableResolver.
 */
export function resolveVariable(
  name: string,
  lookup: (name: string) => ResolvedVariable | null,
): ResolvedVariable | null {
  return lookup(name);
}

/**
 * Environment identity snapshot attached to resolution errors.
 *
 * When the resolver reports that `{{env.API_URL}}` is unset, the UI needs to
 * know *which* active env was checked and whether a default was available.
 * The caller passes this snapshot in so error objects carry it through.
 */
export interface ResolutionEnvSnapshot {
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
}

/**
 * Scoped-lookup function shape accepted by {@link resolveTemplate}.
 *
 * Callers may return either a bare `ResolvedVariable | null` (simple
 * path — a miss surfaces as `unset-in-scope`) or a {@link ScopedResolution}
 * carrying a richer `failureReason` (so `{{step.X.Y}}` without context
 * can surface as `step-out-of-context`). The standalone function
 * detects which shape the return carries; callers don't have to pick.
 */
export type ScopedLookupFn = (name: string, namespace: VariableNamespace) => ResolvedVariable | null | ScopedResolution;

function toScopedResolution(ret: ResolvedVariable | null | ScopedResolution): ScopedResolution {
  if (ret == null) return { resolved: null };
  if ('resolved' in ret) return ret;
  return { resolved: ret };
}

/**
 * Resolve all `{{...}}` references in a template string.
 *
 * Accepts two lookup functions so the same implementation handles flat
 * ({@link lookup}, used for `{{X}}`) and scoped ({@link scopedLookup}, used
 * for `{{env.X}}` et al.) forms. If `scopedLookup` is omitted, explicit
 * references fall back to the flat lookup — preserves backward compat for
 * callers who haven't wired namespace support yet.
 *
 * Unresolved references are left literal in the output. Unknown namespaces
 * and reserved namespaces (`dynamic`) also leave the reference literal —
 * the caller walks the returned `errors` list to surface issues in the UI.
 */
export function resolveTemplate(
  template: string,
  lookup: (name: string) => ResolvedVariable | null,
  scopedLookup?: ScopedLookupFn,
  env?: ResolutionEnvSnapshot,
): { result: string; variables: TemplateVariable[]; errors: ResolutionError[] } {
  const variables: TemplateVariable[] = [];
  const errors: ResolutionError[] = [];
  const seen = new Set<string>();
  const activeEnvironmentId = env?.activeEnvironmentId ?? null;
  const defaultEnvironmentId = env?.defaultEnvironmentId ?? null;

  const result = template.replace(TEMPLATE_REGEX, (match, inner: string) => {
    const parsed = parseReference(inner);

    if (!parsed.ok) {
      // Parse-level failure — emit one structured error per unique raw ref.
      const key = `!${parsed.raw}`;
      if (!seen.has(key)) {
        seen.add(key);
        variables.push({ name: parsed.raw, resolved: false });

        if (parsed.reason === 'unknown-namespace') {
          const ns: VariableNamespace | 'unknown' = 'unknown';
          errors.push({
            reference: parsed.raw,
            reason: 'unknown-namespace',
            namespace: ns,
            variableName: parsed.raw.slice((parsed.namespace?.length ?? 0) + 1),
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('unknown-namespace', ns, activeEnvironmentId),
          });
        } else {
          errors.push({
            reference: parsed.raw,
            reason: 'empty',
            namespace: null,
            variableName: '',
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('empty', null, activeEnvironmentId),
          });
        }
      }
      return match;
    }

    const { ref } = parsed;
    const key = ref.namespace ? `${ref.namespace}.${ref.name}` : ref.name;

    let resolution: ScopedResolution;
    if (ref.namespace === null) {
      resolution = { resolved: lookup(ref.name) };
    } else if (scopedLookup) {
      resolution = toScopedResolution(scopedLookup(ref.name, ref.namespace));
    } else {
      // Caller didn't wire namespace support — treat as flat for backward
      // compat. Semantic: `{{env.X}}` behaves like `{{X}}` until the
      // caller opts into scoped lookup.
      resolution = { resolved: lookup(ref.name) };
    }

    const resolved = resolution.resolved;

    if (!seen.has(key)) {
      seen.add(key);
      if (resolved) {
        variables.push({
          name: key,
          resolved: true,
          value: resolved.value,
          scope: resolved.scope,
          isSensitive: resolved.isSensitive,
        });
      } else {
        variables.push({ name: key, resolved: false });

        // Emit a structured error per unique unresolved reference.
        if (ref.namespace === 'dynamic') {
          errors.push({
            reference: ref.raw,
            reason: 'reserved-namespace',
            namespace: ref.namespace,
            variableName: ref.name,
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('reserved-namespace', ref.namespace, activeEnvironmentId),
          });
        } else if (resolution.failureReason === 'step-out-of-context') {
          errors.push({
            reference: ref.raw,
            reason: 'step-out-of-context',
            namespace: ref.namespace,
            variableName: ref.name,
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('step-out-of-context', ref.namespace, activeEnvironmentId),
          });
        } else if (ref.namespace) {
          errors.push({
            reference: ref.raw,
            reason: 'unset-in-scope',
            namespace: ref.namespace,
            variableName: ref.name,
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('unset-in-scope', ref.namespace, activeEnvironmentId),
          });
        } else {
          errors.push({
            reference: ref.raw,
            reason: 'unresolved',
            namespace: null,
            variableName: ref.name,
            activeEnvironmentId,
            defaultEnvironmentId,
            hint: buildHint('unresolved', null, activeEnvironmentId),
          });
        }
      }
    }

    return resolved ? resolved.value : match;
  });

  return { result, variables, errors };
}
