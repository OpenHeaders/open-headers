/**
 * `ConflictTrackingAdapter<V5.Request>` + `ConflictResolveAdapter<V5.Request>`
 * — pure projection + write-side adapters for the entity-agnostic
 * conflict tracker.
 *
 * Request differs from Rule + Template along two axes that prevent
 * sharing the action-entity factory in `shared/conflicts/`:
 *
 *   1. Different action shape — request has url + method + headers +
 *      params + auth + body at the entity root, no rule-type
 *      discriminator.
 *   2. Different editor shape — RequestEditor uses controlled
 *      `useState<Draft>` rather than antd Form, so
 *      `applyResolutionToForm` is a no-op; resolution writes go
 *      through `applyResolutionToEntity` against a V5.Request clone
 *      and the editor converts back to its draft shape.
 *
 * Sets are uid-keyed (RequestHeaderSchema + QueryParamSchema persist
 * `uid: UidSchema`); paths align with REQUEST_PATHS.
 *
 * Auth + body are tracked as opaque JSON-serialized scalars at v1 —
 * surfacing per-leaf conflicts inside the discriminated unions adds
 * complexity for limited gain when the dominant collision class is
 * scalar / header / param edits. The diff dialog still shows the full
 * YAML so the user sees the auth/body delta in context.
 */

import { stableStringify } from '@/shared/forms';
import type { V5 } from '@openheaders/core/types';
import { REQUEST_PATHS } from '@/shared/awareness';
import {
  decodeReorderConflictKey,
  decodeSetConflictKey,
} from '@/shared/conflicts/conflict-keys';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';
import type { PathConflict } from '@/shared/conflicts/types';

// ── Tracking ──────────────────────────────────────────────────────

const HEADER_LEAVES = ['key', 'value', 'description', 'enabled'] as const;
const PARAM_LEAVES = ['key', 'value', 'description', 'enabled', 'hasEquals'] as const;
type HeaderLeaf = (typeof HEADER_LEAVES)[number];
type ParamLeaf = (typeof PARAM_LEAVES)[number];

const HEADER_PATH_RE = /^headers\.([a-z0-9]{8})\.(key|value|description|enabled)$/;
const PARAM_PATH_RE = /^params\.([a-z0-9]{8})\.(key|value|description|enabled|hasEquals)$/;

function summarizeHeader(row: { key?: string; value?: string }): string {
  return `${row.key ?? ''}: ${row.value ?? ''}`;
}

function summarizeParam(row: { key?: string; value?: string }): string {
  return `${row.key ?? ''}=${row.value ?? ''}`;
}

function readScalar(req: V5.Request, path: string): string | null {
  switch (path) {
    case REQUEST_PATHS.name:
      return String(req.name ?? '');
    case REQUEST_PATHS.description:
      return String(req.description ?? '');
    case REQUEST_PATHS.url:
      return String(req.url ?? '');
    case REQUEST_PATHS.method:
      return String(req.method ?? '');
    case REQUEST_PATHS.auth:
      return stableStringify(req.auth ?? { type: 'inherit' });
    case REQUEST_PATHS.body:
      return stableStringify(req.body ?? { type: 'none' });
    case REQUEST_PATHS.credentialsMode:
      return req.credentialsMode === undefined ? '' : String(req.credentialsMode);
    case REQUEST_PATHS.followRedirects:
      return req.followRedirects === undefined ? '' : String(req.followRedirects);
    case REQUEST_PATHS.preRequestScript:
      return String(req.preRequestScript ?? '');
    case REQUEST_PATHS.postResponseScript:
      return String(req.postResponseScript ?? '');
    default:
      return null;
  }
}

function rowLeafToString(row: Record<string, unknown>, leaf: string): string {
  const v = row[leaf];
  if (v === undefined || v === null) return '';
  return typeof v === 'boolean' ? String(v) : String(v);
}

function readRowPath(req: V5.Request, path: string): string | null {
  const headerMatch = HEADER_PATH_RE.exec(path);
  if (headerMatch) {
    const uid = headerMatch[1];
    const leaf = headerMatch[2] as HeaderLeaf;
    const row = req.headers?.find((h) => h.uid === uid);
    if (!row) return null;
    return rowLeafToString(row as unknown as Record<string, unknown>, leaf);
  }
  const paramMatch = PARAM_PATH_RE.exec(path);
  if (paramMatch) {
    const uid = paramMatch[1];
    const leaf = paramMatch[2] as ParamLeaf;
    const row = req.params?.find((p) => p.uid === uid);
    if (!row) return null;
    return rowLeafToString(row as unknown as Record<string, unknown>, leaf);
  }
  return null;
}

function extractBaseline(req: V5.Request): PathMap {
  const out: PathMap = {};
  for (const path of [
    REQUEST_PATHS.name,
    REQUEST_PATHS.description,
    REQUEST_PATHS.url,
    REQUEST_PATHS.method,
    REQUEST_PATHS.auth,
    REQUEST_PATHS.body,
    REQUEST_PATHS.credentialsMode,
    REQUEST_PATHS.followRedirects,
    REQUEST_PATHS.preRequestScript,
    REQUEST_PATHS.postResponseScript,
  ]) {
    const v = readScalar(req, path);
    if (v !== null) out[path] = v;
  }
  for (const h of req.headers ?? []) {
    out[REQUEST_PATHS.header(h.uid, 'key')] = String(h.key ?? '');
    out[REQUEST_PATHS.header(h.uid, 'value')] = String(h.value ?? '');
    out[REQUEST_PATHS.header(h.uid, 'description')] = String(h.description ?? '');
    out[REQUEST_PATHS.header(h.uid, 'enabled')] = String(h.enabled !== false);
  }
  for (const p of req.params ?? []) {
    out[REQUEST_PATHS.param(p.uid, 'key')] = String(p.key ?? '');
    out[REQUEST_PATHS.param(p.uid, 'value')] = String(p.value ?? '');
    out[REQUEST_PATHS.param(p.uid, 'description')] = String(p.description ?? '');
    out[REQUEST_PATHS.param(p.uid, 'enabled')] = String(p.enabled !== false);
    out[REQUEST_PATHS.param(p.uid, 'hasEquals')] = String(p.hasEquals === true);
  }
  return out;
}

function snapshotSets(req: V5.Request): readonly SetMemberSnapshot[] {
  const headerBy = new Map<string, SetMember>();
  for (const h of req.headers ?? []) {
    headerBy.set(h.uid, { uid: h.uid, summary: summarizeHeader(h), payload: h });
  }
  const paramBy = new Map<string, SetMember>();
  for (const p of req.params ?? []) {
    paramBy.set(p.uid, { uid: p.uid, summary: summarizeParam(p), payload: p });
  }
  return [
    { setPath: REQUEST_PATHS.headerSet, byUid: headerBy },
    { setPath: REQUEST_PATHS.paramSet, byUid: paramBy },
  ];
}

function snapshotSetsFromForm(form: PathMap): readonly SetMemberSnapshot[] {
  const collect = (
    re: RegExp,
    leaves: readonly string[],
  ): Map<string, Record<string, unknown>> => {
    const byUid = new Map<string, Record<string, unknown>>();
    for (const key of Object.keys(form)) {
      const m = re.exec(key);
      if (!m) continue;
      const uid = m[1];
      const leaf = m[2];
      if (!leaves.includes(leaf)) continue;
      const slot = byUid.get(uid) ?? {};
      slot[leaf] = form[key];
      byUid.set(uid, slot);
    }
    return byUid;
  };
  const headerBy = new Map<string, SetMember>();
  for (const [uid, leaves] of collect(HEADER_PATH_RE, HEADER_LEAVES)) {
    headerBy.set(uid, {
      uid,
      summary: summarizeHeader({ key: leaves.key as string, value: leaves.value as string }),
      payload: { uid, ...leaves },
    });
  }
  const paramBy = new Map<string, SetMember>();
  for (const [uid, leaves] of collect(PARAM_PATH_RE, PARAM_LEAVES)) {
    paramBy.set(uid, {
      uid,
      summary: summarizeParam({ key: leaves.key as string, value: leaves.value as string }),
      payload: { uid, ...leaves },
    });
  }
  return [
    { setPath: REQUEST_PATHS.headerSet, byUid: headerBy },
    { setPath: REQUEST_PATHS.paramSet, byUid: paramBy },
  ];
}

export const requestConflictAdapter: ConflictTrackingAdapter<V5.Request> = {
  signature: (r) => r.uid,
  extractBaseline,
  readPath: (req, path) => {
    const scalar = readScalar(req, path);
    if (scalar !== null) return scalar;
    return readRowPath(req, path);
  },
  snapshotSets,
  snapshotSetsFromForm: (form) => snapshotSetsFromForm(form),
};

// ── Resolve ───────────────────────────────────────────────────────

interface ReorderPayload {
  savedOrder: readonly string[];
}

function isReorderPayload(p: unknown): p is ReorderPayload {
  return (
    typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder)
  );
}

function reorderRows<T extends { uid?: string }>(
  rows: readonly T[],
  savedOrder: readonly string[],
): T[] {
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

function setArrayOnRequest(
  req: V5.Request,
  setPath: string,
): { get(): { uid?: string }[]; set(next: { uid?: string }[]): boolean } | null {
  if (setPath === REQUEST_PATHS.headerSet) {
    return {
      get: () => (req.headers as { uid?: string }[]) ?? [],
      set: (next) => {
        (req as unknown as { headers: { uid?: string }[] }).headers = next;
        return true;
      },
    };
  }
  if (setPath === REQUEST_PATHS.paramSet) {
    return {
      get: () => (req.params as { uid?: string }[]) ?? [],
      set: (next) => {
        (req as unknown as { params: { uid?: string }[] }).params = next;
        return true;
      },
    };
  }
  return null;
}

function writeScalar(req: V5.Request, path: string, value: string): boolean {
  const m = req as unknown as Record<string, unknown>;
  switch (path) {
    case REQUEST_PATHS.name:
      m.name = value;
      return true;
    case REQUEST_PATHS.description:
      m.description = value;
      return true;
    case REQUEST_PATHS.url:
      m.url = value;
      return true;
    case REQUEST_PATHS.method:
      m.method = value as V5.HttpMethod;
      return true;
    case REQUEST_PATHS.auth:
      try {
        m.auth = JSON.parse(value) as V5.AuthConfig;
        return true;
      } catch {
        return false;
      }
    case REQUEST_PATHS.body:
      try {
        m.body = JSON.parse(value) as V5.RequestBody;
        return true;
      } catch {
        return false;
      }
    case REQUEST_PATHS.credentialsMode:
      m.credentialsMode = value === '' ? undefined : (value as V5.CredentialsMode);
      return true;
    case REQUEST_PATHS.followRedirects:
      m.followRedirects = value === '' ? undefined : value === 'true';
      return true;
    case REQUEST_PATHS.preRequestScript:
      m.preRequestScript = value;
      return true;
    case REQUEST_PATHS.postResponseScript:
      m.postResponseScript = value;
      return true;
    default:
      return false;
  }
}

function writeRowLeaf(req: V5.Request, path: string, value: string): boolean {
  const headerMatch = HEADER_PATH_RE.exec(path);
  if (headerMatch) {
    const uid = headerMatch[1];
    const leaf = headerMatch[2] as HeaderLeaf;
    const row = req.headers?.find((h) => h.uid === uid) as unknown as Record<string, unknown> | undefined;
    if (!row) return false;
    row[leaf] = leaf === 'enabled' ? value === 'true' : value;
    return true;
  }
  const paramMatch = PARAM_PATH_RE.exec(path);
  if (paramMatch) {
    const uid = paramMatch[1];
    const leaf = paramMatch[2] as ParamLeaf;
    const row = req.params?.find((p) => p.uid === uid) as unknown as Record<string, unknown> | undefined;
    if (!row) return false;
    if (leaf === 'enabled' || leaf === 'hasEquals') row[leaf] = value === 'true';
    else row[leaf] = value;
    return true;
  }
  return false;
}

const SCALAR_LABEL: Record<string, string> = {
  [REQUEST_PATHS.name]: 'Name',
  [REQUEST_PATHS.description]: 'Description',
  [REQUEST_PATHS.url]: 'URL',
  [REQUEST_PATHS.method]: 'Method',
  [REQUEST_PATHS.auth]: 'Authorization',
  [REQUEST_PATHS.body]: 'Body',
  [REQUEST_PATHS.credentialsMode]: 'Credentials mode',
  [REQUEST_PATHS.followRedirects]: 'Follow redirects',
  [REQUEST_PATHS.preRequestScript]: 'Pre-request script',
  [REQUEST_PATHS.postResponseScript]: 'Post-response script',
};

const HEADER_LEAF_LABEL: Record<HeaderLeaf, string> = {
  key: 'name',
  value: 'value',
  description: 'description',
  enabled: 'enabled',
};
const PARAM_LEAF_LABEL: Record<ParamLeaf, string> = {
  key: 'name',
  value: 'value',
  description: 'description',
  enabled: 'enabled',
  hasEquals: 'separator',
};

function findHeaderName(req: V5.Request, uid: string): string | null {
  return req.headers?.find((h) => h.uid === uid)?.key ?? null;
}
function findParamName(req: V5.Request, uid: string): string | null {
  return req.params?.find((p) => p.uid === uid)?.key ?? null;
}

function setPathSummary(setPath: string): string {
  if (setPath === REQUEST_PATHS.headerSet) return 'Header';
  if (setPath === REQUEST_PATHS.paramSet) return 'Query param';
  return setPath;
}

export const requestResolveAdapter: ConflictResolveAdapter<V5.Request> = {
  // RequestEditor uses controlled state — resolution writes go through
  // `applyResolutionToEntity` against a V5.Request clone, then the
  // editor projects back into its Draft shape.
  applyResolutionToForm: () => false,
  applyResolutionToEntity(req, path, conflict) {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      const set = setArrayOnRequest(req, reorderKey.setPath);
      if (!set || !isReorderPayload(conflict.rowPayload)) return false;
      const current = set.get();
      if (current.length === 0) return false;
      set.set(reorderRows(current, conflict.rowPayload.savedOrder));
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      const set = setArrayOnRequest(req, setKey.setPath);
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
    if (writeScalar(req, path, conflict.theirs)) return true;
    if (writeRowLeaf(req, path, conflict.theirs)) return true;
    return false;
  },
  prettyPath(req, path) {
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
      if (setPath === REQUEST_PATHS.headerSet) {
        const name = findHeaderName(req, uid);
        return name ? `${kind} ${name}` : kind;
      }
      if (setPath === REQUEST_PATHS.paramSet) {
        const name = findParamName(req, uid);
        return name ? `${kind} ${name}` : kind;
      }
      return kind;
    }
    if (SCALAR_LABEL[path]) return SCALAR_LABEL[path];
    const headerMatch = HEADER_PATH_RE.exec(path);
    if (headerMatch) {
      const uid = headerMatch[1];
      const leaf = headerMatch[2] as HeaderLeaf;
      const name = findHeaderName(req, uid);
      const label = HEADER_LEAF_LABEL[leaf];
      return name ? `Header ${name} (${label})` : `Header (${label})`;
    }
    const paramMatch = PARAM_PATH_RE.exec(path);
    if (paramMatch) {
      const uid = paramMatch[1];
      const leaf = paramMatch[2] as ParamLeaf;
      const name = findParamName(req, uid);
      const label = PARAM_LEAF_LABEL[leaf];
      return name ? `Query param ${name} (${label})` : `Query param (${label})`;
    }
    return path;
  },
};
