/**
 * Shared adapter factory for action-rooted entities — rule + template.
 *
 * Both entities reuse the same per-rule-type field components
 * (`rule-fields/*`) and therefore observe identical conflict structure
 * (header/param/condition sets, scalar action leaves, mock response
 * headers). They differ only along three axes:
 *
 *   1. **Action root key.** Rule persists action data under `action.*`;
 *      Template under `formValues.*`. Encoded by the bundle's
 *      `actionRoot` (same convention used by the field components via
 *      `useActionPaths()`).
 *   2. **Query-param key.** Rule uses `params`, Template uses
 *      `queryParams` — also bundle-encoded.
 *   3. **Form ownership of metadata.** Rule's `name` is externally
 *      owned (sidebar / breadcrumb rename); the form has no `name`
 *      input. Template's `name` lives in the form as `templateName`.
 *      Wired via the optional `nameFormName` accessor.
 *
 * Everything else — set-extraction, baseline projection, path decoding,
 * leaf resolution — is identical in shape. This factory captures that
 * shape once. Per-entity adapters are thin bindings that supply the
 * accessors + bundle.
 */

import type { FormInstance } from 'antd';
import type { V5 } from '@openheaders/core/types';
import type { ActionPathBundle } from '@/shared/awareness';
import { decodeReorderConflictKey, decodeSetConflictKey } from './conflict-keys';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from './conflict-adapters';
import type { PathConflict } from './types';

// ── Accessors ──────────────────────────────────────────────────────

/**
 * Per-entity glue. The factory works against any entity that exposes a
 * V5.Rule['type'] discriminator + a stable uid + a Record-shaped action
 * subtree at `entity[actionRoot]`.
 */
export interface ActionEntityAccessors<E extends { uid: string }> {
  signature: (entity: E) => string;
  /** Discriminator that selects the action-shape (header / inject /
   *  body / mock / …). Both rule (`rule.type`) and template
   *  (`template.ruleType`) project to the same V5.Rule['type'] union. */
  getRuleType: (entity: E) => V5.Rule['type'];
  /** Read entity name. Both entities expose `name: string` at the
   *  schema root. */
  getName: (entity: E) => string;
  /** Read conditions array. Both entities expose `conditions:
   *  RuleCondition[]` at the schema root. */
  getConditions: (entity: E) => readonly V5.RuleCondition[];
  /** Mutate the entity's name in place. Used by `applyResolutionToEntity`
   *  for the diff dialog right-pane preview. */
  setName: (entity: E, value: string) => void;
  /** Mutate the entity's conditions in place. */
  setConditions: (entity: E, value: V5.RuleCondition[]) => void;
  /** Get a mutable reference to the action root container —
   *  `rule.action` for Rule, `template.formValues` for Template. */
  getActionRoot: (entity: E) => Record<string, unknown> | undefined;
  /** When the editor's form owns the name field, this is the form
   *  field name to write into on `applyResolutionToForm` for `path =
   *  'name'`. Returns null when the form doesn't own the name. */
  nameFormName?: string | null;
}

// ── Tracking-side helpers ──────────────────────────────────────────

interface SetDef<E> {
  /** Canonical schema path of the set — e.g. `action.requestHeaders` /
   *  `formValues.queryParams`. Built from the bundle. */
  setPath: string;
  /** Form-side name (Form.List name=). Identical between rule + template
   *  because the field components live in `rule-fields/*`. */
  formName: string;
  /** Array reader on the entity. Returns undefined for non-applicable
   *  rule types (e.g. params on a header rule). */
  getter: (entity: E) => readonly { uid: string; [k: string]: unknown }[] | undefined;
  /** Compact human summary used in the diff dialog table. */
  summarize: (row: { uid: string; [k: string]: unknown }) => string;
  /** Form-row → SetMember projection used by `snapshotSetsFromForm`. */
  fromForm: (uid: string, leaves: Record<string, unknown>) => SetMember;
}

function buildSetDefs<E extends { uid: string }>(
  paths: ActionPathBundle,
  accessors: ActionEntityAccessors<E>,
): { byType: Record<V5.Rule['type'], readonly SetDef<E>[]>; conditions: SetDef<E> } {
  const headerDir = (direction: 'request' | 'response'): SetDef<E> => ({
    setPath: paths.headerSet(direction),
    formName: direction === 'request' ? 'requestHeaders' : 'responseHeaders',
    getter: (entity) => {
      if (accessors.getRuleType(entity) !== 'header') return undefined;
      const root = accessors.getActionRoot(entity);
      const arr = root?.[direction === 'request' ? 'requestHeaders' : 'responseHeaders'];
      return Array.isArray(arr) ? (arr as { uid: string; [k: string]: unknown }[]) : undefined;
    },
    summarize: (h) => `${(h.headerName as string) ?? ''}: ${(h.value as string) ?? ''}`,
    fromForm: (uid, leaves) => ({
      uid,
      summary: `${(leaves.headerName as string) ?? ''}: ${(leaves.value as string) ?? ''}`,
      payload: { uid, headerName: leaves.headerName, value: leaves.value },
    }),
  });
  const queryParamDef: SetDef<E> = {
    setPath: paths.queryParamSet,
    formName: 'queryParams',
    getter: (entity) => {
      if (accessors.getRuleType(entity) !== 'query-param') return undefined;
      const root = accessors.getActionRoot(entity);
      const arr = root?.[paths.queryParamKey];
      return Array.isArray(arr) ? (arr as { uid: string; [k: string]: unknown }[]) : undefined;
    },
    summarize: (p) => `${(p.param as string) ?? ''}=${(p.value as string) ?? ''}`,
    fromForm: (uid, leaves) => ({
      uid,
      summary: `${(leaves.param as string) ?? ''}=${(leaves.value as string) ?? ''}`,
      payload: { uid, param: leaves.param, value: leaves.value },
    }),
  };
  const conditionsDef: SetDef<E> = {
    setPath: 'conditions',
    formName: 'conditions',
    getter: (entity) => accessors.getConditions(entity) as readonly { uid: string; [k: string]: unknown }[],
    summarize: (c) =>
      c.headerName
        ? `${c.type as string} ${c.headerName as string} ${(c.values as string[] | undefined)?.join(', ') ?? ''}`
        : `${c.type as string} ${(c.values as string[] | undefined)?.join(', ') ?? ''}`,
    fromForm: (uid, leaves) => ({ uid, summary: (leaves.field as string) ?? uid, payload: { uid } }),
  };
  return {
    byType: {
      header: [headerDir('request'), headerDir('response')],
      'query-param': [queryParamDef],
      block: [],
      redirect: [],
      inject: [],
      delay: [],
      body: [],
      mock: [],
    },
    conditions: conditionsDef,
  };
}

function buildScalarPaths(paths: ActionPathBundle): Record<V5.Rule['type'], readonly string[]> {
  return {
    header: [],
    block: [],
    'query-param': [],
    redirect: [paths.redirectTo],
    delay: [paths.delayMs],
    inject: [paths.injectCode, paths.injectSourceUrl, paths.injectType, paths.injectSource, paths.injectPosition],
    body: [paths.body, paths.bodyType, paths.bodyResourceType],
    mock: [paths.mockStatusCode, paths.mockResponseBody, paths.mockContentType, paths.mockBodyType],
  };
}

// ── Tracking adapter ──────────────────────────────────────────────

function makeTrackingAdapter<E extends { uid: string }>(
  paths: ActionPathBundle,
  accessors: ActionEntityAccessors<E>,
): ConflictTrackingAdapter<E> {
  const sets = buildSetDefs(paths, accessors);
  const scalars = buildScalarPaths(paths);
  const a = paths.actionRoot;
  const headerModRe = new RegExp(
    `^${a}\\.(requestHeaders|responseHeaders)\\.([a-z0-9]{8})\\.(value|headerName|operation|mergeSeparator)$`,
  );
  const queryParamRe = new RegExp(`^${a}\\.${paths.queryParamKey}\\.([a-z0-9]{8})\\.(param|value|operation)$`);
  const mockHeaderRe = new RegExp(`^${a}\\.responseHeaders\\.([^.]+)\\.(name|value)$`);
  const conditionsRe = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/;

  function readPath(entity: E, path: string): string | null {
    if (path === 'name') return String(accessors.getName(entity) ?? '');
    const condM = conditionsRe.exec(path);
    if (condM) {
      const uid = condM[1];
      const leaf = condM[2] as 'values' | 'field' | 'headerName';
      const c = accessors.getConditions(entity).find((c) => c.uid === uid);
      if (!c) return null;
      if (leaf === 'values') return (c.values ?? []).join(', ');
      if (leaf === 'field') return String(c.type);
      if (leaf === 'headerName') return String(c.headerName ?? '');
      return null;
    }
    if (!path.startsWith(`${a}.`)) return null;
    const root = accessors.getActionRoot(entity);
    if (!root) return null;
    const headerMod = headerModRe.exec(path);
    if (headerMod) {
      if (accessors.getRuleType(entity) !== 'header') return null;
      const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
      const uid = headerMod[2];
      const leaf = headerMod[3] as 'value' | 'headerName' | 'operation' | 'mergeSeparator';
      const arr = root[set] as { uid: string; [k: string]: unknown }[] | undefined;
      const item = arr?.find((h) => h.uid === uid);
      if (!item) return null;
      return String(item[leaf] ?? '');
    }
    const queryParam = queryParamRe.exec(path);
    if (queryParam) {
      if (accessors.getRuleType(entity) !== 'query-param') return null;
      const uid = queryParam[1];
      const leaf = queryParam[2] as 'param' | 'value' | 'operation';
      const arr = root[paths.queryParamKey] as { uid: string; [k: string]: unknown }[] | undefined;
      const item = arr?.find((p) => p.uid === uid);
      if (!item) return null;
      return String(item[leaf] ?? '');
    }
    const mockHeader = mockHeaderRe.exec(path);
    if (mockHeader) {
      if (accessors.getRuleType(entity) !== 'mock') return null;
      const headerName = mockHeader[1];
      const leaf = mockHeader[2] as 'name' | 'value';
      const map = (root.responseHeaders as Record<string, string> | undefined) ?? {};
      if (!(headerName in map)) return null;
      if (leaf === 'name') return headerName;
      return String(map[headerName] ?? '');
    }
    // Scalar action leaf (path = `${a}.X` where X has no further dots).
    const tail = path.slice(a.length + 1);
    if (tail.includes('.')) return null;
    const value = root[tail];
    if (value === undefined || value === null) return null;
    return String(value);
  }

  function extractBaseline(entity: E): PathMap {
    const out: PathMap = {};
    out.name = String(accessors.getName(entity) ?? '');
    for (const c of accessors.getConditions(entity)) {
      out[paths.condition(c.uid, 'values')] = (c.values ?? []).join(', ');
      out[paths.condition(c.uid, 'field')] = String(c.type);
    }
    const ruleType = accessors.getRuleType(entity);
    const root = accessors.getActionRoot(entity);
    if (root) {
      if (ruleType === 'header') {
        for (const dir of ['request', 'response'] as const) {
          const list = root[dir === 'request' ? 'requestHeaders' : 'responseHeaders'] as
            | { uid: string; [k: string]: unknown }[]
            | undefined;
          for (const h of list ?? []) {
            out[paths.headerMod(dir, h.uid, 'value')] = String(h.value ?? '');
            out[paths.headerMod(dir, h.uid, 'headerName')] = String(h.headerName ?? '');
          }
        }
      }
      if (ruleType === 'query-param') {
        const list = root[paths.queryParamKey] as { uid: string; [k: string]: unknown }[] | undefined;
        for (const p of list ?? []) {
          out[paths.queryParam(p.uid, 'param')] = String(p.param ?? '');
          out[paths.queryParam(p.uid, 'value')] = String(p.value ?? '');
        }
      }
      if (ruleType === 'mock') {
        const map = (root.responseHeaders as Record<string, string> | undefined) ?? {};
        for (const [headerName, headerValue] of Object.entries(map)) {
          out[paths.mockHeader(headerName, 'name')] = headerName;
          out[paths.mockHeader(headerName, 'value')] = String(headerValue ?? '');
        }
      }
      for (const path of scalars[ruleType] ?? []) {
        const v = readPath(entity, path);
        if (v !== null) out[path] = v;
      }
    }
    return out;
  }

  function snapshotSets(entity: E): readonly SetMemberSnapshot[] {
    const ruleType = accessors.getRuleType(entity);
    const out: SetMemberSnapshot[] = [];
    for (const def of sets.byType[ruleType] ?? []) {
      const byUid = new Map<string, SetMember>();
      for (const row of def.getter(entity) ?? []) {
        byUid.set(row.uid, { uid: row.uid, summary: def.summarize(row), payload: row });
      }
      out.push({ setPath: def.setPath, byUid });
    }
    {
      const byUid = new Map<string, SetMember>();
      for (const row of sets.conditions.getter(entity) ?? []) {
        byUid.set(row.uid, { uid: row.uid, summary: sets.conditions.summarize(row), payload: row });
      }
      out.push({ setPath: sets.conditions.setPath, byUid });
    }
    return out;
  }

  function snapshotSetsFromForm(form: PathMap, entity: E): readonly SetMemberSnapshot[] {
    const ruleType = accessors.getRuleType(entity);
    const collectFromPrefix = (prefix: string): Map<string, Record<string, unknown>> => {
      const byUid = new Map<string, Record<string, unknown>>();
      for (const key of Object.keys(form)) {
        if (!key.startsWith(`${prefix}.`)) continue;
        const tail = key.slice(prefix.length + 1);
        const m = /^([a-z0-9]{8})\.(.+)$/.exec(tail);
        if (!m) continue;
        const uid = m[1];
        const leaf = m[2];
        const slot = byUid.get(uid) ?? {};
        slot[leaf] = form[key];
        byUid.set(uid, slot);
      }
      return byUid;
    };
    const out: SetMemberSnapshot[] = [];
    for (const def of sets.byType[ruleType] ?? []) {
      const slots = collectFromPrefix(def.setPath);
      const byUid = new Map<string, SetMember>();
      for (const [uid, leaves] of slots) byUid.set(uid, def.fromForm(uid, leaves));
      out.push({ setPath: def.setPath, byUid });
    }
    {
      const slots = collectFromPrefix('conditions');
      const byUid = new Map<string, SetMember>();
      for (const [uid, leaves] of slots) byUid.set(uid, sets.conditions.fromForm(uid, leaves));
      out.push({ setPath: 'conditions', byUid });
    }
    return out;
  }

  return {
    signature: accessors.signature,
    extractBaseline,
    readPath,
    snapshotSets,
    snapshotSetsFromForm,
  };
}

// ── Resolve adapter ───────────────────────────────────────────────

interface DecodedActionPath {
  kind: 'name' | 'conditions' | 'header' | 'param' | 'mock-header' | 'scalar' | 'unknown';
  set?: 'requestHeaders' | 'responseHeaders';
  uid?: string;
  leaf?: string;
  scalar?: string;
}

interface ReorderPayload {
  savedOrder: readonly string[];
}

function isReorderPayload(p: unknown): p is ReorderPayload {
  return typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder);
}

function reorderRows<T extends { uid?: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
  const byUid = new Map<string, T>();
  for (const row of rows) if (row?.uid) byUid.set(row.uid, row);
  const out: T[] = [];
  for (const uid of savedOrder) {
    const row = byUid.get(uid);
    if (row) {
      out.push(row);
      byUid.delete(uid);
    }
  }
  for (const row of rows) if (row?.uid && byUid.has(row.uid)) out.push(row);
  return out;
}

const HEADER_LEAF_LABEL: Record<string, string> = {
  value: 'value',
  headerName: 'name',
  operation: 'operation',
  mergeSeparator: 'merge separator',
};
const PARAM_LEAF_LABEL: Record<string, string> = { value: 'value', param: 'name', operation: 'operation' };
const CONDITION_LEAF_LABEL: Record<string, string> = { values: 'values', field: 'field', headerName: 'header name' };
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

function makeResolveAdapter<E extends { uid: string }>(
  paths: ActionPathBundle,
  accessors: ActionEntityAccessors<E>,
): ConflictResolveAdapter<E> {
  const a = paths.actionRoot;
  const headerModRe = new RegExp(
    `^${a}\\.(requestHeaders|responseHeaders)\\.([a-z0-9]{8})\\.(value|headerName|operation|mergeSeparator)$`,
  );
  const queryParamRe = new RegExp(`^${a}\\.${paths.queryParamKey}\\.([a-z0-9]{8})\\.(param|value|operation)$`);
  const mockHeaderRe = new RegExp(`^${a}\\.responseHeaders\\.([^.]+)\\.(name|value)$`);

  function decodePath(path: string): DecodedActionPath {
    if (path === 'name') return { kind: 'name' };
    if (path.startsWith('conditions.')) return { kind: 'conditions' };
    if (!path.startsWith(`${a}.`)) return { kind: 'unknown' };
    const headerMod = headerModRe.exec(path);
    if (headerMod) {
      return {
        kind: 'header',
        set: headerMod[1] as 'requestHeaders' | 'responseHeaders',
        uid: headerMod[2],
        leaf: headerMod[3],
      };
    }
    const queryParam = queryParamRe.exec(path);
    if (queryParam) return { kind: 'param', uid: queryParam[1], leaf: queryParam[2] };
    if (mockHeaderRe.exec(path)) return { kind: 'mock-header' };
    const tail = path.slice(a.length + 1);
    if (!tail.includes('.')) return { kind: 'scalar', scalar: tail };
    return { kind: 'unknown' };
  }

  function setPathToFormName(setPath: string): string | null {
    if (setPath === paths.headerSet('request')) return 'requestHeaders';
    if (setPath === paths.headerSet('response')) return 'responseHeaders';
    if (setPath === paths.queryParamSet) return 'queryParams';
    if (setPath === 'conditions') return 'conditions';
    return null;
  }

  function setArrayOnEntity(
    entity: E,
    setPath: string,
  ): { get(): { uid?: string }[]; set(next: { uid?: string }[]): boolean } | null {
    if (setPath === 'conditions') {
      return {
        get: () => accessors.getConditions(entity) as unknown as { uid?: string }[],
        set: (next) => {
          accessors.setConditions(entity, next as V5.RuleCondition[]);
          return true;
        },
      };
    }
    const root = accessors.getActionRoot(entity);
    if (!root) return null;
    const headerSetReq = paths.headerSet('request');
    const headerSetRes = paths.headerSet('response');
    if (setPath === headerSetReq && accessors.getRuleType(entity) === 'header') {
      return {
        get: () => (root.requestHeaders as { uid?: string }[]) ?? [],
        set: (next) => {
          root.requestHeaders = next;
          return true;
        },
      };
    }
    if (setPath === headerSetRes && accessors.getRuleType(entity) === 'header') {
      return {
        get: () => (root.responseHeaders as { uid?: string }[]) ?? [],
        set: (next) => {
          root.responseHeaders = next;
          return true;
        },
      };
    }
    if (setPath === paths.queryParamSet && accessors.getRuleType(entity) === 'query-param') {
      return {
        get: () => (root[paths.queryParamKey] as { uid?: string }[]) ?? [],
        set: (next) => {
          root[paths.queryParamKey] = next;
          return true;
        },
      };
    }
    return null;
  }

  function applyResolutionToForm(form: FormInstance, entity: E, path: string, conflict: PathConflict): boolean {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      const formName = setPathToFormName(reorderKey.setPath);
      if (!formName || !isReorderPayload(conflict.rowPayload)) return false;
      const current = (form.getFieldValue(formName) as { uid?: string }[] | undefined) ?? [];
      if (current.length === 0) return false;
      form.setFieldValue(formName, reorderRows(current, conflict.rowPayload.savedOrder));
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      const formName = setPathToFormName(setKey.setPath);
      if (!formName) return false;
      const current = (form.getFieldValue(formName) as { uid?: string }[] | undefined) ?? [];
      if (conflict.kind === 'set-add') {
        if (conflict.rowPayload === undefined) return false;
        if (current.some((row) => row?.uid === setKey.uid)) return false;
        form.setFieldValue(formName, [...current, conflict.rowPayload as { uid?: string }]);
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
    if (decoded.kind === 'name') {
      if (!accessors.nameFormName) return false;
      form.setFieldValue(accessors.nameFormName, value);
      return true;
    }
    if (decoded.kind === 'header') {
      if (accessors.getRuleType(entity) !== 'header' || !decoded.uid || !decoded.leaf || !decoded.set) return false;
      const root = accessors.getActionRoot(entity);
      const arr = root?.[decoded.set] as { uid?: string }[] | undefined;
      const idx = arr?.findIndex((r) => r.uid === decoded.uid) ?? -1;
      if (idx < 0) return false;
      form.setFieldValue([decoded.set, idx, decoded.leaf], value);
      return true;
    }
    if (decoded.kind === 'param') {
      if (accessors.getRuleType(entity) !== 'query-param' || !decoded.uid || !decoded.leaf) return false;
      const root = accessors.getActionRoot(entity);
      const arr = root?.[paths.queryParamKey] as { uid?: string }[] | undefined;
      const idx = arr?.findIndex((r) => r.uid === decoded.uid) ?? -1;
      if (idx < 0) return false;
      form.setFieldValue(['queryParams', idx, decoded.leaf], value);
      return true;
    }
    if (decoded.kind === 'scalar' && decoded.scalar) {
      form.setFieldValue(decoded.scalar, value);
      return true;
    }
    return false;
  }

  function applyResolutionToEntity(entity: E, path: string, conflict: PathConflict): boolean {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      const set = setArrayOnEntity(entity, reorderKey.setPath);
      if (!set || !isReorderPayload(conflict.rowPayload)) return false;
      const current = set.get();
      if (current.length === 0) return false;
      set.set(reorderRows(current, conflict.rowPayload.savedOrder));
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      const set = setArrayOnEntity(entity, setKey.setPath);
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
      accessors.setName(entity, value);
      return true;
    }
    const root = accessors.getActionRoot(entity);
    if (!root) return false;
    if (decoded.kind === 'header') {
      if (accessors.getRuleType(entity) !== 'header' || !decoded.uid || !decoded.leaf || !decoded.set) return false;
      const arr = root[decoded.set] as { uid?: string; [k: string]: unknown }[] | undefined;
      const row = arr?.find((r) => r.uid === decoded.uid);
      if (!row) return false;
      row[decoded.leaf] = value;
      return true;
    }
    if (decoded.kind === 'param') {
      if (accessors.getRuleType(entity) !== 'query-param' || !decoded.uid || !decoded.leaf) return false;
      const arr = root[paths.queryParamKey] as { uid?: string; [k: string]: unknown }[] | undefined;
      const row = arr?.find((r) => r.uid === decoded.uid);
      if (!row) return false;
      row[decoded.leaf] = value;
      return true;
    }
    if (decoded.kind === 'scalar' && decoded.scalar) {
      root[decoded.scalar] = value;
      return true;
    }
    return false;
  }

  function setPathSummary(setPath: string): string {
    if (setPath === paths.headerSet('request')) return 'Request header';
    if (setPath === paths.headerSet('response')) return 'Response header';
    if (setPath === paths.queryParamSet) return 'Query param';
    if (setPath === 'conditions') return 'Condition';
    return setPath;
  }

  function findHeaderName(entity: E, set: 'requestHeaders' | 'responseHeaders', uid: string): string | null {
    if (accessors.getRuleType(entity) !== 'header') return null;
    const arr = accessors.getActionRoot(entity)?.[set] as { uid: string; headerName?: string }[] | undefined;
    return arr?.find((h) => h.uid === uid)?.headerName ?? null;
  }

  function findParamName(entity: E, uid: string): string | null {
    if (accessors.getRuleType(entity) !== 'query-param') return null;
    const arr = accessors.getActionRoot(entity)?.[paths.queryParamKey] as
      | { uid: string; param?: string }[]
      | undefined;
    return arr?.find((p) => p.uid === uid)?.param ?? null;
  }

  function prettyPath(entity: E, path: string): string {
    if (path.startsWith('reorder:')) {
      const setPath = path.slice('reorder:'.length);
      return `${setPathSummary(setPath)}s — order changed`;
    }
    if (path.startsWith('set:')) {
      const m = /^set:(.+)\.([a-z0-9]{8})$/.exec(path);
      if (!m) return path;
      const setPath = m[1];
      const uid = m[2];
      const kind = setPathSummary(setPath);
      if (setPath === paths.headerSet('request') || setPath === paths.headerSet('response')) {
        const dir = setPath === paths.headerSet('request') ? 'requestHeaders' : 'responseHeaders';
        const name = findHeaderName(entity, dir, uid);
        return name ? `${kind} ${name}` : kind;
      }
      if (setPath === paths.queryParamSet) {
        const name = findParamName(entity, uid);
        return name ? `${kind} ${name}` : kind;
      }
      if (setPath === 'conditions') {
        const found = accessors.getConditions(entity).find((c) => c.uid === uid);
        return found ? `${kind} ${found.type}` : kind;
      }
      return kind;
    }
    if (path === 'name') return 'Name';
    const condM = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/.exec(path);
    if (condM) {
      const leaf = CONDITION_LEAF_LABEL[condM[2]] ?? condM[2];
      return `Condition ${leaf}`;
    }
    if (!path.startsWith(`${a}.`)) return path;
    const headerMod = headerModRe.exec(path);
    if (headerMod) {
      const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
      const uid = headerMod[2];
      const leaf = HEADER_LEAF_LABEL[headerMod[3]] ?? headerMod[3];
      const dir = set === 'requestHeaders' ? 'Request' : 'Response';
      const name = findHeaderName(entity, set, uid);
      return name ? `${dir} header ${name} (${leaf})` : `${dir} header (${leaf})`;
    }
    const queryParam = queryParamRe.exec(path);
    if (queryParam) {
      const uid = queryParam[1];
      const leaf = PARAM_LEAF_LABEL[queryParam[2]] ?? queryParam[2];
      const name = findParamName(entity, uid);
      return name ? `Query param ${name} (${leaf})` : `Query param (${leaf})`;
    }
    const mockHeader = mockHeaderRe.exec(path);
    if (mockHeader) {
      const headerName = mockHeader[1];
      const leaf = mockHeader[2];
      return `Mock response header ${headerName} (${leaf})`;
    }
    const tail = path.slice(a.length + 1);
    if (!tail.includes('.') && SCALAR_LABEL[tail]) return SCALAR_LABEL[tail];
    return path;
  }

  return { applyResolutionToForm, applyResolutionToEntity, prettyPath };
}

// ── Public factory ─────────────────────────────────────────────────

export interface ActionEntityAdapters<E extends { uid: string }> {
  tracking: ConflictTrackingAdapter<E>;
  resolve: ConflictResolveAdapter<E>;
}

export function createActionEntityAdapters<E extends { uid: string }>(
  paths: ActionPathBundle,
  accessors: ActionEntityAccessors<E>,
): ActionEntityAdapters<E> {
  return {
    tracking: makeTrackingAdapter(paths, accessors),
    resolve: makeResolveAdapter(paths, accessors),
  };
}
