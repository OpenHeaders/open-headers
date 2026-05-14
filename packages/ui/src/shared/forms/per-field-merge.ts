/**
 * Per-field save-merge primitives shared across editors.
 *
 * Save is the deliberate publication gate
 * (`memory/project_publication_gate_decision.md`) for entities whose
 * commits stream to live runners. For per-leaf convergence at Save,
 * each editor's save batch must carry only leaves the user actually
 * edited — untouched leaves must not enter the diff, otherwise per-
 * itemId / per-leaf LWW at the oracle silently drops a peer's edit on
 * the same path the user never touched in this tab.
 *
 * These primitives rebase a form-projected entity against the latest
 * canonical (`live`) using the form-seed snapshot (`baseline`):
 *
 *   - Leaf equal to baseline (untouched) → adopt live's value.
 *   - Leaf differs from baseline → keep our value.
 *
 * Set rows merge field-by-field within the row when the row exists in
 * form + baseline + live; row-level add/delete still drop out at the
 * row layer:
 *
 *   - Row in form but not in baseline → local add; keep.
 *   - Row in form + baseline, gone from live → peer deleted: keep
 *     (delete-wins) only if the user didn't touch any leaf locally;
 *     otherwise resurrect with our edits so an in-flight save isn't
 *     lost.
 *   - Row in live but not in form/baseline → peer add; preserve.
 *   - Row in baseline absent from form → local delete; drop.
 *
 * Per-itemId / per-leaf LWW at the oracle is still the ultimate
 * tie-breaker for the rare case where both surfaces edited the same
 * leaf — the existing conflict tracker surfaces it via the chip /
 * banner / dialog. Untouched leaves never enter the save diff, so
 * they can't trigger LWW against a peer's edit they never saw.
 *
 * Originally split out of `merge-rule-for-save.ts` (Session 24) once
 * Template + Request needed the same treatment.
 */

export function deepEqual(a: unknown, b: unknown): boolean {
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
 * Per-field merge of a single row that exists in form, baseline, AND
 * live. Walks the union of leaf keys and picks form's value when the
 * user actually edited that leaf (form !== baseline), live's
 * otherwise. The identity key is preserved verbatim from the form row.
 */
function mergeRowFields<T extends Record<string, unknown>>(
  formRow: T,
  baselineRow: T,
  liveRow: T,
  identityKey: keyof T,
): T {
  const out: Record<string, unknown> = {};
  const f = formRow as unknown as Record<string, unknown>;
  const b = baselineRow as unknown as Record<string, unknown>;
  const l = liveRow as unknown as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(f), ...Object.keys(b), ...Object.keys(l)]);
  for (const k of keys) {
    if (k === identityKey) continue;
    if (deepEqual(f[k], b[k])) {
      if (k in l) out[k] = l[k];
      else if (k in f) out[k] = f[k];
    } else {
      out[k] = f[k];
    }
  }
  out[identityKey as string] = formRow[identityKey];
  return out as T;
}

/**
 * Three-way merge of an array of identity-keyed rows. Identity is the
 * value at `identityKey` (typically `'uid'`). Rows present in all
 * three sides merge field-by-field via `mergeRowFields`; row-level
 * add/delete follow the rules above.
 */
export function mergeRowsByIdentity<T extends Record<string, unknown>>(
  formRows: readonly T[],
  baselineRows: readonly T[],
  liveRows: readonly T[],
  identityKey: keyof T,
): T[] {
  const baselineByKey = new Map<unknown, T>();
  for (const r of baselineRows) baselineByKey.set(r[identityKey], r);
  const liveByKey = new Map<unknown, T>();
  for (const r of liveRows) liveByKey.set(r[identityKey], r);
  const formKeys = new Set<unknown>();
  for (const r of formRows) formKeys.add(r[identityKey]);

  const result: T[] = [];
  for (const formRow of formRows) {
    const id = formRow[identityKey];
    const baselineRow = baselineByKey.get(id);
    if (!baselineRow) {
      // Local add — id wasn't present at form-seed time.
      result.push(formRow);
      continue;
    }
    const liveRow = liveByKey.get(id);
    if (!liveRow) {
      // Peer deleted this row. Delete-wins UNLESS the user has local
      // edits — resurrect with our values so an in-flight save isn't
      // lost.
      if (!deepEqual(formRow, baselineRow)) result.push(formRow);
      continue;
    }
    result.push(mergeRowFields(formRow, baselineRow, liveRow, identityKey));
  }
  // Peer-added rows we never saw — append at end.
  for (const liveRow of liveRows) {
    const id = liveRow[identityKey];
    if (formKeys.has(id)) continue;
    if (baselineByKey.has(id)) continue;
    result.push(liveRow);
  }
  return result;
}

/**
 * Three-way merge of a flat scalar object. Untouched leaves (form ===
 * baseline) adopt live's value; touched leaves keep ours. Newly added
 * keys (peer's add) survive the merge.
 */
export function mergeScalarLeaves<T extends Record<string, unknown>>(form: T, baseline: T, live: T): T {
  const result: Record<string, unknown> = {};
  const keys = new Set<string>([...Object.keys(form), ...Object.keys(live)]);
  for (const key of keys) {
    if (deepEqual(form[key], baseline[key])) {
      if (key in live) result[key] = live[key];
      else if (key in form) result[key] = form[key];
    } else {
      result[key] = form[key];
    }
  }
  return result as T;
}
