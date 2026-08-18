/**
 * Spec → linked-collection update planner (the API-specs plan Phase F).
 *
 * Pure comparison of a freshly parsed spec document against the live
 * collection it generated — the user-mediated diff the Update surface
 * presents, never a silent overwrite. Requests pair by the OpenAPI
 * operation identity (method + URL template): a user-renamed request
 * stays matched and its rename survives unless the row is applied with
 * a name change; a spec path rename presents honestly as remove + add.
 *
 * Opinion boundary: the plan only ever names fields the spec-derived
 * seed defines. Optional fields the parser never emits (execution
 * settings, scripts) or leaves absent on an operation (description)
 * carry NO opinion — user-authored docs and knobs survive an apply.
 * Same posture for collection variables (spec rows upsert by name;
 * user-added rows survive) and collection auth (absent = transparent).
 *
 * Apply granularity is per leaf by construction: changed requests
 * flow through `updateRequest` partials, whose builder routes
 * object-valued scalars through `synthesizeFieldDiff`. Row identity on
 * replaced header/param lists is preserved by key-first-match uid
 * reuse so unchanged rows keep their sync identity.
 */

import type { CurlRequest, OpenApiParseResult } from '@openheaders/core/import';
import type {
  AuthConfig,
  Collection,
  HttpMethod,
  QueryParam,
  Request,
  RequestHeader,
  Variable,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { stableStringify } from '@openheaders/ui/shared/forms';

/** Field ids a changed request can carry — i18n-labeled at render. */
export type SpecChangedField = 'name' | 'description' | 'headers' | 'params' | 'auth' | 'body';

export interface SpecPlanAdd {
  key: string;
  folderPath: string[];
  request: CurlRequest;
}

export interface SpecPlanChange {
  key: string;
  requestUid: string;
  /** Live request name — what the user sees in the row. */
  name: string;
  method: HttpMethod;
  url: string;
  changedFields: SpecChangedField[];
  /** `updateRequest` partial converging the changed fields. */
  updates: Partial<Pick<Request, 'name' | 'description' | 'headers' | 'params' | 'auth' | 'body'>>;
}

export interface SpecPlanRemove {
  key: string;
  requestUid: string;
  name: string;
  method: HttpMethod;
  url: string;
}

export interface SpecUpdatePlan {
  adds: SpecPlanAdd[];
  changes: SpecPlanChange[];
  removes: SpecPlanRemove[];
  /** Replacement variable rows (live uids preserved by name, spec rows
   *  upserted, user-added rows kept) — `null` when nothing changed. */
  variables: Variable[] | null;
  /** New collection auth — `null` when the spec carries none or it
   *  already matches (absent spec auth is transparent, never a reset). */
  auth: AuthConfig | null;
}

export function specUpdatePlanSize(plan: SpecUpdatePlan): number {
  return (
    plan.adds.length +
    plan.changes.length +
    plan.removes.length +
    (plan.variables !== null ? 1 : 0) +
    (plan.auth !== null ? 1 : 0)
  );
}

const operationKey = (method: string, url: string) => `${method} ${url.trim()}`;

// Row projections for spec-vs-live equality — uid is sync identity,
// never document content; absent optionals normalize like the wire.
const headerRow = (h: RequestHeader) => ({
  key: h.key,
  value: h.value,
  description: h.description ?? '',
  enabled: h.enabled !== false,
});
const paramRow = (p: QueryParam) => ({
  key: p.key,
  value: p.value,
  description: p.description ?? '',
  enabled: p.enabled !== false,
  hasEquals: p.hasEquals === true,
});

const structurallyEqual = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** Re-key incoming rows onto live row uids by key-first-match so
 *  unchanged/value-edited rows keep their set-model identity. */
function reuseRowUids<T extends { uid: string; key: string }>(specRows: readonly T[], liveRows: readonly T[]): T[] {
  const pool = new Map<string, T[]>();
  for (const row of liveRows) {
    const bucket = pool.get(row.key);
    if (bucket) bucket.push(row);
    else pool.set(row.key, [row]);
  }
  return specRows.map((row) => {
    const bucket = pool.get(row.key);
    const live = bucket?.shift();
    return { ...row, uid: live?.uid ?? generateUid() };
  });
}

function diffRequest(spec: CurlRequest, live: Request): Pick<SpecPlanChange, 'changedFields' | 'updates'> {
  const changedFields: SpecChangedField[] = [];
  const updates: SpecPlanChange['updates'] = {};

  if (spec.name !== live.name) {
    changedFields.push('name');
    updates.name = spec.name;
  }
  if (spec.description !== undefined && spec.description !== (live.description ?? '')) {
    changedFields.push('description');
    updates.description = spec.description;
  }
  if (!structurallyEqual(spec.headers.map(headerRow), live.headers.map(headerRow))) {
    changedFields.push('headers');
    updates.headers = reuseRowUids(spec.headers, live.headers);
  }
  if (!structurallyEqual(spec.params.map(paramRow), live.params.map(paramRow))) {
    changedFields.push('params');
    updates.params = reuseRowUids(spec.params, live.params);
  }
  if (!structurallyEqual(spec.auth, live.auth)) {
    changedFields.push('auth');
    updates.auth = spec.auth;
  }
  if (!structurallyEqual(spec.body, live.body)) {
    changedFields.push('body');
    updates.body = spec.body;
  }
  return { changedFields, updates };
}

/** Upsert spec variables by name into the live rows: matched rows keep
 *  their uid (value/type converge), new spec rows append minted, extra
 *  live rows survive. Returns `null` when the result is a no-op. */
function planVariables(
  specVariables: OpenApiParseResult['collectionVariables'],
  liveVariables: readonly Variable[],
): Variable[] | null {
  if (specVariables.length === 0) return null;
  const liveByName = new Map(liveVariables.map((v) => [v.name, v]));
  let changed = false;
  const upserted = new Map<string, Variable>();
  for (const specVar of specVariables) {
    const live = liveByName.get(specVar.name);
    if (live) {
      if (live.value !== specVar.value) changed = true;
      upserted.set(specVar.name, { ...live, value: specVar.value });
    } else {
      changed = true;
      upserted.set(specVar.name, {
        uid: generateUid(),
        name: specVar.name,
        value: specVar.value,
        type: specVar.type,
      });
    }
  }
  if (!changed) return null;
  const rows: Variable[] = liveVariables.map((v) => upserted.get(v.name) ?? v);
  for (const [name, row] of upserted) {
    if (!liveByName.has(name)) rows.push(row);
  }
  return rows;
}

export interface SpecUpdatePlanLiveState {
  collection: Collection;
  /** The collection's live requests (full rows). */
  requests: readonly Request[];
}

export function buildSpecUpdatePlan(parsed: OpenApiParseResult, live: SpecUpdatePlanLiveState): SpecUpdatePlan {
  const unmatched = new Map<string, Request[]>();
  for (const request of live.requests) {
    const key = operationKey(request.method, request.url);
    const bucket = unmatched.get(key);
    if (bucket) bucket.push(request);
    else unmatched.set(key, [request]);
  }
  const specKeys = new Set<string>();

  const adds: SpecPlanAdd[] = [];
  const changes: SpecPlanChange[] = [];
  for (const parsedRequest of parsed.requests) {
    const spec = parsedRequest.request;
    const key = operationKey(spec.method, spec.url);
    specKeys.add(key);
    const liveMatch = unmatched.get(key)?.shift();
    if (!liveMatch) {
      adds.push({ key, folderPath: parsedRequest.folderPath, request: spec });
      continue;
    }
    const diff = diffRequest(spec, liveMatch);
    if (diff.changedFields.length > 0) {
      changes.push({
        key,
        requestUid: liveMatch.uid,
        name: liveMatch.name,
        method: liveMatch.method,
        url: liveMatch.url,
        ...diff,
      });
    }
  }

  // Removes = live operations the spec no longer names. Duplicates of a
  // key the spec still carries are user copies, not orphans — kept.
  const removes: SpecPlanRemove[] = [];
  for (const [key, bucket] of unmatched) {
    if (specKeys.has(key)) continue;
    for (const request of bucket) {
      removes.push({ key, requestUid: request.uid, name: request.name, method: request.method, url: request.url });
    }
  }

  const specAuth = parsed.collectionAuth;
  const auth = specAuth !== undefined && !structurallyEqual(specAuth, live.collection.auth) ? specAuth : null;

  return {
    adds,
    changes,
    removes,
    variables: planVariables(parsed.collectionVariables, live.collection.variables),
    auth,
  };
}
