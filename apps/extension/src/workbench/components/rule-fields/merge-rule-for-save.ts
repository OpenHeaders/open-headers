/**
 * Per-field save merge for V5.Rule editors.
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

import type { V5 } from '@openheaders/core/types';

type RuleFormShape = Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>;

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bArr = b as unknown[];
    if (a.length !== bArr.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], bArr[i])) return false;
    }
    return true;
  }
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!deepEqual(aRec[k], bRec[k])) return false;
  }
  return true;
}

/**
 * Per-field merge of a single row that exists in form, baseline, AND live.
 * Walks the union of leaf keys and picks form's value when the user
 * actually edited that leaf (form !== baseline), live's otherwise. The
 * `uid` is preserved verbatim from the form row.
 */
function mergeRowFields<T extends { uid: string }>(formRow: T, baselineRow: T, liveRow: T): T {
  const out: Record<string, unknown> = {};
  const f = formRow as unknown as Record<string, unknown>;
  const b = baselineRow as unknown as Record<string, unknown>;
  const l = liveRow as unknown as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(f), ...Object.keys(b), ...Object.keys(l)]);
  for (const k of keys) {
    if (k === 'uid') continue;
    if (deepEqual(f[k], b[k])) {
      // User didn't touch this leaf in this tab — adopt live (preserves a
      // peer's edit; if the peer dropped the leaf, the leaf disappears).
      if (k in l) out[k] = l[k];
      else if (k in f) out[k] = f[k];
    } else {
      // Local leaf edit — keep ours.
      out[k] = f[k];
    }
  }
  out.uid = formRow.uid;
  return out as T;
}

export function mergeRowsByUid<T extends { uid: string }>(
  formRows: readonly T[],
  baselineRows: readonly T[],
  liveRows: readonly T[],
): T[] {
  const baselineByUid = new Map(baselineRows.map((r) => [r.uid, r]));
  const liveByUid = new Map(liveRows.map((r) => [r.uid, r]));
  const formUids = new Set(formRows.map((r) => r.uid));
  const result: T[] = [];
  for (const formRow of formRows) {
    const baselineRow = baselineByUid.get(formRow.uid);
    if (!baselineRow) {
      // Local add — uid wasn't present at form-seed time.
      result.push(formRow);
      continue;
    }
    const liveRow = liveByUid.get(formRow.uid);
    if (!liveRow) {
      // Peer deleted this row. Delete-wins UNLESS the user has local edits
      // on it — resurrect with our values so an in-flight save isn't lost.
      if (!deepEqual(formRow, baselineRow)) result.push(formRow);
      continue;
    }
    result.push(mergeRowFields(formRow, baselineRow, liveRow));
  }
  // Peer-added rows we never saw — append at end (form ordering wins for
  // the rows the user is touching; the existing conflict tracker handles
  // cross-tab order divergence via the per-set-reorder conflict kind).
  for (const liveRow of liveRows) {
    if (formUids.has(liveRow.uid)) continue;
    if (baselineByUid.has(liveRow.uid)) continue;
    result.push(liveRow);
  }
  return result;
}

export function mergeScalarLeaves<T extends Record<string, unknown>>(form: T, baseline: T, live: T): T {
  const result: Record<string, unknown> = {};
  const keys = new Set<string>([...Object.keys(form), ...Object.keys(live)]);
  for (const key of keys) {
    if (deepEqual(form[key], baseline[key])) {
      // Field untouched in this tab — adopt live (preserves peer edits;
      // also handles the case where the peer added a brand-new key).
      if (key in live) result[key] = live[key];
      else if (key in form) result[key] = form[key];
    } else {
      result[key] = form[key];
    }
  }
  return result as T;
}

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
  baseline: V5.Rule | null,
  live: V5.Rule | null,
): RuleFormShape {
  if (!baseline || !live) return form;
  if (form.type !== baseline.type || form.type !== live.type) return form;

  const merged: RuleFormShape = { ...form };
  merged.conditions = mergeRowsByUid(form.conditions, baseline.conditions, live.conditions);

  switch (form.type) {
    case 'header': {
      const f = (form as V5.HeaderRule).action;
      const b = (baseline as V5.HeaderRule).action;
      const l = (live as V5.HeaderRule).action;
      (merged as V5.HeaderRule).action = {
        requestHeaders: mergeRowsByUid(f.requestHeaders ?? [], b.requestHeaders ?? [], l.requestHeaders ?? []),
        responseHeaders: mergeRowsByUid(f.responseHeaders ?? [], b.responseHeaders ?? [], l.responseHeaders ?? []),
      };
      return merged;
    }
    case 'query-param': {
      const f = (form as V5.QueryParamRule).action;
      const b = (baseline as V5.QueryParamRule).action;
      const l = (live as V5.QueryParamRule).action;
      (merged as V5.QueryParamRule).action = {
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
