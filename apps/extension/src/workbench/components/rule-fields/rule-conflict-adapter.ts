/**
 * `ConflictTrackingAdapter<V5.Rule>` implementation.
 *
 * Extracts the rule-specific projection logic that historically lived
 * inside `useRuleConflicts`. Pure functions; consumed by the generic
 * `useEntityConflicts` factory in `shared/conflicts/`.
 */

import type { V5 } from '@openheaders/core/types';
import { RULE_ACTION_PATHS } from '@/shared/awareness';
import type {
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';

const SCALAR_PATHS_BY_TYPE: Record<V5.Rule['type'], readonly string[]> = {
  header: [],
  redirect: ['action.redirectTo'],
  delay: ['action.delayMs'],
  inject: ['action.code', 'action.sourceUrl', 'action.injectType', 'action.source', 'action.position'],
  body: ['action.body', 'action.bodyType', 'action.resourceType'],
  mock: ['action.statusCode', 'action.responseBody', 'action.contentType', 'action.bodyType'],
  block: [],
  'query-param': [],
};

function readPath(rule: V5.Rule, path: string): string | null {
  if (path === 'name') return String(rule.name ?? '');
  if (path.startsWith('conditions.')) {
    const m = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/.exec(path);
    if (!m) return null;
    const uid = m[1];
    const leaf = m[2] as 'values' | 'field' | 'headerName';
    const c = rule.conditions.find((c) => c.uid === uid);
    if (!c) return null;
    if (leaf === 'values') return (c.values ?? []).join(', ');
    if (leaf === 'field') return String(c.type);
    if (leaf === 'headerName') return String(c.headerName ?? '');
    return null;
  }
  if (!path.startsWith('action.')) return null;
  const tail = path.slice('action.'.length);
  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(tail);
  if (headerMod) {
    if (rule.type !== 'header') return null;
    const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
    const uid = headerMod[2];
    const leaf = headerMod[3] as 'value' | 'headerName' | 'operation' | 'mergeSeparator';
    const arr = set === 'requestHeaders' ? rule.action.requestHeaders : rule.action.responseHeaders;
    const item = (arr ?? []).find((h) => h.uid === uid);
    if (!item) return null;
    return String((item[leaf] as string | undefined) ?? '');
  }
  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) {
    if (rule.type !== 'query-param') return null;
    const uid = queryParam[1];
    const leaf = queryParam[2] as 'param' | 'value' | 'operation';
    const item = (rule.action.params ?? []).find((p) => p.uid === uid);
    if (!item) return null;
    return String((item[leaf] as string | undefined) ?? '');
  }
  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) {
    if (rule.type !== 'mock') return null;
    const headerName = mockHeader[1];
    const leaf = mockHeader[2] as 'name' | 'value';
    const map = rule.action.responseHeaders ?? {};
    if (!(headerName in map)) return null;
    if (leaf === 'name') return headerName;
    return String(map[headerName] ?? '');
  }
  const action = (rule as { action?: Record<string, unknown> }).action;
  if (!action || typeof action !== 'object') return null;
  const value = action[tail];
  if (value === undefined || value === null) return null;
  return String(value);
}

function extractBaseline(rule: V5.Rule): PathMap {
  const paths: PathMap = {};
  paths.name = String(rule.name ?? '');
  for (const c of rule.conditions ?? []) {
    paths[RULE_ACTION_PATHS.condition(c.uid, 'values')] = (c.values ?? []).join(', ');
    paths[RULE_ACTION_PATHS.condition(c.uid, 'field')] = String(c.type);
  }
  if (rule.type === 'header') {
    const dirs: Array<'request' | 'response'> = ['request', 'response'];
    for (const dir of dirs) {
      const list = dir === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
      for (const h of list ?? []) {
        paths[RULE_ACTION_PATHS.headerMod(dir, h.uid, 'value')] = String(h.value ?? '');
        paths[RULE_ACTION_PATHS.headerMod(dir, h.uid, 'headerName')] = String(h.headerName ?? '');
      }
    }
  }
  if (rule.type === 'query-param') {
    for (const p of rule.action.params ?? []) {
      paths[RULE_ACTION_PATHS.queryParam(p.uid, 'param')] = String(p.param ?? '');
      paths[RULE_ACTION_PATHS.queryParam(p.uid, 'value')] = String(p.value ?? '');
    }
  }
  if (rule.type === 'mock') {
    for (const [headerName, headerValue] of Object.entries(rule.action.responseHeaders ?? {})) {
      paths[RULE_ACTION_PATHS.mockHeader(headerName, 'name')] = headerName;
      paths[RULE_ACTION_PATHS.mockHeader(headerName, 'value')] = String(headerValue ?? '');
    }
  }
  for (const path of SCALAR_PATHS_BY_TYPE[rule.type] ?? []) {
    const value = readPath(rule, path);
    if (value !== null) paths[path] = value;
  }
  return paths;
}

const SET_PATHS_BY_TYPE: Partial<
  Record<V5.Rule['type'], readonly { setPath: string; getter: (r: V5.Rule) => readonly SetMember[] }[]>
> = {
  header: [
    {
      setPath: 'action.requestHeaders',
      getter: (r) =>
        r.type === 'header'
          ? (r.action.requestHeaders ?? []).map((h) => ({
              uid: h.uid,
              summary: `${h.headerName}: ${h.value ?? ''}`,
              payload: h,
            }))
          : [],
    },
    {
      setPath: 'action.responseHeaders',
      getter: (r) =>
        r.type === 'header'
          ? (r.action.responseHeaders ?? []).map((h) => ({
              uid: h.uid,
              summary: `${h.headerName}: ${h.value ?? ''}`,
              payload: h,
            }))
          : [],
    },
  ],
  'query-param': [
    {
      setPath: 'action.params',
      getter: (r) =>
        r.type === 'query-param'
          ? (r.action.params ?? []).map((p) => ({
              uid: p.uid,
              summary: `${p.param}=${p.value ?? ''}`,
              payload: p,
            }))
          : [],
    },
  ],
};

const CONDITIONS_SET = {
  setPath: 'conditions',
  getter: (r: V5.Rule): readonly SetMember[] =>
    (r.conditions ?? []).map((c) => ({
      uid: c.uid,
      summary: c.headerName
        ? `${c.type} ${c.headerName} ${c.values?.join(', ') ?? ''}`
        : `${c.type} ${c.values?.join(', ') ?? ''}`,
      payload: c,
    })),
};

function snapshotSets(rule: V5.Rule): readonly SetMemberSnapshot[] {
  const out: SetMemberSnapshot[] = [];
  for (const def of SET_PATHS_BY_TYPE[rule.type] ?? []) {
    const byUid = new Map<string, SetMember>();
    for (const m of def.getter(rule)) byUid.set(m.uid, m);
    out.push({ setPath: def.setPath, byUid });
  }
  const byUid = new Map<string, SetMember>();
  for (const m of CONDITIONS_SET.getter(rule)) byUid.set(m.uid, m);
  out.push({ setPath: CONDITIONS_SET.setPath, byUid });
  return out;
}

/**
 * Build a transient `V5.Rule`-shaped probe from a path-keyed form
 * projection so set-extraction can reuse `snapshotSets`. The shape
 * comes from `extractBaseline`'s output keys; we need only the set
 * membership (uids), not the full schema, so a minimal reconstruction
 * is enough for diff purposes.
 */
function snapshotSetsFromForm(form: PathMap, rule: V5.Rule): readonly SetMemberSnapshot[] {
  const collect = (prefix: string): Set<string> => {
    const uids = new Set<string>();
    for (const key of Object.keys(form)) {
      if (!key.startsWith(`${prefix}.`)) continue;
      const tail = key.slice(prefix.length + 1);
      const m = /^([a-z0-9]{8})\./.exec(tail);
      if (m) uids.add(m[1]);
    }
    return uids;
  };
  const out: SetMemberSnapshot[] = [];
  const formAsRule = (uid: string, prefix: string): SetMember => {
    const leafLookup = (leaf: string) => form[`${prefix}.${uid}.${leaf}`];
    if (prefix === 'action.requestHeaders' || prefix === 'action.responseHeaders') {
      return {
        uid,
        summary: `${leafLookup('headerName') ?? ''}: ${leafLookup('value') ?? ''}`,
        payload: { uid, headerName: leafLookup('headerName'), value: leafLookup('value') },
      };
    }
    if (prefix === 'action.params') {
      return {
        uid,
        summary: `${leafLookup('param') ?? ''}=${leafLookup('value') ?? ''}`,
        payload: { uid, param: leafLookup('param'), value: leafLookup('value') },
      };
    }
    return { uid, summary: uid, payload: { uid } };
  };
  for (const def of SET_PATHS_BY_TYPE[rule.type] ?? []) {
    const uids = collect(def.setPath);
    const byUid = new Map<string, SetMember>();
    for (const uid of uids) byUid.set(uid, formAsRule(uid, def.setPath));
    out.push({ setPath: def.setPath, byUid });
  }
  // Conditions: keyed by uid via `conditions.<uid>.field|values`.
  {
    const uids = collect('conditions');
    const byUid = new Map<string, SetMember>();
    for (const uid of uids) byUid.set(uid, { uid, summary: form[`conditions.${uid}.field`] ?? uid, payload: { uid } });
    out.push({ setPath: 'conditions', byUid });
  }
  return out;
}

export const ruleConflictAdapter: ConflictTrackingAdapter<V5.Rule> = {
  signature: (rule) => rule.uid,
  extractBaseline,
  readPath,
  snapshotSets,
  snapshotSetsFromForm,
};
