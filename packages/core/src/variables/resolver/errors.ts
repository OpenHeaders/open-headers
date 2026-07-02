import type { ResolvedVariable } from '../../types';
import { parseReference, type VariableNamespace } from '../namespaces';

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

export function buildHint(
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
