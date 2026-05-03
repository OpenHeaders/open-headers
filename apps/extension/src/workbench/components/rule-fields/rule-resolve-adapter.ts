/**
 * `ConflictResolveAdapter<V5.Rule>` — write-side adapter for rule
 * conflict resolution.
 *
 * Three responsibilities:
 *   - `applyResolutionToForm` writes a saved-side value (or a set
 *     mutation) into the antd Form. Used by inline "Use saved" + the
 *     diff dialog's Apply button.
 *   - `applyResolutionToEntity` writes the same to a transient rule
 *     projection. Used by the diff dialog to render the right pane
 *     reflecting pending per-row picks before Apply.
 *   - `prettyPath` prints a path → human label for banner / dialog
 *     row labels.
 *
 * Pure functions; no React. Composed with the entity-agnostic
 * `EntityConflictDialog` + `EntityConflictBanner` via the generic
 * `prettyPathMap(adapter, entity, paths)` helper.
 */

import type { FormInstance } from 'antd';
import type { V5 } from '@openheaders/core/types';
import type { ConflictResolveAdapter } from '@/shared/conflicts/conflict-adapters';
import type { PathConflict } from '@/shared/conflicts/types';
import { decodeReorderConflictKey, decodeSetConflictKey } from '@/shared/conflicts/conflict-keys';

// ── Path decoding (rule-specific) ──────────────────────────────────

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

  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(
    tail,
  );
  if (headerMod) {
    return {
      kind: 'header',
      set: headerMod[1] as 'requestHeaders' | 'responseHeaders',
      uid: headerMod[2],
      leaf: headerMod[3],
    };
  }
  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) return { kind: 'param', uid: queryParam[1], leaf: queryParam[2] };
  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) return { kind: 'mock-header' };
  if (!tail.includes('.')) return { kind: 'scalar', scalar: tail };
  return { kind: 'unknown' };
}

// ── Resolver helpers ────────────────────────────────────────────────

interface RowWithUid {
  uid?: string;
}

interface RuleAction {
  requestHeaders?: Array<RowWithUid & Record<string, unknown>>;
  responseHeaders?: Array<RowWithUid & Record<string, unknown>>;
  params?: Array<RowWithUid & Record<string, unknown>>;
  [key: string]: unknown;
}

interface ReorderPayload {
  savedOrder: readonly string[];
}

function isReorderPayload(p: unknown): p is ReorderPayload {
  return typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder);
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
  // Rows not in savedOrder (locally added) tail in their current
  // relative order.
  for (const row of rows) {
    if (row?.uid && byUid.has(row.uid)) out.push(row);
  }
  return out;
}

function findRowIndex(arr: readonly RowWithUid[] | undefined, uid: string): number {
  if (!arr) return -1;
  return arr.findIndex((r) => r.uid === uid);
}

function setPathToFormName(setPath: string): string | null {
  if (setPath === 'action.requestHeaders') return 'requestHeaders';
  if (setPath === 'action.responseHeaders') return 'responseHeaders';
  if (setPath === 'action.params') return 'params';
  if (setPath === 'conditions') return 'conditions';
  return null;
}

function setArrayOnRule(
  rule: V5.Rule,
  setPath: string,
): { get(): Array<{ uid?: string }>; set(next: Array<{ uid?: string }>): boolean } | null {
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

function applyResolutionToForm(
  form: FormInstance,
  rule: V5.Rule,
  path: string,
  conflict: PathConflict,
): boolean {
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

function applyResolutionToEntity(rule: V5.Rule, path: string, conflict: PathConflict): boolean {
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

// ── Pretty-path labels (rule-specific) ─────────────────────────────

const SCALAR_LABEL: Record<string, string> = {
  redirectTo: 'Redirect URL',
  delayMs: 'Delay (ms)',
  injectType: 'Inject type',
  source: 'Inject source',
  code: 'Inject code',
  sourceUrl: 'Inject source URL',
  position: 'Inject position',
  body: 'Body',
  bodyType: 'Body type',
  resourceType: 'Resource type',
  statusCode: 'Mock status code',
  responseBody: 'Mock response body',
  contentType: 'Mock content type',
};

const HEADER_LEAF: Record<string, string> = {
  value: 'value',
  headerName: 'name',
  operation: 'operation',
  mergeSeparator: 'merge separator',
};

const PARAM_LEAF: Record<string, string> = {
  value: 'value',
  param: 'name',
  operation: 'operation',
};

const CONDITION_LEAF: Record<string, string> = {
  values: 'values',
  field: 'field',
  headerName: 'header name',
};

function findHeaderName(rule: V5.Rule, set: 'requestHeaders' | 'responseHeaders', uid: string): string | null {
  if (rule.type !== 'header') return null;
  const arr = set === 'requestHeaders' ? rule.action.requestHeaders : rule.action.responseHeaders;
  return arr?.find((h) => h.uid === uid)?.headerName ?? null;
}

function findParamName(rule: V5.Rule, uid: string): string | null {
  if (rule.type !== 'query-param') return null;
  return rule.action.params?.find((p) => p.uid === uid)?.param ?? null;
}

function setPathSummary(setPath: string): string {
  if (setPath === 'action.requestHeaders') return 'Request header';
  if (setPath === 'action.responseHeaders') return 'Response header';
  if (setPath === 'action.params') return 'Query param';
  if (setPath === 'conditions') return 'Condition';
  return setPath;
}

function prettyPath(rule: V5.Rule, path: string): string {
  if (path.startsWith('reorder:')) {
    const setPath = path.slice('reorder:'.length);
    const kind = setPathSummary(setPath);
    return `${kind}s — order changed`;
  }
  if (path.startsWith('set:')) {
    const m = /^set:(.+)\.([a-z0-9]{8})$/.exec(path);
    if (!m) return path;
    const setPath = m[1];
    const uid = m[2];
    const kind = setPathSummary(setPath);
    if (setPath === 'action.requestHeaders' || setPath === 'action.responseHeaders') {
      const dir = setPath === 'action.requestHeaders' ? 'requestHeaders' : 'responseHeaders';
      const arr = rule.type === 'header' ? rule.action[dir] : undefined;
      const found = arr?.find((h) => h.uid === uid);
      return found ? `${kind} ${found.headerName}` : kind;
    }
    if (setPath === 'action.params' && rule.type === 'query-param') {
      const found = rule.action.params?.find((p) => p.uid === uid);
      return found ? `${kind} ${found.param}` : kind;
    }
    if (setPath === 'conditions') {
      const found = rule.conditions?.find((c) => c.uid === uid);
      return found ? `${kind} ${found.type}` : kind;
    }
    return kind;
  }

  if (path === 'name') return 'Name';

  if (path.startsWith('conditions.')) {
    const m = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/.exec(path);
    if (m) {
      const leaf = CONDITION_LEAF[m[2]] ?? m[2];
      return `Condition ${leaf}`;
    }
    return path;
  }

  if (!path.startsWith('action.')) return path;
  const tail = path.slice('action.'.length);

  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(
    tail,
  );
  if (headerMod) {
    const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
    const uid = headerMod[2];
    const leaf = HEADER_LEAF[headerMod[3]] ?? headerMod[3];
    const dir = set === 'requestHeaders' ? 'Request' : 'Response';
    const name = findHeaderName(rule, set, uid);
    return name ? `${dir} header ${name} (${leaf})` : `${dir} header (${leaf})`;
  }

  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) {
    const uid = queryParam[1];
    const leaf = PARAM_LEAF[queryParam[2]] ?? queryParam[2];
    const name = findParamName(rule, uid);
    return name ? `Query param ${name} (${leaf})` : `Query param (${leaf})`;
  }

  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) {
    const headerName = mockHeader[1];
    const leaf = mockHeader[2];
    return `Mock response header ${headerName} (${leaf})`;
  }

  if (!tail.includes('.') && SCALAR_LABEL[tail]) return SCALAR_LABEL[tail];

  return path;
}

export const ruleResolveAdapter: ConflictResolveAdapter<V5.Rule> = {
  applyResolutionToForm,
  applyResolutionToEntity,
  prettyPath,
};
