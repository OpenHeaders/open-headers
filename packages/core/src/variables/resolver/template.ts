import type { ResolvedVariable, VariableScope } from '../../types';
import { parseReference, type VariableNamespace } from '../namespaces';
import { buildHint, type ResolutionEnvSnapshot, type ResolutionError, type ScopedResolution } from './errors';

// ── Regex for {{VAR}} matching ─────────────────────────────────────

export const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

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
 * also leave the reference literal — the caller walks the returned
 * `errors` list to surface issues in the UI.
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
        if (resolution.failureReason === 'step-out-of-context') {
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
