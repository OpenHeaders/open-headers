/**
 * Pure variable-surface fingerprinting for definitional freshness.
 *
 * A workflow's cached token is a function not only of the request it
 * embeds (`requestExecutableFingerprint`) but of the VALUES that
 * request's `{{var}}` references resolve to. When a referenced
 * variable's value changes, the cached token was minted by a recipe
 * that no longer exists — definitional staleness (LF2 / Finding 4).
 *
 * The fingerprint is split into two keys so the scheduler can
 * attribute a delta to the right cause:
 *   • `refsKey`   — the identity of the references (which `{{ns.X}}`
 *                   appear). Changes when the EMBEDDED REQUEST is
 *                   edited — that is LF1's concern, not LF2's.
 *   • `valuesKey` — the values behind those references. Changes when a
 *                   VARIABLE is edited — the input LF2 acts on.
 *
 * Acting only on a `valuesKey` change under a stable `refsKey` keeps
 * LF2 from double-refreshing a workflow LF1 already handled.
 *
 * Reference values are looked up per environment: `{{env.X}}` resolves
 * differently per environment, so the caller fingerprints each
 * environment separately. `{{vault.X}}` / `{{workspace.X}}` /
 * `{{collection.X}}` are environment-independent. A flat `{{X}}`
 * reference walks the vault → env → collection → workspace chain, so
 * its value is folded from all four scopes.
 *
 * Pure — no I/O, no framework deps.
 */

import { canonicalJson } from '../sync/store/canonical';
import { scanTemplateReferencesMany } from './template-scan';

/**
 * Variable values in scope for ONE environment context. `envVars`
 * carries a single environment's variables; the other three are
 * environment-independent workspace scopes. All keyed name → value.
 *
 * A vault TOTP entry must contribute its RECIPE (seed + RFC 6238
 * params), never the rotating code — a code that changes every 30s is
 * time-staleness (self-heals on cadence), not definitional staleness.
 */
export interface VariableScopeSnapshot {
  envVars: ReadonlyMap<string, string>;
  vaultVars: ReadonlyMap<string, string>;
  workspaceVars: ReadonlyMap<string, string>;
  collectionVars: ReadonlyMap<string, string>;
}

export interface VariableFingerprint {
  /** Identity of the `{{ns.X}}` references — stable across variable edits. */
  refsKey: string;
  /** Values behind those references — flips when a referenced variable is edited. */
  valuesKey: string;
}

type ValueNamespace = 'env' | 'vault' | 'workspace' | 'collection';

interface ScopedRef {
  /** `null` = flat `{{X}}` form (walks the 4-scope chain). */
  ns: ValueNamespace | null;
  name: string;
}

function isValueNamespace(ns: string | null): ns is ValueNamespace {
  return ns === 'env' || ns === 'vault' || ns === 'workspace' || ns === 'collection';
}

/** Stable string key for a reference — also the sort key. */
function refKey(ref: ScopedRef): string {
  return `${ref.ns ?? '*'}:${ref.name}`;
}

/**
 * Look up the value(s) a reference resolves to. An explicit namespace
 * resolves against exactly that scope; a flat `{{X}}` reference folds
 * the candidate from every scope in the resolution chain so a change
 * in any of them flips the fingerprint. `null` marks "absent from
 * scope" — distinct from an explicitly-empty `''` value.
 */
function lookupValue(ref: ScopedRef, scope: VariableScopeSnapshot): (string | null) | Array<string | null> {
  switch (ref.ns) {
    case 'env':
      return scope.envVars.get(ref.name) ?? null;
    case 'vault':
      return scope.vaultVars.get(ref.name) ?? null;
    case 'workspace':
      return scope.workspaceVars.get(ref.name) ?? null;
    case 'collection':
      return scope.collectionVars.get(ref.name) ?? null;
    case null:
      return [
        scope.vaultVars.get(ref.name) ?? null,
        scope.envVars.get(ref.name) ?? null,
        scope.collectionVars.get(ref.name) ?? null,
        scope.workspaceVars.get(ref.name) ?? null,
      ];
  }
}

/**
 * Fingerprint the variable surface of a workflow's embedded-request
 * templates against one environment scope.
 *
 * `templates` is the flat list of every templatable string across the
 * workflow's embedded requests (e.g. via `collectRequestTemplateStrings`).
 * `dynamic` / `file` references are excluded — `dynamic` values are
 * generated, `file` values are content-addressed; neither is a
 * user-edited variable LF2 tracks. `live` / `step` references never
 * reach the scanner's `other` channel.
 */
export function workflowVariableFingerprint(
  templates: readonly string[],
  scope: VariableScopeSnapshot,
): VariableFingerprint {
  const { other } = scanTemplateReferencesMany(templates);

  const refs: ScopedRef[] = [];
  const seen = new Set<string>();
  for (const ref of other) {
    if (ref.namespace !== null && !isValueNamespace(ref.namespace)) continue;
    const scoped: ScopedRef = { ns: ref.namespace, name: ref.name };
    const key = refKey(scoped);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(scoped);
  }
  refs.sort((a, b) => (refKey(a) < refKey(b) ? -1 : refKey(a) > refKey(b) ? 1 : 0));

  return {
    refsKey: canonicalJson(refs.map(refKey)),
    valuesKey: canonicalJson(refs.map((ref) => [refKey(ref), lookupValue(ref, scope)])),
  };
}
