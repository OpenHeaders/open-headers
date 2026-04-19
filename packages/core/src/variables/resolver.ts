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
  WorkspaceVariables,
} from '../types/v5';
import { parseReference, type VariableNamespace } from './namespaces';

// ── Regex for {{VAR}} matching ─────────────────────────────────────

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

/** Map an explicit namespace to the scope it resolves from. */
const NAMESPACE_TO_SCOPE: Partial<Record<VariableNamespace, VariableScope>> = {
  vault: 'vault',
  env: 'environment',
  collection: 'collection',
  workspace: 'workspace',
  file: 'file',
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
  | 'unresolved'; // `{{X}}` — nowhere in the 4-scope chain

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

function buildHint(
  reason: ResolutionErrorReason,
  namespace: VariableNamespace | 'unknown' | null,
  activeEnvironmentId: string | null,
): string {
  switch (reason) {
    case 'empty':
      return 'Reference is empty. Use {{name}} or {{namespace.name}}.';
    case 'unknown-namespace':
      return 'Unknown namespace. Valid namespaces: env, vault, collection, workspace, dynamic, file.';
    case 'reserved-namespace':
      if (namespace === 'file') return 'File references are coming in v2.';
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
      return 'Not set in this scope.';
    case 'unresolved':
      return 'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.';
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

  constructor() {
    this.vault = { schemaVersion: 5, version: 1, secrets: [] };
    this.environments = [];
    this.activeEnvironmentId = null;
    this.defaultEnvironmentId = null;
    this.collectionVariables = new Map();
    this.workspaceVariables = { schemaVersion: 5, version: 1, variables: [] };
    this.fileRegistry = EMPTY_FILE_REGISTRY;
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

  // ── Internal helpers ─────────────────────────────────────────────

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
    if (vaultSecret?.value) {
      return { name, value: vaultSecret.value, scope: 'vault', isSensitive: true };
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
   * `dynamic` and `file` namespaces are reserved for other resolvers —
   * this method returns `null` for them so the caller can emit the
   * appropriate message (e.g. "file refs coming in v2").
   */
  resolveScoped(name: string, namespace: VariableNamespace, context?: ResolutionContext): ResolvedVariable | null {
    const scope = NAMESPACE_TO_SCOPE[namespace];
    if (!scope) return null;

    switch (scope) {
      case 'vault': {
        const secret = this.vault.secrets.find((s) => s.name === name);
        if (secret?.value) {
          return { name, value: secret.value, scope: 'vault', isSensitive: true };
        }
        return null;
      }
      case 'environment': {
        const activeEnvId = context?.environmentId ?? this.activeEnvironmentId;
        const fromActive = this.tryResolveFromEnv(activeEnvId, name);
        if (fromActive) return fromActive;
        if (this.defaultEnvironmentId && this.defaultEnvironmentId !== activeEnvId) {
          return this.tryResolveFromEnv(this.defaultEnvironmentId, name);
        }
        return null;
      }
      case 'collection': {
        if (!context?.collectionId) return null;
        const collVars = this.collectionVariables.get(context.collectionId);
        if (!collVars) return null;
        const collVar = collVars.find((v) => v.name === name);
        if (collVar && collVar.value !== '') {
          return {
            name,
            value: collVar.value,
            scope: 'collection',
            isSensitive: collVar.type === 'secret',
          };
        }
        return null;
      }
      case 'workspace': {
        const wsVar = this.workspaceVariables.variables.find((v) => v.name === name);
        if (wsVar && wsVar.value !== '') {
          return {
            name,
            value: wsVar.value,
            scope: 'workspace',
            isSensitive: wsVar.type === 'secret',
          };
        }
        return null;
      }
      case 'file': {
        // `{{file.X}}` resolves by filename OR explicit `sha256:<hex>`.
        // Returns the hash string — the BYTES are looked up by the
        // request executor via the per-platform BlobStore. Keeping
        // the resolver string-only preserves its synchronous-pure
        // contract; binary attachment is the executor's concern.
        const fileRef = resolveFileRef(this.fileRegistry, name);
        if (!fileRef) return null;
        return {
          name,
          value: fileRef.hash,
          scope: 'file',
          // File refs are not sensitive in the secret sense — the
          // hash is content-derived and doesn't reveal bytes. A
          // later tier might mark blobs uploaded from the vault
          // scope as sensitive; v1 treats them as plain data.
          isSensitive: false,
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
      (name, ns) => this.resolveScoped(name, ns, context),
      {
        activeEnvironmentId: context?.environmentId ?? this.activeEnvironmentId,
        defaultEnvironmentId: this.defaultEnvironmentId,
      },
    );
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
 * Resolve all `{{...}}` references in a template string.
 *
 * Accepts two lookup functions so the same implementation handles flat
 * ({@link lookup}, used for `{{X}}`) and scoped ({@link scopedLookup}, used
 * for `{{env.X}}` et al.) forms. If `scopedLookup` is omitted, explicit
 * references fall back to the flat lookup — preserves backward compat for
 * callers who haven't wired namespace support yet.
 *
 * Unresolved references are left literal in the output. Unknown namespaces
 * and reserved namespaces (`dynamic`, `file`) also leave the reference
 * literal — the caller walks the returned `errors` list to surface issues
 * in the UI.
 */
export function resolveTemplate(
  template: string,
  lookup: (name: string) => ResolvedVariable | null,
  scopedLookup?: (name: string, namespace: VariableNamespace) => ResolvedVariable | null,
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

    let resolved: ResolvedVariable | null;
    if (ref.namespace === null) {
      resolved = lookup(ref.name);
    } else if (scopedLookup) {
      resolved = scopedLookup(ref.name, ref.namespace);
    } else {
      // Caller didn't wire namespace support — treat as flat for backward
      // compat. Semantic: `{{env.X}}` behaves like `{{X}}` until the
      // caller opts into scoped lookup.
      resolved = lookup(ref.name);
    }

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
