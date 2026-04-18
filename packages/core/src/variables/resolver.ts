/**
 * VariableResolver — centralized {{VAR}} resolution across the 4-scope chain.
 *
 * Resolution priority (highest → lowest):
 *   1. Secret (per-machine secrets, never synced)
 *   2. Environment (switchable: dev/staging/prod)
 *   3. Collection (scoped to a collection, synced)
 *   4. Workspace (workspace-wide, synced)
 *
 * This is pure domain logic — no I/O, no framework deps.
 * Both the main process and renderer use this.
 */

import type {
  Environment,
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
  private collectionVariables: Map<string, Variable[]>;
  private workspaceVariables: WorkspaceVariables;

  constructor() {
    this.vault = { schemaVersion: 1, secrets: [] };
    this.environments = [];
    this.activeEnvironmentId = null;
    this.collectionVariables = new Map();
    this.workspaceVariables = { schemaVersion: 1, variables: [] };
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
   * an error; the resolver still resolves from lower scopes).
   */
  setActiveEnvironmentId(id: string | null): void {
    this.activeEnvironmentId = id;
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
    const activeEnv = activeEnvId ? this.environments.find((e) => e.uid === activeEnvId) : null;

    if (activeEnv) {
      const envVar = activeEnv.variables.find((v) => v.name === name);
      if (envVar && envVar.value !== '') {
        return {
          name,
          value: envVar.value,
          scope: 'environment',
          isSensitive: envVar.type === 'secret',
        };
      }
    }

    // 3. Collection (if context specifies one)
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

    // 4. Workspace (lowest priority)
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
        const activeEnv = activeEnvId ? this.environments.find((e) => e.uid === activeEnvId) : null;
        if (!activeEnv) return null;
        const envVar = activeEnv.variables.find((v) => v.name === name);
        if (envVar && envVar.value !== '') {
          return {
            name,
            value: envVar.value,
            scope: 'environment',
            isSensitive: envVar.type === 'secret',
          };
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
    }
  }

  /**
   * Resolve all {{VAR}} references in a template string.
   *
   * Supports both flat (`{{X}}`) and explicit (`{{env.X}}`, `{{vault.X}}`, …)
   * forms. Unresolved variables are left as-is: `{{UNKNOWN}}` stays in the
   * output. This is intentional — for DNR compatibility, literal references
   * must pass through when unresolved. The caller surfaces errors via the
   * returned `variables` list (resolved: false).
   */
  resolveTemplate(template: string, context?: ResolutionContext): { result: string; variables: TemplateVariable[] } {
    return resolveTemplate(
      template,
      (name) => this.resolve(name, context),
      (name, ns) => this.resolveScoped(name, ns, context),
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
 * literal — the caller walks the returned `variables` list to surface
 * errors in the UI.
 */
export function resolveTemplate(
  template: string,
  lookup: (name: string) => ResolvedVariable | null,
  scopedLookup?: (name: string, namespace: VariableNamespace) => ResolvedVariable | null,
): { result: string; variables: TemplateVariable[] } {
  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();

  const result = template.replace(TEMPLATE_REGEX, (match, inner: string) => {
    const parsed = parseReference(inner);
    if (!parsed.ok) {
      // Empty or unknown-namespace — leave literal. Track it so the UI
      // can surface the error under the `raw` name.
      const key = `!${parsed.raw}`;
      if (!seen.has(key)) {
        seen.add(key);
        variables.push({ name: parsed.raw, resolved: false });
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
        variables.push({ name: key, resolved: true, value: resolved.value, scope: resolved.scope });
      } else {
        variables.push({ name: key, resolved: false });
      }
    }

    return resolved ? resolved.value : match;
  });

  return { result, variables };
}
