/**
 * Path → write helpers for rule conflict resolution.
 *
 * Bulk conflict resolution writes saved values into:
 *   - the antd form (so the dirty derivation + auto-rebase carry them
 *     through to a save), OR
 *   - a transient rule projection (so the diff dialog's "modified" pane
 *     reflects the user's per-row picks live).
 *
 * Both flows share the same path-decoding logic — header rows live as
 * indexed Form.List entries / array items, scalar fields live at the
 * action root, mock `responseHeaders` is a Record (keyed by header
 * name; out of scope for these helpers — `acceptTheirs` still records
 * the override so the chip dismisses).
 */

import type { FormInstance } from 'antd';
import type { V5 } from '@openheaders/core/types';
import type { PathConflict } from '@/shared/conflicts/types';
import { decodeReorderConflictKey, decodeSetConflictKey } from './use-rule-conflicts';

interface ReorderPayload {
  savedOrder: readonly string[];
}

function isReorderPayload(p: unknown): p is ReorderPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    Array.isArray((p as { savedOrder?: unknown }).savedOrder)
  );
}

function reorderRows<T extends { uid?: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
  const byUid = new Map<string, T>();
  for (const row of rows) {
    if (row?.uid) byUid.set(row.uid, row);
  }
  const out: T[] = [];
  for (const uid of savedOrder) {
    const row = byUid.get(uid);
    if (row) {
      out.push(row);
      byUid.delete(uid);
    }
  }
  // Anything left over (not in savedOrder, e.g. user added a row
  // locally) goes on the tail in its current relative order.
  for (const row of rows) {
    if (row?.uid && byUid.has(row.uid)) out.push(row);
  }
  return out;
}

interface RowWithUid {
  uid?: string;
}

interface RuleAction {
  requestHeaders?: Array<RowWithUid & Record<string, unknown>>;
  responseHeaders?: Array<RowWithUid & Record<string, unknown>>;
  params?: Array<RowWithUid & Record<string, unknown>>;
  [key: string]: unknown;
}

function findRowIndex(arr: readonly RowWithUid[] | undefined, uid: string): number {
  if (!arr) return -1;
  return arr.findIndex((r) => r.uid === uid);
}

interface DecodedPath {
  kind: 'name' | 'conditions' | 'header' | 'param' | 'mock-header' | 'scalar' | 'unknown';
  set?: 'requestHeaders' | 'responseHeaders';
  uid?: string;
  leaf?: string;
  scalar?: string;
}

function decodePath(path: string): DecodedPath {
  if (path === 'name') return { kind: 'name' };
  if (path.startsWith('conditions.')) return { kind: 'conditions' };
  if (!path.startsWith('action.')) return { kind: 'unknown' };
  const tail = path.slice('action.'.length);

  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(tail);
  if (headerMod) {
    return { kind: 'header', set: headerMod[1] as 'requestHeaders' | 'responseHeaders', uid: headerMod[2], leaf: headerMod[3] };
  }
  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) return { kind: 'param', uid: queryParam[1], leaf: queryParam[2] };
  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) return { kind: 'mock-header' };
  if (!tail.includes('.')) return { kind: 'scalar', scalar: tail };
  return { kind: 'unknown' };
}

function setPathToFormName(setPath: string): string | null {
  if (setPath === 'action.requestHeaders') return 'requestHeaders';
  if (setPath === 'action.responseHeaders') return 'responseHeaders';
  if (setPath === 'action.params') return 'params';
  if (setPath === 'conditions') return 'conditions';
  return null;
}

/**
 * Apply the saved-side resolution at `path` to the form.
 *
 * For leaf paths the `conflict.theirs` value is written into the form
 * field. For set-level conflicts:
 *   - `set-add`     → append `conflict.rowPayload` to the form array.
 *   - `set-remove`  → drop the row matching `<uid>` from the form array.
 *
 * Returns true when the write landed, false when the path isn't
 * form-writable (caller should still call `acceptTheirs` so the chip
 * dismisses).
 */
export function applyResolutionToForm(
  form: FormInstance,
  rule: V5.Rule,
  path: string,
  conflict: PathConflict,
): boolean {
  // Reorder path: sort the form's array to match the saved-side
  // ordered uid list.
  const reorderKey = decodeReorderConflictKey(path);
  if (reorderKey) {
    const formName = setPathToFormName(reorderKey.setPath);
    if (!formName || !isReorderPayload(conflict.rowPayload)) return false;
    const current = (form.getFieldValue(formName) as Array<{ uid?: string }> | undefined) ?? [];
    if (current.length === 0) return false;
    const next = reorderRows(current, conflict.rowPayload.savedOrder);
    form.setFieldValue(formName, next);
    return true;
  }
  const setKey = decodeSetConflictKey(path);
  if (setKey) {
    const formName = setPathToFormName(setKey.setPath);
    if (!formName) return false;
    const current = (form.getFieldValue(formName) as Array<{ uid?: string }> | undefined) ?? [];
    if (conflict.kind === 'set-add') {
      if (conflict.rowPayload === undefined) return false;
      const exists = current.some((row) => row?.uid === setKey.uid);
      if (exists) return false;
      form.setFieldValue(formName, [...current, conflict.rowPayload]);
      return true;
    }
    if (conflict.kind === 'set-remove') {
      const next = current.filter((row) => row?.uid !== setKey.uid);
      if (next.length === current.length) return false;
      form.setFieldValue(formName, next);
      return true;
    }
    return false;
  }
  const value = conflict.theirs;
  const decoded = decodePath(path);
  if (decoded.kind === 'header') {
    if (rule.type !== 'header' || !decoded.uid || !decoded.leaf || !decoded.set) return false;
    const arr = decoded.set === 'requestHeaders' ? rule.action.requestHeaders : rule.action.responseHeaders;
    const idx = findRowIndex(arr, decoded.uid);
    if (idx < 0) return false;
    form.setFieldValue([decoded.set, idx, decoded.leaf], value);
    return true;
  }
  if (decoded.kind === 'param') {
    if (rule.type !== 'query-param' || !decoded.uid || !decoded.leaf) return false;
    const idx = findRowIndex(rule.action.params, decoded.uid);
    if (idx < 0) return false;
    form.setFieldValue(['params', idx, decoded.leaf], value);
    return true;
  }
  if (decoded.kind === 'scalar' && decoded.scalar) {
    form.setFieldValue(decoded.scalar, value);
    return true;
  }
  return false;
}

function setArrayOnRule(rule: V5.Rule, setPath: string): { get(): Array<{ uid?: string }>; set(next: Array<{ uid?: string }>): boolean } | null {
  if (setPath === 'conditions') {
    return {
      get: () => (rule.conditions as Array<{ uid?: string }>) ?? [],
      set: (next) => {
        (rule as { conditions: Array<{ uid?: string }> }).conditions = next;
        return true;
      },
    };
  }
  const action = (rule as unknown as { action: RuleAction }).action;
  if (!action) return null;
  if (setPath === 'action.requestHeaders' && rule.type === 'header') {
    return {
      get: () => action.requestHeaders ?? [],
      set: (next) => {
        action.requestHeaders = next as Array<RowWithUid & Record<string, unknown>>;
        return true;
      },
    };
  }
  if (setPath === 'action.responseHeaders' && rule.type === 'header') {
    return {
      get: () => action.responseHeaders ?? [],
      set: (next) => {
        action.responseHeaders = next as Array<RowWithUid & Record<string, unknown>>;
        return true;
      },
    };
  }
  if (setPath === 'action.params' && rule.type === 'query-param') {
    return {
      get: () => action.params ?? [],
      set: (next) => {
        action.params = next as Array<RowWithUid & Record<string, unknown>>;
        return true;
      },
    };
  }
  return null;
}

/**
 * Apply the saved-side resolution at `path` to a rule projection
 * in-place. Used by the diff dialog to render the "modified" pane
 * reflecting the user's pending per-row picks before they hit Apply.
 * Returns true when the write landed.
 */
export function applyResolutionToRule(rule: V5.Rule, path: string, conflict: PathConflict): boolean {
  const reorderKey = decodeReorderConflictKey(path);
  if (reorderKey) {
    const set = setArrayOnRule(rule, reorderKey.setPath);
    if (!set || !isReorderPayload(conflict.rowPayload)) return false;
    const current = set.get();
    if (current.length === 0) return false;
    set.set(reorderRows(current, conflict.rowPayload.savedOrder));
    return true;
  }
  const setKey = decodeSetConflictKey(path);
  if (setKey) {
    const set = setArrayOnRule(rule, setKey.setPath);
    if (!set) return false;
    const current = set.get();
    if (conflict.kind === 'set-add') {
      if (conflict.rowPayload === undefined) return false;
      if (current.some((r) => r?.uid === setKey.uid)) return false;
      set.set([...current, conflict.rowPayload as { uid?: string }]);
      return true;
    }
    if (conflict.kind === 'set-remove') {
      const next = current.filter((r) => r?.uid !== setKey.uid);
      if (next.length === current.length) return false;
      set.set(next);
      return true;
    }
    return false;
  }
  const value = conflict.theirs;
  const decoded = decodePath(path);
  if (decoded.kind === 'name') {
    (rule as { name: string }).name = value;
    return true;
  }
  const action = (rule as unknown as { action: RuleAction }).action;
  if (!action || typeof action !== 'object') return false;

  if (decoded.kind === 'header') {
    if (rule.type !== 'header' || !decoded.uid || !decoded.leaf || !decoded.set) return false;
    const arr = decoded.set === 'requestHeaders' ? action.requestHeaders : action.responseHeaders;
    const row = arr?.find((r) => r.uid === decoded.uid);
    if (!row) return false;
    row[decoded.leaf] = value;
    return true;
  }
  if (decoded.kind === 'param') {
    if (rule.type !== 'query-param' || !decoded.uid || !decoded.leaf) return false;
    const row = action.params?.find((r) => r.uid === decoded.uid);
    if (!row) return false;
    row[decoded.leaf] = value;
    return true;
  }
  if (decoded.kind === 'scalar' && decoded.scalar) {
    action[decoded.scalar] = value;
    return true;
  }
  return false;
}
