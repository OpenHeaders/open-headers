/**
 * Per-field save merge for Rule editors.
 *
 * Save is the deliberate publication gate (`memory/project_publication_gate_decision.md`).
 * For the merge to honor §6.2's killer-demo promise — two surfaces editing
 * different paths both apply unconditionally with no banner — the Save
 * batch must carry **only the leaves the user actually edited**. Untouched
 * leaves must not travel as setField writes; otherwise per-itemId / per-leaf
 * LWW at the oracle silently drops a peer's edit on the same path the user
 * never touched in this tab.
 *
 * This module rebases the form's projected rule against the latest canonical
 * (`live`) using the form-seed snapshot (`baseline`) at field granularity:
 *
 *   - Leaf equal to baseline (user didn't touch it) → adopt live's value,
 *     preserving the peer's edit on that exact leaf.
 *   - Leaf differs from baseline → keep our value.
 *
 * Set rows (header mods / params / conditions) merge field-by-field within
 * the row when the row exists in both form + baseline + live; row-level
 * add/delete still drop out at the row layer:
 *
 *   - Row in form but not in baseline → local add; keep.
 *   - Row in form + baseline, gone from live → peer deleted: keep
 *     (delete-wins) only if the user didn't touch any leaf locally;
 *     otherwise resurrect with our edits so an in-flight save isn't lost.
 *   - Row in live but not in form/baseline → peer add; preserve.
 *   - Row in baseline absent from form → local delete; drop.
 *
 * Per-itemId / per-leaf LWW at the oracle is still the ultimate tie-breaker
 * for the rare case where both surfaces edited the same leaf — last writer
 * wins, and the existing conflict tracker (`useRuleConflicts`) surfaces it
 * via the chip / banner / dialog. Untouched leaves never enter the save
 * diff, so they can't trigger LWW against a peer's edit they never saw.
 */

import type { HeaderRule, QueryParamRule, Rule } from '@openheaders/core/types';
import { mergeRowsByIdentity, mergeScalarLeaves } from '@openheaders/ui/shared/forms/per-field-merge';

type RuleFormShape = Omit<Rule, 'uid' | 'path' | 'schemaVersion'>;

/** Convenience wrapper — uid-keyed rows are the dominant set shape. */
export function mergeRowsByUid<T extends { uid: string }>(
  formRows: readonly T[],
  baselineRows: readonly T[],
  liveRows: readonly T[],
): T[] {
  return mergeRowsByIdentity(
    formRows as readonly (T & Record<string, unknown>)[],
    baselineRows as readonly (T & Record<string, unknown>)[],
    liveRows as readonly (T & Record<string, unknown>)[],
    'uid',
  ) as T[];
}

export { mergeScalarLeaves };

/**
 * Merge a form-projected rule shape against the live canonical using the
 * form-seed snapshot as the divergence baseline. Returns a shape suitable
 * for `applyRuleUpdate`.
 *
 * Falls back to `form` unchanged when `baseline`/`live` are missing or the
 * rule type disagrees between them — defensive guard so a misconfigured
 * editor never silently drops user input.
 */
export function mergeRuleForSave(
  form: RuleFormShape,
  baseline: Rule | null,
  live: Rule | null,
): RuleFormShape {
  if (!baseline || !live) return form;
  if (form.type !== baseline.type || form.type !== live.type) return form;

  const merged: RuleFormShape = { ...form };
  merged.conditions = mergeRowsByUid(form.conditions, baseline.conditions, live.conditions);

  switch (form.type) {
    case 'header': {
      const f = (form as HeaderRule).action;
      const b = (baseline as HeaderRule).action;
      const l = (live as HeaderRule).action;
      (merged as HeaderRule).action = {
        requestHeaders: mergeRowsByUid(f.requestHeaders ?? [], b.requestHeaders ?? [], l.requestHeaders ?? []),
        responseHeaders: mergeRowsByUid(f.responseHeaders ?? [], b.responseHeaders ?? [], l.responseHeaders ?? []),
      };
      return merged;
    }
    case 'query-param': {
      const f = (form as QueryParamRule).action;
      const b = (baseline as QueryParamRule).action;
      const l = (live as QueryParamRule).action;
      (merged as QueryParamRule).action = {
        params: mergeRowsByUid(f.params ?? [], b.params ?? [], l.params ?? []),
      };
      return merged;
    }
    case 'block':
      return merged;
    default: {
      // redirect / inject / body / delay / mock — scalar action subtrees.
      const f = (form as { action?: Record<string, unknown> }).action ?? {};
      const b = (baseline as { action?: Record<string, unknown> }).action ?? {};
      const l = (live as { action?: Record<string, unknown> }).action ?? {};
      const mergedAction = mergeScalarLeaves(f, b, l);
      // Mock's responseHeaders is a Record<string,string>; merge per-key
      // so a peer adding a new response header survives our save.
      if (form.type === 'mock') {
        const fh = (f.responseHeaders as Record<string, string> | undefined) ?? {};
        const bh = (b.responseHeaders as Record<string, string> | undefined) ?? {};
        const lh = (l.responseHeaders as Record<string, string> | undefined) ?? {};
        mergedAction.responseHeaders = mergeScalarLeaves(fh, bh, lh);
      }
      (merged as { action: unknown }).action = mergedAction;
      return merged;
    }
  }
}
