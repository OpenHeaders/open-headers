/**
 * Request editor draft model.
 *
 * The `Draft` is the editor's local, edit-friendly projection of a
 * `Request`: key/value rows carry transient UI fields (uid, enabled,
 * description) the wire shape doesn't. These pure functions convert
 * between the two and project a draft into the `updateRequest` payload.
 *
 * `buildRequestUpdates` is the single source of truth for that payload:
 * it feeds save, derived-dirty fingerprinting, and the conflict
 * baseline/form projection so all three agree.
 */

import type {
  AuthConfig,
  CredentialsMode,
  HttpMethod,
  QueryParam,
  Request,
  RequestBody,
  RequestHeader,
} from '@openheaders/core/types';
import { parseUrlQuery } from '@openheaders/core/utils';
import { type KeyValueRow, makeKvRow } from './KeyValueTable';

export interface Draft {
  method: HttpMethod;
  url: string;
  description: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  auth: AuthConfig;
  body: RequestBody;
  credentialsMode?: CredentialsMode;
  followRedirects?: boolean;
  sslVerification?: boolean;
  preRequestScript?: string;
  postResponseScript?: string;
}

/** Pure projection: Draft → updateRequest payload. Used at save time
 *  AND for derived dirty / conflict baseline + form projection. One
 *  source of truth so dirty / save / conflict tracker all agree. */
export interface RequestUpdates {
  description: string | undefined;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;
  body: RequestBody;
  credentialsMode: CredentialsMode | undefined;
  followRedirects: boolean | undefined;
  sslVerification: boolean | undefined;
  preRequestScript: string | undefined;
  postResponseScript: string | undefined;
}

function headersFromRequest(list: RequestHeader[]): KeyValueRow[] {
  return list.map((h) =>
    makeKvRow({
      uid: h.uid,
      key: h.key,
      value: h.value,
      description: h.description,
      enabled: h.enabled !== false,
    }),
  );
}
function paramsFromRequest(list: QueryParam[]): KeyValueRow[] {
  return list.map((p) =>
    makeKvRow({
      uid: p.uid,
      key: p.key,
      value: p.value,
      description: p.description,
      enabled: p.enabled !== false,
      hasEquals: p.hasEquals,
    }),
  );
}
export function rowsToHeaders(rows: KeyValueRow[]): RequestHeader[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
    }));
}
export function rowsToParams(rows: KeyValueRow[]): QueryParam[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
      hasEquals: r.hasEquals,
    }));
}

/** Shed KeyValueTable's transient fields (uid, description) so the
 *  pure `buildUrlDisplay` utility sees only the fields it cares
 *  about — key, value, enabled, hasEquals. */
export function draftParamsToQueryParams(
  rows: KeyValueRow[],
): Array<{ key: string; value: string; enabled?: boolean; hasEquals?: boolean }> {
  return rows.map((r) => ({ key: r.key, value: r.value, enabled: r.enabled, hasEquals: r.hasEquals }));
}

/** Merge parsed-from-URL params with the existing draft rows so
 *  metadata (description + enabled + uid) rides along for any row
 *  whose key still matches. Duplicate keys are handled via a
 *  consume-from-pool pattern: each parsed row claims the first
 *  existing row with a matching key and removes it from the pool,
 *  so `?a=1&a=2` against `[{a,1,descX},{a,2,descY}]` preserves both
 *  descriptions on the correct rows. Unmatched parsed rows come in
 *  fresh (enabled, no description); unmatched existing rows drop. */
export function mergeParamsFromUrl(
  parsed: ReadonlyArray<{ key: string; value: string; hasEquals?: boolean }>,
  existing: KeyValueRow[],
): KeyValueRow[] {
  const pool = existing.slice();
  return parsed.map((p) => {
    const idx = pool.findIndex((r) => r.key === p.key);
    const match = idx >= 0 ? pool[idx] : undefined;
    if (idx >= 0) pool.splice(idx, 1);
    return makeKvRow({
      key: p.key,
      value: p.value,
      description: match?.description ?? '',
      enabled: match?.enabled ?? true,
      hasEquals: p.hasEquals,
    });
  });
}

export function draftFromRequest(req: Request): Draft {
  // Split any legacy `?…` suffix off of `req.url` into structured
  // params so the editor's bidirectional URL↔Params sync has a clean
  // base URL to work with. Existing `req.params` entries keep their
  // metadata and are appended AFTER the URL-derived ones, preserving
  // the visual order a user would expect (URL first, table after).
  const parsed = parseUrlQuery(req.url);
  const urlParams: KeyValueRow[] = parsed.params.map((p) =>
    makeKvRow({ key: p.key, value: p.value, description: '', enabled: true, hasEquals: p.hasEquals }),
  );
  return {
    method: req.method,
    url: parsed.base,
    description: req.description ?? '',
    headers: headersFromRequest(req.headers),
    params: [...urlParams, ...paramsFromRequest(req.params)],
    auth: req.auth,
    body: req.body,
    credentialsMode: req.credentialsMode,
    followRedirects: req.followRedirects,
    sslVerification: req.sslVerification,
    preRequestScript: req.preRequestScript,
    postResponseScript: req.postResponseScript,
  };
}

export function emptyDraft(): Draft {
  return {
    method: 'GET',
    url: '',
    description: '',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
}

export function buildRequestUpdates(draft: Draft): RequestUpdates {
  return {
    description: draft.description.trim() ? draft.description : undefined,
    method: draft.method,
    url: draft.url,
    headers: rowsToHeaders(draft.headers),
    params: rowsToParams(draft.params),
    auth: draft.auth,
    body: draft.body,
    credentialsMode: draft.credentialsMode,
    followRedirects: draft.followRedirects,
    sslVerification: draft.sslVerification,
    preRequestScript: draft.preRequestScript,
    postResponseScript: draft.postResponseScript,
  };
}

/** Project a live `Request` into the same shape `buildRequestUpdates`
 *  emits — fingerprint comparison stays apples-to-apples. */
export function canonicalRequestProjection(req: Request): RequestUpdates {
  return buildRequestUpdates(draftFromRequest(req));
}
