import { buildFileRegistry, EMPTY_FILE_REGISTRY, type FileRegistry, resolveFileRef } from '../../files';
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
} from '../../types';
import { resolveDynamicValue } from '../dynamic';
import { parseStepRefName, type VariableNamespace } from '../namespaces';
import type { ResolutionEnvSnapshot, ResolutionError, ScopedResolution } from './errors';
import {
  type DeferredVaultMode,
  EMPTY_LIVE_REGISTRY,
  EMPTY_SECRET_MANAGER_FAILURES,
  EMPTY_SECRET_MANAGER_REGISTRY,
  EMPTY_TOTP_REGISTRY,
  type LiveRegistry,
  type SecretManagerFailures,
  type SecretManagerRegistry,
  type StepCaptureContext,
  type TotpRegistry,
} from './registries';
import { resolveTemplate, TEMPLATE_REGEX, type TemplateVariable } from './template';

/** Map an explicit namespace to the scope it resolves from. */
const NAMESPACE_TO_SCOPE: Partial<Record<VariableNamespace, VariableScope>> = {
  vault: 'vault',
  env: 'environment',
  collection: 'collection',
  workspace: 'workspace',
  file: 'file',
  live: 'live',
  step: 'step',
  dynamic: 'dynamic',
};

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
  private secretManagerRegistry: SecretManagerRegistry;
  private secretManagerFailures: SecretManagerFailures;
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
    this.secretManagerRegistry = EMPTY_SECRET_MANAGER_REGISTRY;
    this.secretManagerFailures = EMPTY_SECRET_MANAGER_FAILURES;
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
   * Install the secret-manager registry — a per-execution snapshot of
   * `name → provider-resolved value` for `kind: 'secret-manager'` vault
   * entries, plus the typed per-name failures from the same build. Like
   * the TOTP registry, callers that don't precompute (DNR compile) leave
   * both empty — entries then surface as unresolved and no
   * provider-fetched value can reach a persistent rule.
   */
  setSecretManagerRegistry(
    registry: SecretManagerRegistry,
    failures: SecretManagerFailures = EMPTY_SECRET_MANAGER_FAILURES,
  ): void {
    this.secretManagerRegistry = registry;
    this.secretManagerFailures = failures;
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
   *
   * `client-certificate` kind always returns `null` — the PEM pair only
   * leaves the vault through the executor's `clientCertificateRef`
   * resolution, never through `{{vault.X}}`.
   *
   * `secret-manager` kind mirrors `totp`: the value comes from the
   * per-execution {@link secretManagerRegistry}; on miss the
   * {@link deferredVaultMode} contract applies unchanged (reject →
   * unresolved, keeping compile paths safe; defer → renderer
   * existence checks).
   */
  private projectVaultValue(secret: VaultSecret, name: string): ResolvedVariable | null {
    if (secret.kind === 'string') {
      return { name, value: secret.value, scope: 'vault', isSensitive: true };
    }
    if (secret.kind === 'client-certificate') return null;
    const value =
      secret.kind === 'totp' ? this.totpRegistry.get(secret.name) : this.secretManagerRegistry.get(secret.name);
    if (value !== undefined) {
      return { name, value, scope: 'vault', isSensitive: true };
    }
    if (this.deferredVaultMode === 'defer') {
      return { name, value: '', scope: 'vault', isSensitive: true, deferred: true };
    }
    return null;
  }

  /**
   * Typed `failureReason` for an unprojectable `secret-manager` entry —
   * looked up from the per-execution failures map installed alongside
   * the registry. Empty for every other kind (and for compile paths
   * that never built a registry), where the plain `unset-in-scope`
   * miss is the whole answer.
   */
  private secretFailureReason(secret: VaultSecret): Pick<ScopedResolution, 'failureReason'> {
    if (secret.kind !== 'secret-manager') return {};
    const failure = this.secretManagerFailures.get(secret.name);
    if (!failure) return {};
    return { failureReason: `secret-${failure}` };
  }

  /**
   * Environment consulted by one resolution pass. A context override —
   * including explicit `null`, the "No environment" state — beats the
   * configured active pointer; only an ABSENT override defers to it.
   */
  private effectiveEnvironmentId(context?: ResolutionContext): string | null {
    return context?.environmentId === undefined ? this.activeEnvironmentId : context.environmentId;
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
    if (!envVar || envVar.enabled === false || envVar.value === '') return null;
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
    const activeEnvId = this.effectiveEnvironmentId(context);
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
        if (collVar && collVar.enabled !== false && collVar.value !== '') {
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
    if (workspaceVar && workspaceVar.enabled !== false && workspaceVar.value !== '') {
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
        if (projected === null) return { resolved: null, ...this.secretFailureReason(secret) };
        // Empty string-kind value falls through to `unset-in-scope` so
        // the user fixes the underlying empty entry. Deferred TOTP
        // entries report as resolved — the actual code lands at
        // request execution.
        if (!projected.deferred && projected.value === '') return { resolved: null };
        return { resolved: projected };
      }
      case 'environment': {
        const activeEnvId = this.effectiveEnvironmentId(context);
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
        if (collVar && collVar.enabled !== false && collVar.value !== '') {
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
        if (wsVar && wsVar.enabled !== false && wsVar.value !== '') {
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
      case 'dynamic': {
        // Built-in generators — a fresh value per resolution pass. On
        // the static-rule compile path the value is baked into the
        // compiled rule and regenerates on the next recompile; per-send
        // paths (API client, workflows) get a fresh value every send.
        const value = resolveDynamicValue(name);
        if (value === null) return { resolved: null };
        return {
          resolved: {
            name,
            value,
            scope: 'dynamic',
            isSensitive: false,
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
        activeEnvironmentId: this.effectiveEnvironmentId(context),
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
      activeEnvironmentId: this.effectiveEnvironmentId(context),
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
