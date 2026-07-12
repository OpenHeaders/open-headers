/**
 * Wire execution — folds the structured params into the URL, validates
 * it, drives `fetch()` with the resolved init (body variants, redirect
 * + cookie policy), and maps the outcome (or the browser's opaque
 * failure) into an `ExecutedRequestSnapshot`.
 */

import type { ExecutedRequestSnapshot, MultipartPart } from '@openheaders/core/types';
import { appendQueryParams } from '@openheaders/core/utils';
import { getFileBlob } from '@openheaders/oracle/entity/files-store';
import { ensureScheme } from '@openheaders/ui/shared/fetch';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import { recordLog } from '../observability-log';
import { classifyFetchFailure } from './failure-classify';
import type { ResolvedRequest } from './resolve';
import {
  estimateMultipartBytes,
  type MultipartFieldSize,
  serializedHeaderBytes,
  startTimingCapture,
  stringBodyBytes,
} from './timing';
import { startWireCapture } from './wire-capture';

/** Body cap in bytes — a user setting (MB), read per send. The
 *  per-request `maxResponseBytes` knob is node-runtime-only and is
 *  deliberately not consulted here. */
function maxBodyBytes(): number {
  return getSetting('requests.responseBodyCapMB') * 1024 * 1024;
}

/** Arm an abort deadline for the round-trip; `null` when the request
 *  carries no timeout. One deadline spans the whole exchange —
 *  connect, response, and body read — so a body stream stalled
 *  mid-read aborts too, which a fetch-only signal would miss. */
function startDeadline(timeoutMs: number | undefined) {
  if (timeoutMs === undefined) return null;
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    expired: () => expired,
    clear: () => clearTimeout(timer),
  };
}

export async function executeResolved(
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
  // cause. Scheme inference picks `http://` for loopback + RFC 1918 +
  // mDNS + single-label hosts (intranet / hosts-file / dev-server
  // pattern) and `https://` for everything else. Templated URLs
  // (`{{BASE}}/x`) are left alone — the template may carry the scheme.
  //
  // Structured params fold into the URL HERE, at the wire — after the
  // pre-request script has had its chance to read + replace them. This
  // is the single point where `req.params` becomes query string, so the
  // server sees script-set params exactly like user-set ones.
  req = { ...req, url: appendQueryParams(ensureScheme(trimmed), req.params) };

  // Pre-flight URL validation — catch malformed inputs BEFORE fetch
  // so the user sees "Invalid URL: <reason>" instead of the browser's
  // generic "Failed to fetch". Matches Postman's "Invalid URI" error
  // surface. Templated URLs still skip — the template may only resolve
  // to a valid URL at runtime, and a pre-resolution parse failure on
  // a raw template string would be a false positive.
  if (!req.url.startsWith('{{')) {
    try {
      const parsed = new URL(req.url);
      // Chrome accepts URLs with empty hostnames (e.g. `http:///path`)
      // at `new URL()`, but fetch() will fail with an opaque "Failed
      // to fetch." Reject here with a specific message.
      if (!parsed.hostname) {
        return errorSnapshot(`Invalid URL — missing host: "${req.url}"`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return errorSnapshot(`Invalid URL: ${reason}`);
    }
  }

  // Offline gate — browsers report every network error as an opaque
  // `TypeError: Failed to fetch`, so we can't classify "DNS failure"
  // vs "connection refused" vs "offline" after the fact. Catching
  // offline up front produces a clean, actionable message; everything
  // else falls through to the catch below and surfaces the browser's
  // raw error.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return errorSnapshot("Can't reach network — device reports offline. Check your connection and try again.");
  }

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
  //
  // Exhaustive over the resolved-body union — every variant attaches
  // its wire payload here. `none` attaches nothing; `form` produces a
  // URLSearchParams (browser-set Content-Type); `multipart` produces
  // FormData (browser-set Content-Type with boundary); JSON / XML /
  // text / graphql produce raw strings using the resolved content.
  let bodyBytes = 0;
  let bodyApproximate = false;
  switch (req.body.type) {
    case 'none':
      break;
    case 'json':
    case 'xml':
    case 'text':
      init.body = req.body.content;
      bodyBytes = stringBodyBytes(req.body.content);
      break;
    case 'graphql': {
      // GraphQL HTTP transport (https://graphql.org/learn/serving-over-http/):
      // the wire body is `{"query": "...", "variables": {...}}` —
      // application/json. Sending the raw query string verbatim is what
      // the executor used to do; no GraphQL server accepts that.
      // `graphqlVariables` is JSON text the user typed; embed it as
      // parsed JSON when valid so the wire body has a real `variables`
      // object, falling back to omitting the field on parse failure
      // (better to send `{query}` than a malformed wire body that
      // crashes the server JSON parser).
      const wire: { query: string; variables?: unknown } = { query: req.body.content };
      const variablesText = req.body.graphqlVariables?.trim();
      if (variablesText) {
        try {
          wire.variables = JSON.parse(variablesText);
        } catch {
          // Leave `variables` unset; the server sees `{query}` which
          // most accept as "no variables" rather than 400.
        }
      }
      const wireText = JSON.stringify(wire);
      init.body = wireText;
      bodyBytes = stringBodyBytes(wireText);
      break;
    }
    case 'form': {
      // Structured `formParts` is the source of truth — each enabled
      // entry becomes a URLSearchParams field. Disabled rows stay on
      // disk for later re-enable but are skipped on the wire.
      const params = new URLSearchParams();
      for (const p of req.body.formParts) {
        if (p.enabled === false) continue;
        params.append(p.key, p.value);
      }
      init.body = params;
      bodyBytes = stringBodyBytes(params.toString());
      break;
    }
    case 'multipart': {
      // Build FormData from the structured part list. For file parts
      // we resolve `fileRef.hash` to bytes via the BlobStore; dropped
      // parts (missing blob) land as a report entry in the response
      // snapshot so the user sees exactly what slipped through.
      const built = await buildMultipartForm(req.body.multipartParts);
      init.body = built.form;
      bodyBytes = built.bodyBytes;
      bodyApproximate = true;
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
      break;
    }
    default: {
      const _exhaustive: never = req.body;
      void _exhaustive;
    }
  }

  const requestSize = {
    headersBytes: serializedHeaderBytes(fetchHeaders),
    bodyBytes,
    ...(bodyApproximate ? { bodyApproximate: true } : {}),
  };

  // Per-request timeout — the abort surfaces below with a message
  // naming the configured ceiling, mirroring the node transport's
  // "Request timed out after N ms." (the raw AbortError is useless).
  const deadline = startDeadline(req.timeoutMs);
  if (deadline) init.signal = deadline.signal;

  const startedAt = performance.now();
  // Window-scoped observer for this fetch's resource-timing entry —
  // opened right at the mark so the pick can anchor on `startedAt`.
  const capture = startTimingCapture(startedAt);
  // Wire-layer capture (Set-Cookie, remote IP) — same window pattern,
  // joined against the extension-traffic webRequest channel.
  const wireCapture = startWireCapture({
    method: req.method,
    url: req.url,
    credentialsMode: req.credentialsMode,
  });
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
    const responseBodyBytes = new TextEncoder().encode(bodyText).byteLength;
    const capBytes = maxBodyBytes();
    const truncated = responseBodyBytes > capBytes;
    const body = truncated ? bodyText.slice(0, capBytes) : bodyText;

    // The entry queues once the body finishes downloading — which the
    // completed text() read implies — so settle after the read.
    const timing = await capture.settle({ submittedUrl: req.url, finalUrl: response.url || req.url });
    const wire = await wireCapture.settle();

    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || req.url,
      headers,
      body,
      bodyTruncated: truncated,
      ...(truncated ? { bodyCapBytes: capBytes } : {}),
      bodyBytes: responseBodyBytes,
      durationMs,
      ...(timing ? { timing } : {}),
      ...(wire ? { wire } : {}),
      requestSize,
      error: null,
      scripts: null,
    };
  } catch (err) {
    capture.cancel();
    const durationMs = Math.round(performance.now() - startedAt);
    const rawMessage = err instanceof Error ? err.message : String(err);
    // An expired per-request deadline aborts the exchange with an
    // opaque AbortError — replace it with a message naming the
    // configured ceiling (same string the node transport surfaces).
    const timedOut = deadline?.expired() === true;
    // `fetch()` opaques every network error — DNS failure, connection
    // refused, bad certificate, missing host permission — into the
    // exact same `TypeError: Failed to fetch` with no `err.cause`
    // chain. The webRequest layer sees the real net-stack code for the
    // SW's own traffic, so for the generic failure the wire capture is
    // settled (not canceled) to recover it; classification leads with
    // that code — the same string the browser's own Network panel
    // shows — and falls back to protocol/host heuristics without it.
    const isGenericFetchFail = !timedOut && err instanceof TypeError && /failed to fetch/i.test(rawMessage);
    let netError: string | undefined;
    if (isGenericFetchFail) {
      netError = await wireCapture.settleNetError();
    } else {
      wireCapture.cancel();
    }
    const { message, hint } = timedOut
      ? { message: `Request timed out after ${req.timeoutMs} ms.`, hint: undefined }
      : isGenericFetchFail
        ? classifyFetchFailure(req.url, rawMessage, netError)
        : { message: rawMessage, hint: undefined };
    logger.info('RequestExecutor', `fetch failed for ${req.url}: ${netError ?? rawMessage}`);
    recordLog({
      subsystem: 'request-executor',
      op: 'fetch',
      level: 'error',
      message: `Fetch failed for ${req.url}: ${netError ?? rawMessage}`,
      context: {
        errorClass: err instanceof Error ? err.name : undefined,
        ...(netError !== undefined ? { netError } : {}),
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
      ...(hint ? { errorHint: hint } : {}),
      scripts: null,
    };
  } finally {
    deadline?.clear();
  }
}

/**
 * Build a FormData object from a multipart part list. Text parts
 * go through verbatim; file parts resolve `fileRef.hash` to the
 * actual blob bytes via the per-workspace BlobStore. Missing blobs
 * are skipped silently today — the user sees the mismatch reflected
 * in the response (no part by that name) rather than a hard error.
 * A future dedicated Status-subsystem entry could surface this more
 * loudly once we have the UI affordance.
 */
async function buildMultipartForm(parts: readonly MultipartPart[]): Promise<{ form: FormData; bodyBytes: number }> {
  const form = new FormData();
  const fields: MultipartFieldSize[] = [];
  for (const part of parts) {
    if (part.enabled === false) continue;
    if (part.kind === 'text') {
      form.append(part.name, part.value);
      fields.push({ name: part.name, payloadBytes: stringBodyBytes(part.value) });
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
      fields.push({ name: part.name, filename: ref.filename, mimeType, payloadBytes: typed.size });
    }
  }
  return { form, bodyBytes: estimateMultipartBytes(fields) };
}

export function errorSnapshot(message: string): ExecutedRequestSnapshot {
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
