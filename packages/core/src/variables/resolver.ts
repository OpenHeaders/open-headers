/**
 * VariableResolver — centralized {{VAR}} resolution across the 4-scope chain.
 *
 * Resolution priority (highest → lowest):
 *   1. Vault (per-machine secrets, never synced)
 *   2. Environment (switchable: dev/staging/prod)
 *   3. Collection (scoped to a collection, synced)
 *   4. Globals (workspace-wide, synced)
 *
 * This is pure domain logic — no I/O, no framework deps.
 * Both the main process and renderer use this.
 */

import type {
  Environment,
  Globals,
  ResolutionContext,
  ResolvedVariable,
  Variable,
  VariableScope,
  Vault,
} from '../types/v5';

// ── Regex for {{VAR}} matching ─────────────────────────────────────

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

// ── VariableResolver ───────────────────────────────────────────────

/**
 * Stateful resolver that holds the current variable scopes.
 * Update scopes when data changes (workspace switch, env switch, etc.).
 */
export class VariableResolver {
  private vault: Vault;
  private environments: Environment[];
  private collectionVariables: Map<string, Variable[]>;
  private globals: Globals;

  constructor() {
    this.vault = { secrets: [] };
    this.environments = [];
    this.collectionVariables = new Map();
    this.globals = { variables: [] };
  }

  // ── Scope setters ────────────────────────────────────────────────

  setVault(vault: Vault): void {
    this.vault = vault;
  }

  setEnvironments(environments: Environment[]): void {
    this.environments = environments;
  }

  setCollectionVariables(collectionId: string, variables: Variable[]): void {
    this.collectionVariables.set(collectionId, variables);
  }

  removeCollectionVariables(collectionId: string): void {
    this.collectionVariables.delete(collectionId);
  }

  setGlobals(globals: Globals): void {
    this.globals = globals;
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
      return { name, value: vaultSecret.value, scope: 'vault', isSecret: true };
    }

    // 2. Active environment
    const activeEnv = context?.environmentId
      ? this.environments.find((e) => e.id === context.environmentId)
      : this.environments.find((e) => e.isActive);

    if (activeEnv) {
      const envVar = activeEnv.variables.find((v) => v.name === name);
      if (envVar && envVar.value !== '') {
        return {
          name,
          value: envVar.value,
          scope: 'environment',
          isSecret: envVar.type === 'secret',
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
            isSecret: collVar.type === 'secret',
          };
        }
      }
    }

    // 4. Globals (lowest priority)
    const globalVar = this.globals.variables.find((v) => v.name === name);
    if (globalVar && globalVar.value !== '') {
      return {
        name,
        value: globalVar.value,
        scope: 'globals',
        isSecret: globalVar.type === 'secret',
      };
    }

    return null;
  }

  /**
   * Resolve all {{VAR}} references in a template string.
   * Returns the interpolated string and a list of all resolved/unresolved variables.
   *
   * Unresolved variables are left as-is: "{{UNKNOWN}}" stays in the output.
   */
  resolveTemplate(template: string, context?: ResolutionContext): { result: string; variables: TemplateVariable[] } {
    return resolveTemplate(template, (name) => this.resolve(name, context));
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
 * Resolve all {{VAR}} references in a template string.
 * Accepts a lookup function so it works with any data source.
 */
export function resolveTemplate(
  template: string,
  lookup: (name: string) => ResolvedVariable | null,
): { result: string; variables: TemplateVariable[] } {
  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();

  const result = template.replace(TEMPLATE_REGEX, (match, varName: string) => {
    const name = varName.trim();
    const resolved = lookup(name);

    if (!seen.has(name)) {
      seen.add(name);
      if (resolved) {
        variables.push({ name, resolved: true, value: resolved.value, scope: resolved.scope });
      } else {
        variables.push({ name, resolved: false });
      }
    }

    return resolved ? resolved.value : match;
  });

  return { result, variables };
}
