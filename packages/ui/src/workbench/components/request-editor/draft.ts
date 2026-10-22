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
  ExecutionPlaceRole,
  HttpMethod,
  HttpVersion,
  PathParam,
  ProxyMode,
  QueryParam,
  Request,
  RequestBody,
  RequestHeader,
  RequestSpecLink,
  TlsVersion,
} from '@openheaders/core/types';
import { parsePathParamNames, parseUrlQuery } from '@openheaders/core/utils';
import type { WithLocalPlace } from '../../execution-place/local-place';
import { type KeyValueRow, makeKvRow } from './KeyValueTable';

export interface Draft {
  method: HttpMethod;
  url: string;
  description: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  /** The Path Parameters rows — DERIVED from the URL's `:name`
   *  segments (see {@link derivePathParamRows}); only value and
   *  description are the user's to edit here. Always `enabled`. */
  pathParams: KeyValueRow[];
  auth: AuthConfig;
  body: RequestBody;
  specLink?: RequestSpecLink;
  credentialsMode?: CredentialsMode;
  followRedirects?: boolean;
  sslVerification?: boolean;
  tlsMinVersion?: TlsVersion;
  tlsMaxVersion?: TlsVersion;
  tlsCipherSuites?: string;
  sniServerName?: string;
  httpVersion?: HttpVersion;
  resolveToAddress?: string;
  clientCertificateRef?: string;
  executionPlace?: ExecutionPlaceRole;
  proxyMode?: ProxyMode;
  proxyUrl?: string;
  proxyCredentialRef?: string;
  unixSocketPath?: string;
  cookieJar?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  followOriginalHttpMethod?: boolean;
  followAuthorizationHeader?: boolean;
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
  pathParams: PathParam[];
  auth: AuthConfig;
  body: RequestBody;
  specLink: RequestSpecLink | undefined;
  credentialsMode: CredentialsMode | undefined;
  followRedirects: boolean | undefined;
  sslVerification: boolean | undefined;
  tlsMinVersion: TlsVersion | undefined;
  tlsMaxVersion: TlsVersion | undefined;
  tlsCipherSuites: string | undefined;
  sniServerName: string | undefined;
  httpVersion: HttpVersion | undefined;
  resolveToAddress: string | undefined;
  clientCertificateRef: string | undefined;
  executionPlace: ExecutionPlaceRole | undefined;
  proxyMode: ProxyMode | undefined;
  proxyUrl: string | undefined;
  proxyCredentialRef: string | undefined;
  unixSocketPath: string | undefined;
  cookieJar: boolean | undefined;
  timeoutMs: number | undefined;
  maxResponseBytes: number | undefined;
  maxRedirects: number | undefined;
  followOriginalHttpMethod: boolean | undefined;
  followAuthorizationHeader: boolean | undefined;
  preRequestScript: string | undefined;
  postResponseScript: string | undefined;
}

export function headersFromRequest(list: RequestHeader[]): KeyValueRow[] {
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
export function paramsFromRequest(list: QueryParam[]): KeyValueRow[] {
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

/** The Path Parameters rows as the entity stores them — no `enabled`
 *  (a parameter the URL names is always sent), no `hasEquals`. The
 *  draft never holds a row the URL does not name (every URL edit
 *  re-derives the set), so the orphan drop the plan asks for at save
 *  is the derivation itself. */
export function rowsToPathParams(rows: KeyValueRow[]): PathParam[] {
  return rows.map((r) => ({
    uid: r.uid,
    key: r.key,
    value: r.value,
    description: r.description?.trim() ? r.description : undefined,
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

/** Uid for a URL-derived param row. Index-keyed and DETERMINISTIC:
 *  `draftFromRequest` runs inside `canonicalRequestProjection`, whose
 *  output feeds fingerprint/signature comparisons — a random uid per
 *  call makes every projection of the same request compare unequal,
 *  and the reprime gate then re-populates the draft on every render
 *  (an infinite setState loop that wedges the editor). Same shape as
 *  `generateUid()` output so `UidSchema` and the conflict-path
 *  regexes accept it unchanged. */
function urlParamUid(index: number): string {
  return `q${index.toString(36).padStart(7, '0')}`;
}

/** Uid for a path-parameter row the URL names and no stored row
 *  answers. Keyed by the NAME, not the index, and DETERMINISTIC for the
 *  same reason as {@link urlParamUid}: this runs inside
 *  `canonicalRequestProjection`. Name-keyed so a new segment typed in
 *  front of the others never re-mints the rows behind it, and so a
 *  stored row minted here and the same name derived again agree —
 *  `/:a/:b` saved then re-derived yields the same two uids. FNV-1a
 *  over the name, `p` + seven base-36 digits: the 8-char shape
 *  `UidSchema` and the conflict-path regexes accept. */
function derivedPathParamUid(name: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p${hash.toString(36).padStart(7, '0').slice(-7)}`;
}

/** The Path Parameters rows the URL names, in path order, one per
 *  distinct `:name` — the ONE derivation the editor has. A stored row
 *  whose key the URL names keeps its uid, value and description; a
 *  name no stored row answers gets an empty row under a name-keyed
 *  deterministic uid; a stored row the URL no longer names is dropped
 *  (the two-editor rename case — the next save tombstones it). Shared
 *  by {@link draftFromRequest} (inside the canonical projection) and
 *  the URL bar's edit path, so projection and live draft agree row
 *  for row, and typing `:x` adds exactly the row a re-open would show. */
export function derivePathParamRows(
  url: string,
  existing: ReadonlyArray<Pick<KeyValueRow, 'uid' | 'key' | 'value' | 'description'>>,
): KeyValueRow[] {
  const byKey = new Map<string, Pick<KeyValueRow, 'uid' | 'key' | 'value' | 'description'>>();
  for (const row of existing) if (!byKey.has(row.key)) byKey.set(row.key, row);
  return parsePathParamNames(url).map(({ name }) => {
    const match = byKey.get(name);
    return makeKvRow({
      uid: match?.uid ?? derivedPathParamUid(name),
      key: name,
      value: match?.value ?? '',
      description: match?.description ?? '',
      enabled: true,
    });
  });
}

export function draftFromRequest(req: WithLocalPlace<Request>): Draft {
  // Split any legacy `?…` suffix off of `req.url` into structured
  // params so the editor's bidirectional URL↔Params sync has a clean
  // base URL to work with. Existing `req.params` entries keep their
  // metadata and are appended AFTER the URL-derived ones, preserving
  // the visual order a user would expect (URL first, table after).
  const parsed = parseUrlQuery(req.url);
  const urlParams: KeyValueRow[] = parsed.params.map((p, i) =>
    makeKvRow({
      uid: urlParamUid(i),
      key: p.key,
      value: p.value,
      description: '',
      enabled: true,
      hasEquals: p.hasEquals,
    }),
  );
  return {
    method: req.method,
    url: parsed.base,
    description: req.description ?? '',
    headers: headersFromRequest(req.headers),
    params: [...urlParams, ...paramsFromRequest(req.params)],
    pathParams: derivePathParamRows(parsed.base, req.pathParams ?? []),
    auth: req.auth,
    body: req.body,
    specLink: req.specLink,
    credentialsMode: req.credentialsMode,
    followRedirects: req.followRedirects,
    sslVerification: req.sslVerification,
    tlsMinVersion: req.tlsMinVersion,
    tlsMaxVersion: req.tlsMaxVersion,
    tlsCipherSuites: req.tlsCipherSuites,
    sniServerName: req.sniServerName,
    httpVersion: req.httpVersion,
    resolveToAddress: req.resolveToAddress,
    clientCertificateRef: req.clientCertificateRef,
    executionPlace: req.executionPlace,
    proxyMode: req.proxyMode,
    proxyUrl: req.proxyUrl,
    proxyCredentialRef: req.proxyCredentialRef,
    unixSocketPath: req.unixSocketPath,
    cookieJar: req.cookieJar,
    timeoutMs: req.timeoutMs,
    maxResponseBytes: req.maxResponseBytes,
    maxRedirects: req.maxRedirects,
    followOriginalHttpMethod: req.followOriginalHttpMethod,
    followAuthorizationHeader: req.followAuthorizationHeader,
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
    pathParams: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
}

export function buildRequestUpdates(draft: Draft): WithLocalPlace<RequestUpdates> {
  return {
    description: draft.description.trim() ? draft.description : undefined,
    method: draft.method,
    url: draft.url,
    headers: rowsToHeaders(draft.headers),
    params: rowsToParams(draft.params),
    pathParams: rowsToPathParams(draft.pathParams),
    auth: draft.auth,
    body: draft.body,
    specLink: draft.specLink,
    credentialsMode: draft.credentialsMode,
    followRedirects: draft.followRedirects,
    sslVerification: draft.sslVerification,
    tlsMinVersion: draft.tlsMinVersion,
    tlsMaxVersion: draft.tlsMaxVersion,
    tlsCipherSuites: draft.tlsCipherSuites,
    sniServerName: draft.sniServerName,
    httpVersion: draft.httpVersion,
    resolveToAddress: draft.resolveToAddress,
    clientCertificateRef: draft.clientCertificateRef,
    executionPlace: draft.executionPlace,
    proxyMode: draft.proxyMode,
    proxyUrl: draft.proxyUrl,
    proxyCredentialRef: draft.proxyCredentialRef,
    unixSocketPath: draft.unixSocketPath,
    cookieJar: draft.cookieJar,
    timeoutMs: draft.timeoutMs,
    maxResponseBytes: draft.maxResponseBytes,
    maxRedirects: draft.maxRedirects,
    followOriginalHttpMethod: draft.followOriginalHttpMethod,
    followAuthorizationHeader: draft.followAuthorizationHeader,
    preRequestScript: draft.preRequestScript,
    postResponseScript: draft.postResponseScript,
  };
}

/** Project a live `Request` into the same shape `buildRequestUpdates`
 *  emits — fingerprint comparison stays apples-to-apples. */
export function canonicalRequestProjection(req: WithLocalPlace<Request>): WithLocalPlace<RequestUpdates> {
  return buildRequestUpdates(draftFromRequest(req));
}
