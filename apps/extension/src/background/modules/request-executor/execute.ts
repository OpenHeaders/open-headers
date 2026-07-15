/**
 * Wire execution — folds the structured params into the URL, validates
 * it, drives `fetch()` with the resolved init (body variants, redirect
 * + cookie policy), and maps the outcome (or the browser's opaque
 * failure) into an `ExecutedRequestSnapshot`.
 */

import { AWS_SIGV4_UNSIGNED_PAYLOAD, sha256Hex, signAwsSigV4, signOAuth1 } from '@openheaders/core/auth-signing';
import type { ExecutedRequestSnapshot, MultipartPart } from '@openheaders/core/types';
import { appendQueryParams } from '@openheaders/core/utils';
import { getFileBlob } from '@openheaders/oracle/entity/files-store';
import { materializeBody } from '@openheaders/oracle/live/request-exec/body-decode';
import { ensureScheme } from '@openheaders/ui/shared/fetch';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import { base64ToBytes } from '@/shared/wire-fetch/plan';
import { recordLog } from '../observability-log';
import { graphqlWireText } from './body';
import { classifyFetchFailure } from './failure-classify';
import { isCertRejection, retryCertRejectedFetch } from './offscreen-retry';
import type { ResolvedRequest } from './resolve';
import { createStreamEmitter, registerActiveSend, type StreamEmitter } from './send-stream';
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

/** Abort control spanning the whole exchange — connect, response, and
 *  body read — so a body stream stalled mid-read aborts too, which a
 *  fetch-only signal would miss. Two triggers share the one signal:
 *  the per-request deadline (`expired`) and the user's Stop on an
 *  interactive send carrying a `sendId` (`stopped`). `null` when
 *  neither is in play, so signal-less sends stay exactly as before. */
function startExchangeControl(timeoutMs: number | undefined, sendId: string | undefined) {
  if (timeoutMs === undefined && sendId === undefined) return null;
  const controller = new AbortController();
  let expired = false;
  let stopped = false;
  const timer =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          expired = true;
          controller.abort();
        }, timeoutMs);
  const unregister =
    sendId === undefined
      ? null
      : registerActiveSend(sendId, () => {
          stopped = true;
          controller.abort();
        });
  return {
    signal: controller.signal,
    expired: () => expired,
    stopped: () => stopped,
    clear: () => {
      if (timer !== null) clearTimeout(timer);
      unregister?.();
    },
  };
}

export async function executeResolved(
  req: ResolvedRequest,
  options: { silentStatus?: boolean; sendId?: string } = {},
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

  // Body handling — attach the body for any method the user chose,
  // EXCEPT where the platform makes it impossible: browser `fetch()`
  // refuses to construct a GET/HEAD request carrying a body (a
  // TypeError before any wire activity), so attaching it would fail
  // the whole send. Be permissive instead — the request goes out
  // without the body and the snapshot carries `requestBodyOmitted` so
  // the response panel says what the server actually saw. Node
  // runtimes have no such restriction and put the same draft's body on
  // the wire.
  //
  // Exhaustive over the resolved-body union — every variant attaches
  // its wire payload here. `none` attaches nothing; `form` produces a
  // URLSearchParams (browser-set Content-Type); `multipart` produces
  // FormData (browser-set Content-Type with boundary); JSON / XML /
  // text / graphql produce raw strings using the resolved content.
  const method = req.method.toUpperCase();
  const requestBodyOmitted = (method === 'GET' || method === 'HEAD') && req.body.type !== 'none';
  if (requestBodyOmitted) req = { ...req, body: { type: 'none' } };
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
      // GraphQL wire fold — see graphqlWireText: `{"query", "variables"}`
      // as application/json, shared with the offscreen wire-plan builder.
      const wireText = graphqlWireText(req.body.content, req.body.graphqlVariables);
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

  // SigV4 signs HERE — the final wire shape, after the pre-request
  // script's mutations and the params → URL fold — and its headers
  // replace same-key user rows (a stale Authorization would combine
  // into garbage on the wire). Twin of the oracle wire executor's leg.
  if (req.awsSigV4) {
    try {
      const signed = await signAwsSigV4(req.awsSigV4, {
        method: req.method,
        url: req.url,
        headers: [...fetchHeaders.entries()].map(([key, value]) => ({ key, value })),
        payloadHash: await fetchPayloadHash(init.body),
        now: new Date(),
      });
      for (const h of signed) fetchHeaders.set(h.key, h.value);
      // Mirror the signed set back onto `req.headers` so the offscreen
      // cert-exception retry (which rebuilds its plan from `req`)
      // ships the same signature.
      req = { ...req, headers: [...fetchHeaders.entries()].map(([key, value]) => ({ key, value })) };
    } catch (err) {
      return errorSnapshot(`AWS SigV4 signing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // OAuth1 signs HERE too — same wire-time discipline as SigV4. Header
  // mode replaces a same-key user Authorization row; query mode appends
  // the oauth_* params to the final URL. Both mirror back onto `req` so
  // the offscreen cert-exception retry ships the same signature.
  if (req.oauth1) {
    try {
      const signed = await signOAuth1(req.oauth1, {
        method: req.method,
        url: req.url,
        ...(init.body instanceof URLSearchParams
          ? { bodyParams: [...init.body.entries()].map(([name, value]) => ({ name, value })) }
          : {}),
        timestampSec: Math.floor(Date.now() / 1000),
        nonce: generateOAuth1Nonce(),
      });
      for (const h of signed.headers) fetchHeaders.set(h.key, h.value);
      const url = signed.queryParams.length > 0 ? appendQueryParams(req.url, signed.queryParams) : req.url;
      req = { ...req, url, headers: [...fetchHeaders.entries()].map(([key, value]) => ({ key, value })) };
    } catch (err) {
      return errorSnapshot(`OAuth 1.0 signing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const requestSize = {
    headersBytes: serializedHeaderBytes(fetchHeaders),
    bodyBytes,
    ...(bodyApproximate ? { bodyApproximate: true } : {}),
  };

  // Per-request timeout + interactive Stop — the abort surfaces below
  // with a message naming what fired, mirroring the node transport's
  // "Request timed out after N ms." (the raw AbortError is useless).
  const exchange = startExchangeControl(req.timeoutMs, options.sendId);
  if (exchange) init.signal = exchange.signal;

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

    // Read the body as BYTES, STREAMED, with the size cap applied
    // byte-wise as it arrives — never a whole-body buffer (a response
    // that streams forever would otherwise hang the send and grow
    // memory without bound). Interactive sends carrying a `sendId`
    // push live frames (head immediately, flush-batched chunks) so the
    // response panel can tail the stream; a Stop / deadline / mid-body
    // failure materializes the snapshot from what arrived instead of
    // discarding it. Then materialize: valid UTF-8 stays text, anything
    // else goes base64 (`bodyEncoding`) — lossless either way.
    // `bodyBytes` counts the wire bytes read, so binary sizes match
    // the server's Content-Length instead of inflating through a
    // lossy decode.
    const capBytes = maxBodyBytes();
    const emitter = options.sendId ? createStreamEmitter(options.sendId) : null;
    emitter?.head({
      status: response.status,
      statusText: response.statusText,
      url: response.url || req.url,
      headers,
    });
    const read = await readInteractiveBody(response, capBytes, emitter);
    emitter?.done();
    const durationMs = Math.round(performance.now() - startedAt);
    const { body, bodyEncoding } = materializeBody(read.bytes, read.truncated);
    const streamedCapture = streamedCaptureOf(
      read,
      exchange?.expired() === true,
      (emitter?.chunkFramesSent() ?? 0) > 0,
    );

    // The entry queues once the body finishes downloading — which the
    // settled body read implies (an aborted read may never queue one;
    // settle is bounded and returns undefined) — so settle after it.
    const timing = await capture.settle({ submittedUrl: req.url, finalUrl: response.url || req.url });
    const wire = await wireCapture.settle();

    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || req.url,
      headers,
      body,
      ...(bodyEncoding ? { bodyEncoding } : {}),
      bodyTruncated: read.truncated,
      ...(read.truncated ? { bodyCapBytes: capBytes } : {}),
      bodyBytes: read.bytesRead,
      durationMs,
      ...(timing ? { timing } : {}),
      ...(wire ? { wire } : {}),
      ...(streamedCapture ? { streamedCapture } : {}),
      requestSize,
      ...(requestBodyOmitted ? { requestBodyOmitted: true } : {}),
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
    const timedOut = exchange?.expired() === true;
    // A user Stop that fired before any response head reaches here the
    // same way (nothing arrived, so there is nothing to materialize —
    // a Stop mid-body materializes a partial snapshot above instead).
    const stoppedByUser = !timedOut && exchange?.stopped() === true;
    // `fetch()` opaques every network error — DNS failure, connection
    // refused, bad certificate, missing host permission — into the
    // exact same `TypeError: Failed to fetch` with no `err.cause`
    // chain. The webRequest layer sees the real net-stack code for the
    // SW's own traffic, so for the generic failure the wire capture is
    // settled (not canceled) to recover it; classification leads with
    // that code — the same string the browser's own Network panel
    // shows — and falls back to protocol/host heuristics without it.
    // Chromium spells the opaque failure "Failed to fetch"; Firefox
    // spells it "NetworkError when attempting to fetch resource." —
    // both are the same generic TypeError with the real cause hidden.
    const isGenericFetchFail =
      !timedOut &&
      !stoppedByUser &&
      err instanceof TypeError &&
      /failed to fetch|networkerror when attempting to fetch/i.test(rawMessage);
    let netError: string | undefined;
    if (isGenericFetchFail) {
      netError = await wireCapture.settleNetError();
      // Certificate-family rejection: Chromium never honors a user-
      // accepted certificate exception for a SW fetch, but it does for
      // a document — re-run the exchange inside the offscreen document
      // so "open in tab → accept the warning → retry" actually works
      // (see offscreen-retry.ts). Falls through to the classified error
      // when the retry can't do better.
      if (isCertRejection(netError)) {
        const capBytes = maxBodyBytes();
        const retried = await retryCertRejectedFetch(req, capBytes);
        if (retried) {
          const { body, bodyEncoding } = materializeBody(base64ToBytes(retried.bodyBase64), retried.truncated);
          if (!options.silentStatus) {
            reportStatus({
              subsystem: 'requests',
              state: 'green',
              message: `Last request: ${retried.status} ${retried.statusText || 'OK'}`,
            });
          }
          return {
            status: retried.status,
            statusText: retried.statusText,
            url: retried.url,
            headers: retried.headers,
            body,
            ...(bodyEncoding ? { bodyEncoding } : {}),
            bodyTruncated: retried.truncated,
            ...(retried.truncated ? { bodyCapBytes: capBytes } : {}),
            bodyBytes: retried.bodyBytes,
            durationMs: retried.durationMs,
            requestSize,
            ...(requestBodyOmitted ? { requestBodyOmitted: true } : {}),
            error: null,
            scripts: null,
          };
        }
      }
    } else {
      wireCapture.cancel();
    }
    const { message, hint } = timedOut
      ? { message: `Request timed out after ${req.timeoutMs} ms.`, hint: undefined }
      : stoppedByUser
        ? { message: 'Request stopped before a response arrived.', hint: undefined }
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
      ...(requestBodyOmitted ? { requestBodyOmitted: true } : {}),
      error: message,
      ...(hint ? { errorHint: hint } : {}),
      scripts: null,
    };
  } finally {
    exchange?.clear();
  }
}

/** Outcome of the streamed interactive body read. */
interface InteractiveBodyRead {
  /** Retained (cap-bounded) wire bytes. */
  bytes: Uint8Array;
  /** Total bytes read off the wire before any truncation. */
  bytesRead: number;
  /** True when the cap aborted the read — `bytes` is the capped prefix. */
  truncated: boolean;
  /** How the read settled: the stream completed, the cap aborted it,
   *  the exchange signal fired mid-read (Stop / deadline), or the
   *  connection failed mid-body. */
  ended: 'end' | 'cap' | 'aborted' | 'error';
  /** Failure text for `ended: 'error'`. */
  errorMessage?: string;
}

/**
 * Stream the response body, retaining at most `capBytes` and aborting
 * the read once the upstream overflows the cap (same discipline as the
 * chain transport's capped read — the SW must never buffer an unbounded
 * response). A read() rejection after the head arrived is a PARTIAL
 * capture, not a loss: Stop, deadline, and mid-body connection failures
 * all settle with whatever bytes made it, and the caller materializes a
 * normal snapshot from them. Live frames (when an emitter rides along)
 * carry only cap-bounded bytes, so the tail never shows bytes the
 * snapshot won't keep.
 */
async function readInteractiveBody(
  response: Response,
  capBytes: number,
  emitter: StreamEmitter | null,
): Promise<InteractiveBodyRead> {
  const stream = response.body;
  if (!stream) return { bytes: new Uint8Array(0), bytesRead: 0, truncated: false, ended: 'end' };
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let bytesRead = 0;
  let ended: InteractiveBodyRead['ended'] = 'end';
  let errorMessage: string | undefined;
  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        ended = aborted ? 'aborted' : 'error';
        if (!aborted) errorMessage = err instanceof Error ? err.message : String(err);
        break;
      }
      if (result.done) break;
      const value = result.value;
      if (!value || value.byteLength === 0) continue;
      const before = bytesRead;
      parts.push(value);
      bytesRead += value.byteLength;
      if (emitter) {
        const allowed = Math.min(value.byteLength, Math.max(0, capBytes - before));
        if (allowed > 0) {
          emitter.chunk(
            allowed === value.byteLength ? value : value.subarray(0, allowed),
            Math.min(bytesRead, capBytes),
          );
        }
      }
      if (bytesRead > capBytes) {
        ended = 'cap';
        try {
          await reader.cancel();
        } catch {
          // Upstream already failed — the retained bytes still stand.
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const retained = Math.min(bytesRead, capBytes);
  const buf = new Uint8Array(retained);
  let offset = 0;
  for (const part of parts) {
    if (offset >= retained) break;
    const take = Math.min(part.byteLength, retained - offset);
    buf.set(part.subarray(0, take), offset);
    offset += take;
  }
  return {
    bytes: buf,
    bytesRead,
    truncated: ended === 'cap',
    ended,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
  };
}

/**
 * Map a settled read onto the snapshot's `streamedCapture` attribution.
 * Stop/deadline/mid-body failure always stamp (the body is partial —
 * the surface must say so); a natural end or a cap abort stamp only
 * when the live stream phase engaged (chunk frames actually went out),
 * so ordinary responses — which complete before the first flush window
 * — carry no rider.
 */
function streamedCaptureOf(
  read: InteractiveBodyRead,
  expired: boolean,
  liveEngaged: boolean,
): ExecutedRequestSnapshot['streamedCapture'] | undefined {
  switch (read.ended) {
    case 'aborted':
      return { endedBy: expired ? 'timeout' : 'stop' };
    case 'error':
      return { endedBy: 'error', ...(read.errorMessage !== undefined ? { message: read.errorMessage } : {}) };
    case 'cap':
      return liveEngaged ? { endedBy: 'cap' } : undefined;
    case 'end':
      return liveEngaged ? { endedBy: 'end' } : undefined;
    default: {
      const _exhaustive: never = read.ended;
      void _exhaustive;
      return undefined;
    }
  }
}

/** 128-bit hex client nonce for OAuth1 signing. */
function generateOAuth1Nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * SHA-256 of the wire payload for SigV4 signing. String bodies hash
 * verbatim; URLSearchParams serializes to the exact bytes fetch ships;
 * FormData bytes are unknowable ahead of dispatch (the browser picks
 * the boundary), so multipart signs `UNSIGNED-PAYLOAD` (honored by S3
 * over HTTPS).
 */
async function fetchPayloadHash(body: RequestInit['body']): Promise<string> {
  if (body === undefined || body === null) return sha256Hex('');
  if (typeof body === 'string') return sha256Hex(body);
  if (body instanceof URLSearchParams) return sha256Hex(body.toString());
  return AWS_SIGV4_UNSIGNED_PAYLOAD;
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
