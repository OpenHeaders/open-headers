/**
 * Rule applicability — pure verdict on whether a header rule would
 * still fire (and produce the same row) on a NEXT request to the URL
 * that produced this past row.
 *
 * Used by the inspector popover's "Future" surface so it doesn't
 * cheerfully preview a resolved value when the rule is now disabled,
 * its conditions exclude this URL, or its template can't actually
 * resolve into a valid HTTP token.
 *
 * Pure function: takes a snapshot of the current world (live rule +
 * resolver + URL) and returns a tagged verdict. No side effects, no
 * background calls — composes with the existing renderer-side
 * `useVariableResolver` and `rulesByUid` hooks.
 */

import type { V5 } from '@openheaders/core/types';
import { doesUrlMatchRule, getRuleMatchPatterns } from '@openheaders/core/utils';
import { resolveRuleConditions, type VariableResolver } from '@openheaders/core/variables';
import { findCurrentMod, type RuleAttributionContext } from './header-attribution';

export type RuleApplicability =
  /** Rule + mod still exist, conditions match, name resolves cleanly.
   *  Future = `currentResolvedValue` (or "removed" if op is now `remove`). */
  | { kind: 'will-fire' }
  /** Rule was deleted from the registry. */
  | { kind: 'rule-deleted' }
  /** Rule exists but its `enabled` flag is off. */
  | { kind: 'rule-disabled' }
  /** Rule exists, is enabled, but the matching modification was removed
   *  from its action list (or the rule type was changed). */
  | { kind: 'mod-gone' }
  /** Rule's conditions no longer include this URL — pattern matcher
   *  rejected the row's URL against the rule's current condition set. */
  | { kind: 'conditions-mismatch' }
  /** The headerName template still contains `{{}}` after resolution
   *  (a TOTP / unresolvable ref). The DNR builder would also reject
   *  the rule with a literal `{{}}` in the header name — so the rule
   *  effectively wouldn't fire on the wire. */
  | { kind: 'name-template-unresolved'; template: string }
  /** Same shape but for the value template. Less common — DNR builders
   *  treat unresolved templates in values differently per type — but
   *  surfaced for symmetry. */
  | { kind: 'value-template-unresolved'; template: string }
  /** Merge separator template couldn't be resolved (rare — separators
   *  are usually literal). The inject-manager skips the merge mod, so
   *  the rule effectively wouldn't fire on the wire for this row. */
  | { kind: 'separator-template-unresolved'; template: string };

export interface ApplicabilityInputs {
  /**
   * Live rule from the renderer-side mirror. Caller passes the freshest
   * snapshot; the function never reaches into a cached struct (the
   * attribution context is historical-only — see `header-attribution.ts`).
   */
  liveRule: V5.Rule | null;
  ctx: RuleAttributionContext;
  /** URL of the request whose row this popover anchors. */
  url: string;
  resolver: VariableResolver;
  /** Collection scope for `{{collection.X}}` resolution. */
  collectionId?: string;
}

/**
 * Compute the verdict. The order matters — earlier branches short-
 * circuit later ones (e.g. don't bother running the conditions
 * matcher on a deleted rule).
 */
export function computeRuleApplicability({
  liveRule,
  ctx,
  url,
  resolver,
  collectionId,
}: ApplicabilityInputs): RuleApplicability {
  if (!liveRule) return { kind: 'rule-deleted' };

  if (liveRule.enabled === false) return { kind: 'rule-disabled' };

  if (liveRule.type !== 'header') return { kind: 'mod-gone' };
  const currentMod = findCurrentMod(liveRule, ctx);
  if (!currentMod) return { kind: 'mod-gone' };

  // Conditions matcher: resolve `{{var}}` templates inside the live
  // rule's conditions BEFORE testing the URL. The condition values may
  // reference env / vault / collection / workspace variables —
  // `getRuleMatchPatterns` would otherwise produce literal patterns
  // like `*://{{env.QA_DOMAIN}}/*` that can never match a real URL
  // and surface a misleading `conditions-mismatch` for any rule that
  // uses variables in its domain conditions.
  //
  // Use `resolveRuleConditions` (not `resolveRule`) — we only need
  // condition templates resolved; walking the full action would be
  // wasted work for a hover popover that fires per-row.
  const ctxArg = collectionId ? { collectionId } : undefined;
  const resolvedConditions = resolveRuleConditions(liveRule.conditions, resolver, ctxArg);
  const ruleForMatcher = { ...liveRule, conditions: resolvedConditions };
  if (getRuleMatchPatterns(ruleForMatcher).length === 0) return { kind: 'conditions-mismatch' };
  if (!doesUrlMatchRule(url, ruleForMatcher)) return { kind: 'conditions-mismatch' };

  // Name / value resolution check: take the live mod's templates,
  // resolve them, and confirm no `{{}}` remains. Unresolvable refs
  // (TOTP, broken vars) leave the literal in place. The DNR builder
  // applies the same gate at compile time — we mirror it here so the
  // popover's Future preview matches what would actually happen.
  // (`ctxArg` is declared above for the conditions-resolution step.)
  const nameTemplate = currentMod.headerName;
  if (containsUnresolvedRef(resolver, nameTemplate, ctxArg)) {
    return { kind: 'name-template-unresolved', template: nameTemplate };
  }
  if (currentMod.operation !== 'remove' && typeof currentMod.value === 'string') {
    if (containsUnresolvedRef(resolver, currentMod.value, ctxArg)) {
      return { kind: 'value-template-unresolved', template: currentMod.value };
    }
  }
  if (currentMod.operation === 'merge' && typeof currentMod.mergeSeparator === 'string') {
    if (containsUnresolvedRef(resolver, currentMod.mergeSeparator, ctxArg)) {
      return { kind: 'separator-template-unresolved', template: currentMod.mergeSeparator };
    }
  }

  return { kind: 'will-fire' };
}

/**
 * Reports whether `template` contains a reference that wouldn't resolve
 * cleanly at SW compile time (DNR-bound `reject` mode).
 *
 * The panel resolver runs in `defer` mode — deferred TOTP refs come
 * back as `{ value: '', deferred: true }` rather than null. That makes
 * `errors`/`result` look fine from `resolveTemplate`'s POV, even
 * though the SW would actually drop the rule. So we walk the template
 * variables and re-introspect `vault.*` refs through `resolveScoped`,
 * checking the `deferred` flag explicitly.
 *
 * Three signals trigger an "unresolved" verdict:
 *   1. Resolver pushed errors (unset-in-scope, unknown-namespace, …).
 *   2. The substituted result still contains `{{` (defer mode kept the
 *      literal — happens for parse-failures).
 *   3. Any `vault.*` ref came back as deferred (TOTP-class).
 */
function containsUnresolvedRef(
  resolver: VariableResolver,
  template: string,
  context: { collectionId: string } | undefined,
): boolean {
  if (!template.includes('{{')) return false;
  const { result, variables, errors } = resolver.resolveTemplate(template, context);
  if (errors.length > 0) return true;
  if (result.includes('{{')) return true;
  for (const v of variables) {
    if (!v.resolved) return true;
    if (v.scope !== 'vault') continue;
    // Re-introspect to surface the deferred flag — TemplateVariable
    // doesn't expose it, but `resolveScoped` returns the full
    // `ResolvedVariable` which does. `v.name` is the joined
    // `${namespace}.${name}` form when scoped, so split on the
    // leading `vault.` prefix to recover the bare name.
    const rawName = v.name.startsWith('vault.') ? v.name.slice('vault.'.length) : v.name;
    const resolved = resolver.resolveScoped(rawName, 'vault', context);
    if (resolved?.deferred) return true;
  }
  return false;
}
