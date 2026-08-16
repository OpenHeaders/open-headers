import type { ResolvedVariable } from '../../types';
import type { DomainIssueKind } from '../../utils/condition-validation';
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
  | 'unset-in-scope' // `{{env.X}}` but X not in active env (and no default fallback)
  | 'step-out-of-context' // `{{step.X.Y}}` outside an active Live Workflow step
  | 'unresolved' // `{{X}}` — nowhere in the 4-scope chain
  // `{{vault.X}}` names a secret-manager entry whose provider resolution
  // failed with a typed reason (see SecretManagerFailures). Three
  // distinct reasons because the fixes differ: authorize/unlock the
  // manager, fix the reference, or make the provider available here.
  | 'secret-authorization-required'
  | 'secret-not-found'
  | 'secret-unavailable'
  // The reference resolved cleanly, but the resolved value isn't a legal
  // hostname for `requestDomains` (scheme, path, wildcard, whitespace,
  // non-ASCII, …). We sanitize at compile time so the rule still ships,
  // but surface the diagnosis so the user knows their variable is shaped
  // wrong.
  | 'invalid-resolved-value';

/**
 * Return shape of the diagnostic scoped-resolver. `failureReason` is
 * set when resolution failed for a reason richer than "not in scope" —
 * `step-out-of-context`, and the typed `secret-*` failures from the
 * secret-manager registry. `resolveTemplate` passes any failureReason
 * straight through to the emitted {@link ResolutionError}.
 */
export interface ScopedResolution {
  resolved: ResolvedVariable | null;
  failureReason?: ResolutionErrorReason;
}

/**
 * Structured facts behind a hint, for reasons whose message carries
 * site-specific data. UI-side keyed hint rendering consumes these
 * instead of parsing the English `hint` string.
 */
export interface ResolutionErrorParams {
  /** Dominant domain-issue kind for `invalid-resolved-value` errors
   *  raised by post-resolve domain sanitization. */
  domainIssueKind?: DomainIssueKind;
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
  /** Short human-readable fix hint — the operational-plane English
   *  fallback. UI surfaces render a keyed hint from `reason` +
   *  `params` instead where possible. */
  hint: string;
  /** Structured facts behind the hint, when the reason carries them. */
  params?: ResolutionErrorParams;
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
 * `https://...` — drop the scheme"); `params` carries the same facts
 * structurally so keyed UI hints don't have to parse the English.
 */
export function buildPostResolveError(
  reference: string,
  reason: ResolutionErrorReason,
  env: ResolutionEnvSnapshot | undefined,
  customHint?: string,
  params?: ResolutionErrorParams,
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
    ...(params ? { params } : {}),
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
      if (namespace === 'dynamic')
        return 'No built-in generator by that name. Pick one from the suggestion list ({{dynamic.uuid}}, {{dynamic.timestamp}}, …).';
      return 'Not set in this scope.';
    case 'step-out-of-context':
      return 'Step references ({{step.<stepId>.<captureName>}}) are only valid inside a Live Workflow step.';
    case 'secret-authorization-required':
      return 'The secret manager holding this entry needs authorization. Unlock or approve access in the manager, then retry.';
    case 'secret-not-found':
      return 'The secret manager could not find a secret at this reference. Check the reference fields in the Vault entry.';
    case 'secret-unavailable':
      return 'The secret manager for this entry is not available on this device. Install or configure it, then retry.';
    case 'unresolved':
      return 'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.';
    case 'invalid-resolved-value':
      return 'Variable resolved to a value Chrome rejects in this slot — check the variable definition and use bare hostnames (no scheme, no path, no wildcard).';
  }
}
