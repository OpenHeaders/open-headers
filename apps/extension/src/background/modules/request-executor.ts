/**
 * Request Executor — runs a V5.Request through `fetch()` from the
 * service worker and returns a response snapshot the UI can render.
 *
 * Design:
 *   - Variables resolve against the same 4-scope chain the DNR pipeline
 *     uses (vault > environment > collection > workspace) so requests
 *     see the same values the rules would. Collection scope is derived
 *     from the request's path.
 *   - Fetch runs inside the SW, which holds `<all_urls>` host
 *     permission — no CORS gating. User-defined DNR rules DO apply to
 *     SW fetches (they hit webRequest like any other request), which
 *     is intentional: users can test their own rules end-to-end.
 *   - Body types: `none`, `json`, `xml`, `text`, `form` (urlencoded).
 *     `graphql` and `multipart` land in a later phase — the shape
 *     variant is declared in `V5.BodyType` but the executor falls back
 *     to `none` if asked to send one.
 *   - Auth: `none` | `inherit` are no-ops (nothing to inject). `basic`
 *     and `bearer` add Authorization; `api-key` adds either a header or
 *     a query param depending on its `in` field. `inherit` at the
 *     request level defaults to `none` — inheritance from containing
 *     collections is scheduled for v2 alongside request scripts.
 *
 * Response size cap: 2 MiB for the body preview. Larger responses are
 * truncated with a flag so the UI can render a message instead of
 * trying to display megabytes in a <pre>.
 */

import type { V5 } from '@openheaders/core/types';
import { resolveTemplate, VariableResolver } from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from './environment-store';
import { getRequest, getRequestCollections } from './request-store';
import { getCollections as getRuleCollections } from './rule-store';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// ── Executor API ───────────────────────────────────────────────────

export interface ExecutedRequestSnapshot {
  /** HTTP status (e.g. 200). `0` when the request never completed
   *  (DNS failure, network offline, aborted). */
  status: number;
  statusText: string;
  /** Final URL after redirects — might differ from the submitted one. */
  url: string;
  headers: Array<{ key: string; value: string }>;
  /** Response body as text. Binary payloads get a base64 fallback via
   *  `bodyEncoding = 'base64'` once we add that — for v1 everything is
   *  read as text. */
  body: string;
  /** True when the body exceeded `MAX_BODY_BYTES` and was truncated. */
  bodyTruncated: boolean;
  /** Bytes read from the wire before any truncation. */
  bodyBytes: number;
  durationMs: number;
  /** Non-null when the request failed before producing a response. */
  error: string | null;
}

export interface ExecuteRequestOptions {
  /** Pin a specific environment for this execution — leave undefined
   *  to use the workspace's active environment. */
  environmentId?: string;
}

/** Resolve + execute a persisted request by uid. */
export async function executeRequest(
  requestUid: string,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  const request = getRequest(requestUid);
  if (!request) {
    return errorSnapshot(`Request ${requestUid} not found`);
  }
  return executeRequestDraft(request, options);
}

/** Execute an in-memory request shape (for unsaved drafts + tests). */
export async function executeRequestDraft(
  request: V5.Request,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  const resolved = resolveRequest(request, options);
  return executeResolved(resolved);
}

// ── Variable resolution ────────────────────────────────────────────

function buildResolver(): VariableResolver {
  const resolver = new VariableResolver();
  resolver.setVault(getVault());
  resolver.setEnvironments(getEnvironments());
  resolver.setActiveEnvironmentId(getActiveEnvironmentId());
  resolver.setDefaultEnvironmentId(getDefaultEnvironmentId());
  resolver.setWorkspaceVariables(getWorkspaceVariables());
  // Feed variables from BOTH collection trees. Their uids are generated
  // from the same pool and never collide, so keying a single Map by uid
  // is safe — the resolver just needs to know a variable set per uid,
  // not which tree it came from.
  for (const c of getRuleCollections()) {
    resolver.setCollectionVariables(c.uid, c.variables ?? []);
  }
  for (const c of getRequestCollections()) {
    resolver.setCollectionVariables(c.uid, c.variables ?? []);
  }
  return resolver;
}

/**
 * Find the collection a request belongs to. Requests live under
 * `requests/<coll-name-uid>/...`, so we look in the REQUEST collection
 * tree — not the rule tree (paths under `rules/` never prefix a
 * request path). Returns `undefined` for orphaned requests (defensive —
 * every persisted request should have an owning collection).
 */
function collectionIdForRequest(request: V5.Request): string | undefined {
  const hit = getRequestCollections().find((c) => request.path.startsWith(`${c.path}/`));
  return hit?.uid;
}

interface ResolvedRequest {
  method: V5.HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: { type: V5.BodyType; content: string };
  /** Wire-level cookie policy. `'omit'` unless the request opts into `'include'`. */
  credentialsMode: V5.CredentialsMode;
  // auth and params are folded into `url` + `headers` below.
}

function resolveRequest(request: V5.Request, options: ExecuteRequestOptions): ResolvedRequest {
  const resolver = buildResolver();
  const context = {
    collectionId: collectionIdForRequest(request),
    environmentId: options.environmentId,
  };

  const resolveStr = (s: string): string => resolveTemplate(s, (name) => resolver.resolve(name, context)).result;

  // ── URL with query params ───────────────────────────────────────
  let resolvedUrl = resolveStr(request.url);
  const enabledParams = request.params
    .filter((p) => (p.enabled ?? true) && p.key.trim())
    .map((p) => ({ key: resolveStr(p.key), value: resolveStr(p.value) }));

  // ── Headers ─────────────────────────────────────────────────────
  const headers: Array<{ key: string; value: string }> = request.headers
    .filter((h) => (h.enabled ?? true) && h.key.trim())
    .map((h) => ({ key: resolveStr(h.key), value: resolveStr(h.value) }));

  // ── Auth folds into headers/params ──────────────────────────────
  applyAuth(request.auth, headers, enabledParams, resolveStr);

  // Append params to URL after auth — api-key-in-query lives in
  // enabledParams and MUST be appended too.
  resolvedUrl = appendQueryParams(resolvedUrl, enabledParams);

  // ── Body ────────────────────────────────────────────────────────
  const bodyType: V5.BodyType = request.body?.type ?? 'none';
  const rawBody = request.body?.content ?? '';
  const resolvedBodyContent = bodyType === 'none' ? '' : resolveStr(rawBody);

  // Ensure Content-Type header matches the body type if the user
  // didn't set one. Skipped for `none` (no body) and `form` (set by
  // the URLSearchParams path below) to avoid overriding intentional
  // user overrides.
  if (bodyType !== 'none' && !headers.some((h) => h.key.toLowerCase() === 'content-type')) {
    const ct = defaultContentType(bodyType);
    if (ct) headers.push({ key: 'Content-Type', value: ct });
  }

  return {
    method: request.method,
    url: resolvedUrl,
    headers,
    body: { type: bodyType, content: resolvedBodyContent },
    // Cookie-jar policy. `'omit'` is the safe default when the request
    // doesn't explicitly opt in — even with `<all_urls>` granted, we
    // never ride the browser's cookie jar by accident. See ARCHITECTURE.md §14.
    credentialsMode: request.credentialsMode === 'include' ? 'include' : 'omit',
  };
}

function applyAuth(
  auth: V5.AuthConfig,
  headers: Array<{ key: string; value: string }>,
  params: Array<{ key: string; value: string }>,
  resolveStr: (s: string) => string,
): void {
  if (auth.type === 'none' || auth.type === 'inherit') return;
  if (auth.type === 'basic') {
    const u = resolveStr(auth.username);
    const p = resolveStr(auth.password);
    // RFC 7617 mandates UTF-8. `btoa` throws on non-ASCII, so we
    // encode the credential pair as UTF-8 bytes first, then base64 the
    // byte string. Without this, a password like `pässwörd` crashes
    // the executor with `InvalidCharacterError` before fetch is even
    // called.
    const bytes = new TextEncoder().encode(`${u}:${p}`);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const token = btoa(binary);
    headers.push({ key: 'Authorization', value: `Basic ${token}` });
    return;
  }
  if (auth.type === 'bearer') {
    headers.push({ key: 'Authorization', value: `Bearer ${resolveStr(auth.token)}` });
    return;
  }
  if (auth.type === 'api-key') {
    const k = resolveStr(auth.key);
    const v = resolveStr(auth.value);
    if (auth.in === 'header') headers.push({ key: k, value: v });
    else params.push({ key: k, value: v });
  }
}

function appendQueryParams(url: string, params: Array<{ key: string; value: string }>): string {
  if (params.length === 0) return url;
  // URL() would normalize in surprising ways (lowercasing the host,
  // collapsing percent-encoding). Do the query-string dance ourselves
  // so we only touch what we intend to touch.
  const qs = params.map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${qs}`;
}

function defaultContentType(type: V5.BodyType): string | null {
  switch (type) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'text':
      return 'text/plain';
    case 'graphql':
      return 'application/json';
    default:
      return null;
  }
}

// ── Execution ──────────────────────────────────────────────────────

async function executeResolved(req: ResolvedRequest): Promise<ExecutedRequestSnapshot> {
  if (!req.url.trim()) {
    return errorSnapshot('URL is empty');
  }

  const init: RequestInit = {
    method: req.method,
    // `manual` would let us inspect the 3xx chain but also break the
    // response body read on redirects — `follow` matches what curl /
    // Postman do by default.
    redirect: 'follow',
    cache: 'no-store',
    // Wire-level cookie policy: default `'omit'` so nothing leaks from
    // the browser's cookie jar to arbitrary hosts. Users opt in per
    // request via `credentialsMode: 'include'` (UI toggle warns about
    // the leak potential).
    credentials: req.credentialsMode,
  };

  const fetchHeaders = new Headers();
  for (const { key, value } of req.headers) fetchHeaders.append(key, value);
  init.headers = fetchHeaders;

  // Body handling — attach the body for any method the user chose.
  // GET-with-body is spec-questionable but some servers (Elasticsearch,
  // search APIs) accept it. If the browser's fetch() rejects the
  // combination we let the TypeError flow through to the catch below —
  // the user sees the actual error in the response panel rather than
  // wondering why their body was silently dropped.
  if (req.body.type === 'form') {
    // Parse the urlencoded text into URLSearchParams so the browser
    // sets Content-Type + length for us.
    init.body = new URLSearchParams(req.body.content);
  } else if (req.body.type !== 'none') {
    init.body = req.body.content;
  }

  const startedAt = performance.now();
  try {
    // Every user-facing fetch routes through withHostAccess — today a
    // pass-through, tomorrow the gate for a minimal-permissions SKU.
    const response = await withHostAccess(req.url, () => fetch(req.url, init));
    const durationMs = Math.round(performance.now() - startedAt);

    const headers: Array<{ key: string; value: string }> = [];
    response.headers.forEach((value, key) => {
      headers.push({ key, value });
    });

    // Read body with size cap. For large responses we slice + flag so
    // the UI doesn't try to render megabytes of text.
    const bodyText = await response.text();
    const bodyBytes = new TextEncoder().encode(bodyText).byteLength;
    const truncated = bodyBytes > MAX_BODY_BYTES;
    const body = truncated ? bodyText.slice(0, MAX_BODY_BYTES) : bodyText;

    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || req.url,
      headers,
      body,
      bodyTruncated: truncated,
      bodyBytes,
      durationMs,
      error: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = err instanceof Error ? err.message : String(err);
    logger.info('RequestExecutor', `fetch failed for ${req.url}: ${message}`);
    return {
      status: 0,
      statusText: '',
      url: req.url,
      headers: [],
      body: '',
      bodyTruncated: false,
      bodyBytes: 0,
      durationMs,
      error: message,
    };
  }
}

function errorSnapshot(message: string): ExecutedRequestSnapshot {
  return {
    status: 0,
    statusText: '',
    url: '',
    headers: [],
    body: '',
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 0,
    error: message,
  };
}
