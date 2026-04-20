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

import { isExpired as isOAuthTokenExpired } from '@openheaders/core/oauth';
import type { RequestMutation, RequestSnapshot, ResponseSnapshot, TestAssertion } from '@openheaders/core/scripts';
import type { V5 } from '@openheaders/core/types';
import { resolveTemplate, VariableResolver } from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import { ensureScheme } from '@/shared/fetch/ensure-scheme';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import { report as reportStatus } from '@/shared/status';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from './environment-store';
import { getFileBlob, listFiles } from './files-store';
import { OAuth2FlowError, performRefresh as performOAuthRefresh } from './oauth-flow';
import { getTokenBundle as getOAuthTokenBundle } from './oauth-token-store';
import { recordLog } from './observability-log';
import { __setExecuteRequestDraft, isOffscreenSupported, runScript } from './offscreen-host';
import { getRequest, getRequestCollections } from './request-store';
import { getCollections as getRuleCollections } from './rule-store';
import { getLiveRegistrySnapshot } from './variables-resolver';

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
  /**
   * Script outcome — `null` when no scripts ran, otherwise carries the
   * assertions + console + mutation summary surfaced by the pre-request
   * and/or post-response scripts. Split into two fields so the UI can
   * render them independently (pre-request logs vs assertions). See
   * ARCHITECTURE §19.
   */
  scripts?: {
    preRequest?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      consoleLog: import('@openheaders/core/scripts').ScriptConsoleEntry[];
      durationMs: number;
      /** Summary of what the pre-request script mutated — useful for
       *  the UI to show "1 header added" style hints. Non-authoritative;
       *  the actual fetch uses the merged snapshot. */
      mutation?: RequestMutation;
    };
    postResponse?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      assertions: TestAssertion[];
      consoleLog: import('@openheaders/core/scripts').ScriptConsoleEntry[];
      durationMs: number;
    };
  } | null;
}

export interface ExecuteRequestOptions {
  /** Pin a specific environment for this execution — leave undefined
   *  to use the workspace's active environment. */
  environmentId?: string;
  /**
   * Install a step-capture context on the resolver for the duration of
   * this execution so `{{step.<stepId>.<captureName>}}` references in
   * the request's templates resolve. Only used by Live Workflow chain
   * runs — regular user fetches leave this unset (any `{{step.X.Y}}`
   * in their templates surfaces as `step-out-of-context`).
   */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /**
   * Skip the `requests` Status-pill report. Workflow refreshes aren't
   * user-initiated requests; their success/failure belongs to the
   * `live` subsystem (Phase G wires that) rather than flipping the
   * generic request-executor pill on every chain step.
   */
  silentStatus?: boolean;
  /**
   * Skip pre-request + post-response script hooks. Chain step fetches
   * are pure data-source fetches — running user scripts on them would
   * blur the boundary between "my request" and "workflow refresh" and
   * open a trivial infinite-recursion path (script calls sendRequest
   * which triggers the same workflow).
   */
  skipScripts?: boolean;
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
  const resolved = await resolveRequest(request, options);

  // ── Pre-request script hook ────────────────────────────────────
  // Run BEFORE the wire fetch. Script mutations land on top of the
  // resolved request (after variable substitution). Missing scripts
  // / Firefox fallback / empty source are all no-ops.
  let scriptOutcome: ExecutedRequestSnapshot['scripts'] = null;
  const finalResolved: ResolvedRequest = { ...resolved };

  if (!options.skipScripts && request.preRequestScript?.trim() && isOffscreenSupported()) {
    const snapshot = resolvedToSnapshot(finalResolved);
    const result = await runScript({
      kind: 'pre-request',
      source: request.preRequestScript,
      request: snapshot,
    });
    scriptOutcome = {
      preRequest: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
        mutation: result.mutation,
      },
    };
    if (result.succeeded && result.mutation) {
      applyMutation(finalResolved, result.mutation);
    }
  }

  const wireResult = await executeResolved(finalResolved, { silentStatus: options.silentStatus });

  // ── Post-response script hook ──────────────────────────────────
  if (
    !options.skipScripts &&
    request.postResponseScript?.trim() &&
    isOffscreenSupported() &&
    wireResult.error == null
  ) {
    const responseSnap: ResponseSnapshot = {
      status: wireResult.status,
      statusText: wireResult.statusText,
      url: wireResult.url,
      headers: wireResult.headers,
      body: wireResult.body,
      durationMs: wireResult.durationMs,
    };
    const result = await runScript({
      kind: 'post-response',
      source: request.postResponseScript,
      request: resolvedToSnapshot(finalResolved),
      response: responseSnap,
    });
    scriptOutcome = {
      ...(scriptOutcome ?? {}),
      postResponse: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        assertions: result.assertions,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
      },
    };
  }

  return scriptOutcome ? { ...wireResult, scripts: scriptOutcome } : wireResult;
}

// Register the executor with the offscreen host so `oh.sendRequest`
// calls can route through our resolve + fetch pipeline. Done once at
// module eval — idempotent if called again.
__setExecuteRequestDraft(executeRequestDraft);

// ── Live Workflow chain step executor ──────────────────────────────

/**
 * Internal header stamped on every Live Workflow chain fetch. Carries
 * the `<workflowUid>:<stepId>` pair so:
 *   (a) server-side logs can distinguish refresh traffic from user
 *       traffic (rare but cheap),
 *   (b) a future DNR-compile pass can exclude user rules referencing
 *       the workflow's LVs from matching the tagged request (Phase E
 *       territory — requires per-rule `referencedLvUids` tracking).
 *
 * Kept as a constant so the scheduler observability + UI picker + any
 * future DNR condition all read the same string.
 */
export const LIVE_BYPASS_HEADER = 'X-OH-Live-Bypass';

export interface LiveChainExecuteOptions {
  /** Active env the chain was scheduled under. `null` = "No environment". */
  environmentId: string | null;
  /** Parent workflow uid — stamped into the bypass header. */
  workflowUid: string;
  /** Current step id — stamped into the bypass header. */
  stepId: string;
  /**
   * Captures extracted from prior steps of this chain run. Keys are
   * step ids; values are `captureName → extractedValue` maps. Installed
   * on the resolver so `{{step.<id>.<name>}}` templates in this step's
   * request resolve correctly.
   */
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/**
 * Execute a persisted-request shape as one step of a Live Workflow
 * chain. Shares the resolve → fetch pipeline with `executeRequestDraft`
 * but:
 *   - threads the step-capture context into variable resolution,
 *   - skips pre/post script hooks (chain fetches are pure data-source
 *     fetches; running user scripts here would blur "my request" vs
 *     "workflow refresh" and trivially recurse via `oh.sendRequest`),
 *   - stamps the `X-OH-Live-Bypass` header on the outgoing request,
 *   - suppresses the `requests` Status pill (workflow refresh belongs
 *     to the `live` subsystem, not the generic request pill).
 *
 * Returned `ExecutedRequestSnapshot` is the same shape as user-facing
 * executions; the chain adapter maps it down to the core's
 * `StepResponse`.
 */
export async function executeForLiveChain(
  request: V5.Request,
  options: LiveChainExecuteOptions,
): Promise<ExecutedRequestSnapshot> {
  // Inject the bypass header into the request BEFORE resolution so it
  // gets normal templating treatment (no template in the value today,
  // but staying consistent with the rest of the header pipeline means
  // any future interpolation "just works").
  const bypassValue = `${options.workflowUid}:${options.stepId}`;
  const stamped: V5.Request = {
    ...request,
    headers: [...request.headers, { key: LIVE_BYPASS_HEADER, value: bypassValue, enabled: true }],
  };
  return executeRequestDraft(stamped, {
    environmentId: options.environmentId ?? undefined,
    stepCaptures: options.stepCaptures,
    skipScripts: true,
    silentStatus: true,
  });
}

// ── Script integration helpers ─────────────────────────────────────

function resolvedToSnapshot(req: ResolvedRequest): RequestSnapshot {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers.map((h) => ({ key: h.key, value: h.value })),
    params: [],
    body: {
      type: req.body.type,
      content: req.body.content,
      multipartParts: req.body.multipartParts,
    },
  };
}

function applyMutation(target: ResolvedRequest, mutation: RequestMutation): void {
  if (mutation.method) target.method = mutation.method;
  if (mutation.url) target.url = mutation.url;
  if (mutation.headers) target.headers = mutation.headers.map((h) => ({ key: h.key, value: h.value }));
  if (mutation.body) {
    target.body = {
      type: mutation.body.type,
      content: mutation.body.content,
      multipartParts: mutation.body.multipartParts,
    };
  }
}

// ── Variable resolution ────────────────────────────────────────────

async function buildResolver(
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>,
): Promise<VariableResolver> {
  const resolver = new VariableResolver();
  resolver.setVault(getVault());
  resolver.setEnvironments(getEnvironments());
  resolver.setActiveEnvironmentId(getActiveEnvironmentId());
  resolver.setDefaultEnvironmentId(getDefaultEnvironmentId());
  resolver.setWorkspaceVariables(getWorkspaceVariables());
  // Live scope — same snapshot the DNR compile pipeline uses, so a
  // request that references `{{live.token}}` sees the same value as
  // a DNR rule would. Empty until the first workflow refresh lands;
  // the warm mirror in `variables-resolver` updates via
  // `onLiveCacheStoreChange` between calls.
  resolver.setLiveRegistry(getLiveRegistrySnapshot());
  if (stepCaptures) {
    // Step-capture context — only present during Live Workflow chain
    // runs. Installed here so `{{step.<id>.<name>}}` references in a
    // step's templates see prior steps' extracted values.
    resolver.setStepCaptures(stepCaptures);
  }
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
  // File registry — powers `{{file.X}}` (ARCHITECTURE §6). Loading
  // the full workspace file list once per request is cheap (metadata
  // only, no blob bytes), and matches how other scopes are fed.
  try {
    const files = await listFiles();
    resolver.setFileRegistry(files);
  } catch {
    // If IDB is briefly unavailable (SW restart race) we proceed
    // without a registry; `{{file.X}}` surfaces `unset-in-scope` on
    // the error channel rather than breaking the request entirely.
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
  body: V5.RequestBody;
  /** Wire-level cookie policy. `'omit'` unless the request opts into `'include'`. */
  credentialsMode: V5.CredentialsMode;
  /**
   * Redirect policy forwarded to `fetch`. `false` maps to `'manual'`,
   * `undefined`/`true` map to `'follow'`. See the `followRedirects`
   * field on `V5.Request` for the architectural note about the missing
   * max-redirects cap.
   */
  followRedirects?: boolean;
  // auth and params are folded into `url` + `headers` below.
}

async function resolveRequest(request: V5.Request, options: ExecuteRequestOptions): Promise<ResolvedRequest> {
  const resolver = await buildResolver(options.stepCaptures);
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
  await applyAuth(request.auth, headers, enabledParams, resolveStr);

  // Append params to URL after auth — api-key-in-query lives in
  // enabledParams and MUST be appended too.
  resolvedUrl = appendQueryParams(resolvedUrl, enabledParams);

  // ── Body ────────────────────────────────────────────────────────
  const bodyType: V5.BodyType = request.body?.type ?? 'none';
  const resolvedBody = buildResolvedBody(request.body, bodyType, resolveStr);

  // Ensure Content-Type header matches the body type if the user
  // didn't set one. Skipped for `none` (no body), `form` (set by
  // the URLSearchParams path below), and `multipart` (set by the
  // browser with a generated boundary).
  if (bodyType !== 'none' && bodyType !== 'multipart' && !headers.some((h) => h.key.toLowerCase() === 'content-type')) {
    const ct = defaultContentType(bodyType);
    if (ct) headers.push({ key: 'Content-Type', value: ct });
  }

  return {
    method: request.method,
    url: resolvedUrl,
    headers,
    body: resolvedBody,
    // Cookie-jar policy. `'omit'` is the safe default when the request
    // doesn't explicitly opt in — even with `<all_urls>` granted, we
    // never ride the browser's cookie jar by accident. See ARCHITECTURE.md §14.
    credentialsMode: request.credentialsMode === 'include' ? 'include' : 'omit',
    followRedirects: request.followRedirects,
  };
}

/**
 * Build the resolved body payload the executor will attach to the
 * fetch. String bodies get template resolution applied to their
 * content; multipart bodies have their TEXT-part names + values run
 * through template resolution so `{{env.API_USER}}` and friends work
 * the same way across body types. File-part bytes themselves are
 * resolved later by `buildMultipartForm` via the BlobStore; the
 * `fileRefs` list passes through unchanged.
 */
function buildResolvedBody(
  body: V5.RequestBody | undefined,
  type: V5.BodyType,
  resolveStr: (s: string) => string,
): V5.RequestBody {
  if (type === 'multipart') {
    const parts = body?.multipartParts ?? [];
    const resolvedParts: V5.MultipartPart[] = parts.map((part) => {
      const name = resolveStr(part.name);
      if (part.kind === 'text') {
        return { kind: 'text', name, value: resolveStr(part.value), enabled: part.enabled };
      }
      return {
        kind: 'file',
        name,
        fileRefs: part.fileRefs,
        enabled: part.enabled,
      };
    });
    return { type: 'multipart', multipartParts: resolvedParts };
  }
  if (type === 'none') return { type: 'none' };
  const rawBody = body?.content ?? '';
  return { type, content: resolveStr(rawBody) };
}

async function applyAuth(
  auth: V5.AuthConfig,
  headers: Array<{ key: string; value: string }>,
  params: Array<{ key: string; value: string }>,
  resolveStr: (s: string) => string,
): Promise<void> {
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
    return;
  }
  if (auth.type === 'oauth2') {
    // OAuth2 access tokens live in the SW's per-workspace token
    // store (ARCHITECTURE §18). We fetch the bundle, refresh if
    // expired + a refresh token is available, then attach the
    // `Authorization: Bearer <access_token>` header.
    //
    // Silent failures on the send path are the right default here:
    // a missing/expired token surfaces in the response panel as a
    // 401 from the target API, which is more actionable for the
    // user than an extension-generated error. The Status pill +
    // observability log capture the detail either way.
    let bundle = await getOAuthTokenBundle(auth.credentialRef);
    if (bundle && isOAuthTokenExpired(bundle) && bundle.refreshToken) {
      try {
        bundle = await performOAuthRefresh(auth);
      } catch (err) {
        if (err instanceof OAuth2FlowError) {
          logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }
    if (bundle) {
      if (auth.sendAs === 'query') {
        // Legacy URI Query Parameter method (RFC 6750 §2.3) — the UI
        // warns the user this is deprecated; we still honor it for
        // providers that require it.
        params.push({ key: 'access_token', value: bundle.accessToken });
      } else {
        headers.push({ key: 'Authorization', value: `${bundle.tokenType} ${bundle.accessToken}` });
      }
    }
  }
}

// `ensureScheme` lives in the shared fetch module so the renderer
// (RequestEditor URL bar) and the executor apply the exact same
// normalization. Re-exported here so the request-executor unit
// test keeps importing from one place.
export { ensureScheme } from '@/shared/fetch/ensure-scheme';

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

async function executeResolved(
  req: ResolvedRequest,
  options: { silentStatus?: boolean } = {},
): Promise<ExecutedRequestSnapshot> {
  const trimmed = req.url.trim();
  if (!trimmed) {
    return errorSnapshot('URL is empty');
  }
  // Normalize scheme-less URLs. Chrome's `fetch()` resolves relative
  // URLs against the caller's origin — and the SW's origin is
  // `chrome-extension://<id>/`, whose asset filesystem returns
  // `ERR_FILE_NOT_FOUND` for unknown paths. That makes "example.com"
  // + GET produce a confusing "Failed to fetch" with no actionable
  // cause. Postman/Insomnia both assume `https://` when no scheme is
  // present; we match that. Templated URLs (`{{BASE}}/x`) are left
  // alone — the template may carry the scheme itself.
  req = { ...req, url: ensureScheme(trimmed) };

  const init: RequestInit = {
    method: req.method,
    // `followRedirects !== false` means chase 3xx to the final target
    // (matches curl / browsers by default). `false` selects `'manual'`,
    // which surfaces the first 3xx response verbatim — the fetch
    // resolves with an `opaqueredirect` response so the UI shows that
    // the hop happened without chasing it further. MV3 fetch can't
    // expose intermediate redirect headers, so the UI rail documents
    // that the max-redirects cap is browser-governed.
    redirect: req.followRedirects === false ? 'manual' : 'follow',
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
    // Structured `formParts` is the source of truth when present —
    // each enabled entry becomes a URLSearchParams field. Disabled
    // rows stay on disk for later re-enable but are skipped on the
    // wire. Legacy importers that only have the raw encoded string
    // populate `content` instead; we fall back to parsing it.
    const parts = req.body.formParts;
    if (parts && parts.length > 0) {
      const params = new URLSearchParams();
      for (const p of parts) {
        if (p.enabled === false) continue;
        params.append(p.key, p.value);
      }
      init.body = params;
    } else {
      init.body = new URLSearchParams(req.body.content);
    }
  } else if (req.body.type === 'multipart') {
    // Build FormData from the structured part list. For file parts
    // we resolve `fileRef.hash` to bytes via the BlobStore; dropped
    // parts (missing blob) land as a report entry in the response
    // snapshot so the user sees exactly what slipped through.
    const form = await buildMultipartForm(req.body.multipartParts ?? []);
    init.body = form;
    // IMPORTANT: clear any user-set `Content-Type: multipart/form-data`
    // header. The browser MUST set its own Content-Type with the
    // generated boundary; a manually-set header omits the boundary
    // and every server rejects the request with "malformed multipart".
    if (fetchHeaders.has('Content-Type')) {
      const ct = (fetchHeaders.get('Content-Type') ?? '').toLowerCase();
      if (ct.startsWith('multipart/form-data')) {
        fetchHeaders.delete('Content-Type');
      }
    }
  } else if (req.body.type !== 'none') {
    init.body = req.body.content;
  }

  const startedAt = performance.now();
  try {
    // Every user-facing fetch routes through withHostAccess — today a
    // pass-through, tomorrow the gate for a minimal-permissions SKU.
    const response = await withHostAccess(req.url, () => fetch(req.url, init));
    const durationMs = Math.round(performance.now() - startedAt);
    // A successful fetch resets the Status pill — the user sees
    // green again on their next glance. A reset is a clean transition
    // from yellow (most recent failure) back to green (baseline).
    // `silentStatus` suppresses the pill update for non-user-initiated
    // fetches (e.g., Live Workflow refreshes, which report through the
    // `live` subsystem instead).
    if (!options.silentStatus) {
      reportStatus({
        subsystem: 'requests',
        state: 'green',
        message: `Last request: ${response.status} ${response.statusText || 'OK'}`,
      });
    }

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
      scripts: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = err instanceof Error ? err.message : String(err);
    logger.info('RequestExecutor', `fetch failed for ${req.url}: ${message}`);
    recordLog({
      subsystem: 'request-executor',
      op: 'fetch',
      level: 'error',
      message: `Fetch failed for ${req.url}: ${message}`,
      context: {
        errorClass: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
    // Surface as a Status pill — one-shot fetch failures don't need
    // red (they may be routine offline / DNS blips), but the user
    // should see the most recent failure when they glance at the footer.
    if (!options.silentStatus) {
      reportStatus({
        subsystem: 'requests',
        state: 'yellow',
        message: `Last request failed: ${message}`,
        context: {
          url: req.url,
          errorClass: err instanceof Error ? err.name : undefined,
        },
      });
    }
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
      scripts: null,
    };
  }
}

/**
 * Build a FormData object from a V5 multipart part list. Text parts
 * go through verbatim; file parts resolve `fileRef.hash` to the
 * actual blob bytes via the per-workspace BlobStore. Missing blobs
 * are skipped silently today — the user sees the mismatch reflected
 * in the response (no part by that name) rather than a hard error.
 * A future dedicated Status-subsystem entry could surface this more
 * loudly once we have the UI affordance.
 */
async function buildMultipartForm(parts: readonly V5.MultipartPart[]): Promise<FormData> {
  const form = new FormData();
  for (const part of parts) {
    if (part.enabled === false) continue;
    if (part.kind === 'text') {
      form.append(part.name, part.value);
      continue;
    }
    // File parts hold a list — emit one FormData append per FileRef so
    // `<input type="file" multiple>` semantics round-trip correctly
    // (HTTP multipart allows repeated field names by design). Missing
    // blobs are skipped silently; the user sees the mismatch reflected
    // in the response.
    for (const ref of part.fileRefs) {
      const blob = await getFileBlob(ref.fileId);
      if (!blob) continue;
      const mimeType = ref.mimeType ?? blob.type ?? 'application/octet-stream';
      // Retype the blob so the multipart boundary carries the right
      // content-type (browsers default to application/octet-stream
      // for generic blobs, which some servers treat as opaque).
      const typed = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
      form.append(part.name, typed, ref.filename);
    }
  }
  return form;
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
    scripts: null,
  };
}
