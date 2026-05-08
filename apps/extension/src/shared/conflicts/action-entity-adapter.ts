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
import { buildActionEntitySchema } from './field-tree/action-subtree';
import { makeConflictAdapter } from './field-tree/make-conflict-adapter';
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
  /** Schema field at the entity root that holds the rule-type
   *  discriminator. Used by the field-tree walker's union descent —
   *  `'type'` for Rule, `'ruleType'` for Template. */
  discriminatorField: 'type' | 'ruleType';
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

// ── Tracking adapter ──────────────────────────────────────────────

function makeTrackingAdapter<E extends { uid: string }>(
  paths: ActionPathBundle,
  accessors: ActionEntityAccessors<E>,
): ConflictTrackingAdapter<E> {
  const sets = buildSetDefs(paths, accessors);
  const a = paths.actionRoot;
  const headerModRe = new RegExp(
    `^${a}\\.(requestHeaders|responseHeaders)\\.([a-z0-9]{8})\\.(value|headerName|operation|mergeSeparator)$`,
  );
  const queryParamRe = new RegExp(`^${a}\\.${paths.queryParamKey}\\.([a-z0-9]{8})\\.(param|value|operation)$`);
  const mockHeaderRe = new RegExp(`^${a}\\.responseHeaders\\.([^.]+)\\.(name|value)$`);
  const conditionsRe = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/;
  const walker = makeConflictAdapter<E>({
    schema: buildActionEntitySchema(paths, { discriminatorField: accessors.discriminatorField }),
    signature: accessors.signature,
  });

  function readPath(entity: E, path: string): string | null {
    // Structural divergence markers (`union:<prefix>`) are emitted by
    // the walker's baseline projection; delegate the live read to the
    // walker so the hook's kind-transition recognition stays consistent.
    if (path.startsWith('union:')) return walker.tracking.readPath(entity, path);
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

  // Pulls path-keyed form values into per-uid leaf maps under one
  // prefix. Used by the conditions wrapper below; the walker handles
  // its own action-rooted sets via `snapshotSetsFromForm`.
  function collectFormPrefix(form: PathMap, prefix: string): Map<string, Record<string, unknown>> {
    const byUid = new Map<string, Record<string, unknown>>();
    for (const key of Object.keys(form)) {
      if (!key.startsWith(`${prefix}.`)) continue;
      const tail = key.slice(prefix.length + 1);
      const m = /^([a-z0-9]{8})\.(.+)$/.exec(tail);
      if (!m) continue;
      const slot = byUid.get(m[1]) ?? {};
      slot[m[2]] = form[key];
      byUid.set(m[1], slot);
    }
    return byUid;
  }

  function extractBaseline(entity: E): PathMap {
    // Walker handles `name` + the action subtree (header/respHeader sets,
    // query-param sets, per-type scalars). Conditions + mock response
    // headers wrap on top — both have schema-vs-path-key shapes that
    // don't round-trip cleanly through the descriptor.
    const out: PathMap = { ...walker.tracking.extractBaseline(entity) };
    for (const c of accessors.getConditions(entity)) {
      out[paths.condition(c.uid, 'values')] = (c.values ?? []).join(', ');
      out[paths.condition(c.uid, 'field')] = String(c.type);
    }
    if (accessors.getRuleType(entity) === 'mock') {
      const map = (accessors.getActionRoot(entity)?.responseHeaders as Record<string, string> | undefined) ?? {};
      for (const [headerName, headerValue] of Object.entries(map)) {
        out[paths.mockHeader(headerName, 'name')] = headerName;
        out[paths.mockHeader(headerName, 'value')] = String(headerValue ?? '');
      }
    }
    return out;
  }

  function snapshotSets(entity: E): readonly SetMemberSnapshot[] {
    const out: SetMemberSnapshot[] = [...walker.tracking.snapshotSets(entity)];
    const byUid = new Map<string, SetMember>();
    for (const row of sets.conditions.getter(entity) ?? []) {
      byUid.set(row.uid, { uid: row.uid, summary: sets.conditions.summarize(row), payload: row });
    }
    out.push({ setPath: sets.conditions.setPath, byUid });
    return out;
  }

  function snapshotSetsFromForm(form: PathMap, entity: E): readonly SetMemberSnapshot[] {
    const out: SetMemberSnapshot[] = [...walker.tracking.snapshotSetsFromForm(form, entity)];
    const slots = collectFormPrefix(form, 'conditions');
    const byUid = new Map<string, SetMember>();
    for (const [uid, leaves] of slots) byUid.set(uid, sets.conditions.fromForm(uid, leaves));
    out.push({ setPath: 'conditions', byUid });
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
  const headerSetReq = paths.headerSet('request');
  const headerSetRes = paths.headerSet('response');
  const queryParamSet = paths.queryParamSet;
  const walker = makeConflictAdapter<E>({
    schema: buildActionEntitySchema(paths, { discriminatorField: accessors.discriminatorField }),
    signature: accessors.signature,
    formNameForPath: (_entity, p) => {
      // Set paths — bridge schema-side path keys (rule's `params`) to
      // their Form.List name (`queryParams`) and pass header sets through.
      if (p === headerSetReq) return 'requestHeaders';
      if (p === headerSetRes) return 'responseHeaders';
      if (p === queryParamSet) return 'queryParams';
      // Entity-root scalars.
      if (p === 'name') return accessors.nameFormName ?? null;
      // All other action-rooted scalars use their tail (`action.redirectTo`
      // → `redirectTo`, `action.delayMs` → `delayMs`, etc.) — let the
      // walker fall back to the default. Conditions paths aren't in the
      // walker schema and never reach this hook from the form-side
      // collapser; the entity-side wrapper handles them.
      return undefined;
    },
  });

  function applyResolutionToForm(form: FormInstance, entity: E, path: string, conflict: PathConflict): boolean {
    return walker.resolve.applyResolutionToForm(form, entity, path, conflict);
  }

  function applyResolutionToEntity(entity: E, path: string, conflict: PathConflict): boolean {
    // Walker handles `name`, all action-rooted leaves, uid-keyed
    // set-add / set-remove / reorder under header + query-param sets,
    // and `union:<prefix>` whole-branch swaps.
    if (walker.resolve.applyResolutionToEntity(entity, path, conflict)) return true;

    // Conditions set ops route through the entity-level `setConditions`
    // accessor — conditions live outside the walker schema because the
    // path key `field` aliases schema field `type`.
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey?.setPath === 'conditions') {
      if (!isReorderPayload(conflict.rowPayload)) return false;
      const current = accessors.getConditions(entity) as readonly { uid: string }[];
      if (current.length === 0) return false;
      accessors.setConditions(entity, reorderRows(current, conflict.rowPayload.savedOrder) as V5.RuleCondition[]);
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey?.setPath === 'conditions') {
      const current = accessors.getConditions(entity) as readonly { uid: string }[];
      if (conflict.kind === 'set-add') {
        if (conflict.rowPayload === undefined) return false;
        if (current.some((r) => r.uid === setKey.uid)) return false;
        accessors.setConditions(
          entity,
          [...current, conflict.rowPayload as { uid: string }] as V5.RuleCondition[],
        );
        return true;
      }
      if (conflict.kind === 'set-remove') {
        const next = current.filter((r) => r.uid !== setKey.uid);
        if (next.length === current.length) return false;
        accessors.setConditions(entity, next as V5.RuleCondition[]);
        return true;
      }
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
