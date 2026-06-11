/**
 * Request-state taxonomy — the single source of truth for every UI
 * surface that needs to know "is this row red / grey / pending / a
 * redirect / a cache hit?".
 *
 * Callers branch on `state.kind` — no more "is it both blocked and
 * cached?" ambiguity. Each lifecycle has exactly one state.
 *
 * Precedence when multiple signals are present:
 *
 *   1. `pending`  — no response observed yet (treat as in-flight)
 *   2. `blocked`  — Chrome blocked it before the wire (DNR, CSP,
 *                   mixed-content, ad-block extensions)
 *   3. `failed`   — a wire attempt failed (DNS, TLS, timeout,
 *                   net::ERR_*)
 *   4. `cached`   — the response came from a local cache layer
 *                   (disk / memory / service-worker) rather than the
 *                   server
 *   5. `redirect` — 3xx that points elsewhere
 *   6. `success`  — anything else with a real HTTP response
 *
 * The ordering matters: a blocked cached request is still best
 * described as "blocked" (the cache layer didn't serve it either),
 * and a failed redirect is still "failed".
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { isRendererRejectCode, lookupErrorCode } from './chromium-error-codes';
import { currentHarEntry, lifecycleTransferredBytes } from './inspector-row-projection';

export type CacheSource = 'disk' | 'memory' | 'service-worker';

export type RequestState =
  | { kind: 'pending' }
  | { kind: 'success'; status: number }
  | { kind: 'redirect'; status: number; location: string | null }
  | { kind: 'cached'; source: CacheSource; status: number }
  /** A real HTTP response that the server returned with a 4xx or 5xx
   *  code. Distinct from `failed` (net-stack failure, no HTTP exchange)
   *  but rendered with the same red row styling. */
  | { kind: 'httpError'; status: number }
  | { kind: 'blocked'; reason: string }
  | { kind: 'failed'; reason: string };

// ── Detection primitives ────────────────────────────────────────

function isBlockedStatus(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('blocked') || t.includes('net::err_blocked');
}

/**
 * A document request torn down after its response began: bare
 * `net::ERR_FAILED` on a frame hop that already carries a wire status. A
 * frame navigation is never CORS/ORB-rejected (frame-level policy blocks
 * report their own codes), so the generic failure here is the stop() /
 * navigation teardown — which the browser's own panel never sees (no
 * terminal lands on its plane) and keeps showing the response status.
 * Treated as a cancellation, never as a renderer rejection or a block.
 */
function isDocumentTeardownFailure(lifecycle: RequestLifecycle): boolean {
  if (lifecycle.error?.code !== 'net::ERR_FAILED') return false;
  const type = lifecycle.resourceType;
  if (type !== 'main_frame' && type !== 'sub_frame' && type !== 'document') return false;
  return typeof lifecycle.statusCode === 'number' && lifecycle.statusCode > 0;
}

function isFailureStatus(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.startsWith('net::err_') ||
    t.startsWith('ns_error_') ||
    t.includes('timed_out') ||
    t.includes('timed out') ||
    t.includes('name_not_resolved') ||
    t.includes('internet_disconnected') ||
    t.includes('connection_refused') ||
    t.includes('connection_reset') ||
    t.includes('ssl_') ||
    t.includes('cert_')
  );
}

function cacheSource(lifecycle: RequestLifecycle): CacheSource | null {
  const har = currentHarEntry(lifecycle);
  if (har?.response?._fetchedViaServiceWorker) return 'service-worker';
  const raw = har?._fromCache;
  if (raw === 'disk' || raw === 'memory') return raw;
  if (har?._servedFromCache) return 'memory';
  // The lifecycle's bare `fromCache` boolean (from webRequest) is set both
  // for a true memory-cache hit AND for a 304 revalidation that sent bytes
  // over the wire. Only the former bypasses the network entirely, so treat
  // it as memory cache only when nothing was transferred — otherwise the
  // request is a real (revalidated) network response shown by its status.
  if (lifecycle.fromCache && (lifecycleTransferredBytes(lifecycle) ?? 0) === 0) return 'memory';
  return null;
}

// ── Classifier ──────────────────────────────────────────────────

/**
 * The status code to display. Prefers the devtools HAR status — the
 * authoritative HTTP status, including `304 Not Modified` — over the
 * webRequest `statusCode`, which surfaces the cached `200` for a
 * revalidated resource. Falls back to webRequest while the HAR is still
 * in flight (no response shell yet).
 */
export function effectiveStatusCode(lifecycle: RequestLifecycle): number | undefined {
  const harStatus = currentHarEntry(lifecycle)?.response?.status;
  if (typeof harStatus === 'number' && harStatus > 0) return harStatus;
  return lifecycle.statusCode;
}

export function classifyRequestState(lifecycle: RequestLifecycle): RequestState {
  const har = currentHarEntry(lifecycle);
  const statusText = lifecycle.statusText ?? har?.response?.statusText ?? '';
  // Pending / failure detection stays on the raw webRequest status — it is
  // the authority on whether the request even reached a response (a `< 0`
  // code is a net-stack failure that the HAR shell must never mask).
  const rawStatus = lifecycle.statusCode;

  // 1. Renderer-rejected errors win even when a wire status arrived — except
  //    the document-teardown shape, where the same bare code is a cancel and
  //    the browser keeps showing the response status.
  if (lifecycle.error && isRendererRejectCode(lifecycle.error.code) && !isDocumentTeardownFailure(lifecycle)) {
    const probe = lifecycle.error.reason || statusText;
    if (isBlockedStatus(probe)) {
      return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
    }
    return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
  }

  // 2. Pending — response still in flight (no status, no error).
  if (rawStatus == null) {
    if (lifecycle.error) {
      const probe = lifecycle.error.reason || statusText;
      if (isBlockedStatus(probe)) {
        return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
      }
      return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
    }
    return { kind: 'pending' };
  }

  if (rawStatus < 0) return { kind: 'failed', reason: statusText || 'failed' };
  if (isBlockedStatus(statusText)) return { kind: 'blocked', reason: statusText };
  if (isFailureStatus(statusText)) return { kind: 'failed', reason: statusText };

  // Past the failure gates, the HAR status is the authoritative HTTP code
  // for display (it carries 304; webRequest reports the cached 200).
  const status = effectiveStatusCode(lifecycle) ?? rawStatus;

  // 304 Not Modified is a conditional-GET revalidation — a real network
  // round-trip the browser shows as "304" with its transferred bytes, not
  // a from-cache label. Resolve it before the cache check so a webRequest
  // `fromCache` flag can't mislabel it as a memory-cache hit.
  if (status === 304) return { kind: 'success', status: 304 };

  const src = cacheSource(lifecycle);
  if (src) return { kind: 'cached', source: src, status };

  if (status >= 300 && status < 400) {
    const location = har?.response?.redirectURL ?? null;
    return { kind: 'redirect', status, location };
  }

  if (status >= 400) {
    return { kind: 'httpError', status };
  }

  return { kind: 'success', status };
}

// ── Preserved-unknown (post-navigation) ─────────────────────────
//
// On a committed top-level navigation the prior page unloads, canceling its
// still-in-flight requests. No terminal event ever arrives for them (neither
// the HAR `onRequestFinished` nor the CDP `loadingFinished/Failed`), so they
// would otherwise sit `pending` forever. The host preserves them under
// Preserve-log and renders their unknowable outcome as `(unknown)` in both the
// Status and Time cells — a row whose issuing page is gone is terminal for
// display even though the engine never saw it finish.
//
// The host decides "issuing page is gone" by loader identity, not by time: on
// each primary-page change it carries a request into the new page iff
// `request.loaderId === mainFrame.loaderId`, otherwise it marks it preserved.
// We mirror that — a non-terminal row whose loader id differs from the latest
// page's loader id is superseded. The heuristic leg carries the sibling
// binding: webRequest `documentId` on the row (stamped only for requests the
// outermost frame's document issued) against the committed `Page.documentId`,
// the same `!==` law. The start-time floor remains the fallback for rows with
// no binding on either side (a worker request, an iframe subresource, the
// async pre-resolution window after a heuristic commit, Firefox).

/** The Status/Time label for a request whose issuing page unloaded mid-flight. */
export const PRESERVED_UNKNOWN_LABEL = '(unknown)';
/** Tooltip for {@link PRESERVED_UNKNOWN_LABEL}. */
export const PRESERVED_UNKNOWN_TITLE =
  'The request status cannot be shown here because the page that issued it unloaded while the request was in flight.';

/**
 * The latest in-view navigation, the binding a row is tested against.
 * `latestPageLoaderId` is its loader id (CDP page source) and
 * `latestPageDocumentId` its committed document UUID (heuristic page source) —
 * the two binding keys, one per leg. `latestNavStartedAtMs` is its
 * `startedAtMs`, the time-floor fallback used when no binding is known.
 */
export interface SupersessionAnchor {
  readonly latestNavStartedAtMs: number;
  readonly latestPageLoaderId?: string;
  readonly latestPageDocumentId?: string;
  /**
   * Every in-view navigation start time. The never-terminated floor only needs
   * the latest, but the cancellation-abort carve-out needs the full set: it asks
   * whether a navigation committed *during* a request's in-flight window, which
   * the latest nav alone can't answer after a second navigation.
   */
  readonly navStartsMs?: readonly number[];
}

/**
 * The supersession anchor derived from a page list — the latest in-view
 * navigation plus every navigation start. The list cells and the detail pane
 * both test rows against it; deriving it from the same `pages` source through
 * one helper keeps them in lockstep.
 */
export function supersessionAnchorFromPages(pages: readonly Page[]): SupersessionAnchor {
  const latest = pages.length > 0 ? pages[pages.length - 1] : null;
  return {
    latestNavStartedAtMs: latest?.startedAtMs ?? -1,
    latestPageLoaderId: latest?.loaderId,
    latestPageDocumentId: latest?.documentId,
    navStartsMs: pages.map((p) => p.startedAtMs),
  };
}

/** Whether any navigation started inside the half-open window `(startMs, endMs]`. */
function navStartedDuring(navStartsMs: readonly number[] | undefined, startMs: number, endMs: number): boolean {
  return navStartsMs?.some((t) => t > startMs && t <= endMs) ?? false;
}

/**
 * Whether a row is a preserved-unknown: a non-terminal request from a page that
 * a newer committed top-level navigation has superseded. A completed row renders
 * normally (it has a real outcome), so the terminal gate excludes it first.
 *
 * Binding, in the host's order of authority:
 *   1. **Loader identity** (CDP). When both the row and the latest page carry a
 *      loader id, the row is superseded iff they differ — the host's
 *      `request.loaderId !== mainFrame.loaderId` rule. This is start-time
 *      agnostic, so it correctly supersedes a prior-page subresource issued in
 *      the slow [nav-start, commit] transition window (its loader id is the old
 *      page's even though it started after the new nav began).
 *   2. **Document identity** (heuristic) — the same `!==` law on the sibling
 *      key: the row's webRequest `documentId` (stamped only for requests the
 *      outermost frame's document issued) against the latest page's committed
 *      `documentId`. Probe-proven (`probe-documentid-diagnose`): a
 *      transition-window old-page subresource carries the OLD document's UUID,
 *      so this closes the same transition-window class on the heuristic leg.
 *   3. **Start-time floor** (fallback). With no binding on either side — a
 *      worker request, an iframe subresource (its documentId is its own iframe
 *      document's, never the page's — deliberately unstamped), the async
 *      pre-resolution window after a heuristic commit, Firefox — a row is
 *      superseded when it started before the latest navigation. `latestNavStartedAtMs
 *      <= 0` (no navigation observed) → never preserved-unknown.
 *
 * Terminal gate: a genuinely resolved request has a real outcome and isn't
 * preserved — EXCEPT a cancellation-abort that a navigation caused. The net
 * process reports a navigation tearing down its page's in-flight requests as
 * `onErrorOccurred`/`net::ERR_ABORTED`, setting a terminal `completedAtMs` even
 * though nothing was delivered to the page; that is as unknowable as a
 * never-terminated request (the browser's own renderer-coupled panel shows
 * `(unknown)`). An explicit cancellation on a live page looks identical on the
 * wire, so the two are told apart by *timing*: a navigation-abort has a nav
 * committing inside its in-flight window `(startedAtMs, completedAtMs]` (the nav
 * killed it), while a real cancel resolved with no nav in its window — and stays
 * `(canceled)` even after later navigations move the floor past it.
 */
export function isPreservedUnknown(lifecycle: RequestLifecycle, anchor: SupersessionAnchor): boolean {
  if (lifecycle.completedAtMs != null) {
    if (!isCancellationAbort(lifecycle)) return false;
    return navStartedDuring(anchor.navStartsMs, lifecycle.startedAtMs, lifecycle.completedAtMs);
  }
  if (anchor.latestPageLoaderId && lifecycle.loaderId) {
    return lifecycle.loaderId !== anchor.latestPageLoaderId;
  }
  if (anchor.latestPageDocumentId && lifecycle.documentId) {
    return lifecycle.documentId !== anchor.latestPageDocumentId;
  }
  return anchor.latestNavStartedAtMs > 0 && lifecycle.startedAtMs < anchor.latestNavStartedAtMs;
}

/**
 * Whether genuine response data was observed on the current hop — a streamed
 * body byte (`lastActivityAtMs` / `bytesReceivedSoFar`, the per-chunk signals).
 * This is what confirms a preserved row's response: a preserved row that
 * streamed data keeps its real status and its frozen time (the host's
 * duration-wins precedence), while a preserved row with only a header-only
 * status or a navigation-abort artifact has no confirmed response and reads
 * `(unknown)` in both cells — mirroring the browser's renderer-coupled panel,
 * which never recorded the net-process-only status.
 */
export function hasObservedResponseData(lifecycle: RequestLifecycle): boolean {
  return lifecycle.lastActivityAtMs != null || lifecycle.bytesReceivedSoFar != null;
}

// ── Status-cell presentation ─────────────────────────────────────
//
// The status cell mirrors the browser's network panel one-to-one: a
// strict label cascade, a reason-phrase tooltip, a red row for genuine
// failures, and a dimmed cell for cache hits / no-status rows. There is
// no status-range colouring — the browser tints neither 2xx nor 3xx, so
// neither do we.

/** HTTP reason phrases for the status tooltip ("<code> <phrase>"). */
const REASON_PHRASE: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  103: 'Early Hints',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Content',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  511: 'Network Authentication Required',
};

/** Net-stack codes the browser treats as a cancellation, not a failure. */
const CANCELED_CODES: ReadonlySet<string> = new Set(['net::ERR_ABORTED', 'NS_ERROR_ABORT', 'NS_BINDING_ABORTED']);

/**
 * Whether a row's terminal event is a cancellation-abort — the net-stack
 * teardown a navigation triggers (and what an explicit user/JS cancel also
 * looks like). Used by {@link isPreservedUnknown} to let such a terminal fall
 * through to the supersession test instead of counting as a real outcome.
 */
function isCancellationAbort(lifecycle: RequestLifecycle): boolean {
  return lifecycle.error != null && CANCELED_CODES.has(lifecycle.error.code);
}

/**
 * Whether the row's terminal error is cancellation-shaped: a net-stack
 * cancel code, or the document-teardown failure (bare `ERR_FAILED` on a
 * frame hop that already carries a wire status). This is the `canceled`
 * signal the status cell reads — exported for the row-annotation
 * classifier, whose "transfer interrupted" fact is exactly this terminal
 * arriving alongside a successful response.
 */
export function isCancellationShapedTerminal(lifecycle: RequestLifecycle): boolean {
  return isCancellationAbort(lifecycle) || isDocumentTeardownFailure(lifecycle);
}

/**
 * Net-stack codes that map to a named `(blocked:<reason>)` label, using the
 * browser's own short vocabulary. These are the "the browser refused to send
 * / accept this for a policy reason" cases — the browser reports a block
 * reason for them, so it shows `(blocked:…)`, not `(failed)`.
 *
 * The browser's block-reason vocabulary has no value for an extension /
 * ad-block block, so those collapse to the catch-all `other` (an extension
 * block reads as `(blocked:other)`). `ERR_BLOCKED_BY_RESPONSE` (CORP / COEP /
 * ORB) and the generic `ERR_FAILED` likewise have no single named reason at
 * the wire layer, so they too map to `other`.
 *
 * Codes OUTSIDE this map are not blocks: a cancellation (`ERR_ABORTED`), a
 * TLS/cert error, a DNS failure, or any transport error carry no block
 * reason and read as `(failed)` / `(canceled)`, matching the browser.
 */
const BLOCKED_REASON_WORD: Record<string, string> = {
  'net::ERR_BLOCKED_BY_CSP': 'csp',
  'net::ERR_BLOCKED_BY_CLIENT': 'other',
  'net::ERR_BLOCKED_BY_RESPONSE': 'other',
  'net::ERR_BLOCKED_BY_XSS_AUDITOR': 'other',
  'net::ERR_BLOCKED_BY_ADMINISTRATOR': 'other',
  'net::ERR_FAILED': 'other',
};

interface StatusSignals {
  /** Authoritative HTTP code, or `undefined` when none was observed. */
  code: number | undefined;
  /** A wire attempt failed (net-stack error, failed phase, or negative code). */
  failed: boolean;
  /** The failure was a cancellation (navigated away / aborted). */
  canceled: boolean;
  /** A cross-origin check rejected the response. */
  cors: boolean;
  /** Named block reason, or `null` when this isn't a named block. */
  blockedWord: string | null;
  isDataUrl: boolean;
  /** Reached a terminal completed phase. */
  finished: boolean;
  /** Explicit status text (`OK`, `Not Found`, …) when the wire carried one. */
  statusText: string;
  /** Raw net-stack error token (`net::ERR_…`), or `null` when none. */
  errorCode: string | null;
}

/**
 * Whether a wire attempt failed — the browser's `request.failed`, set
 * independently of any HTTP status. A request can carry a real status code
 * (a `200` whose body download was aborted) and still be failed; the body
 * tabs key off this, not the displayed status, so a code-bearing failure
 * still degrades to its no-response state instead of waiting for a body that
 * never lands.
 */
export function isRequestFailed(lifecycle: RequestLifecycle): boolean {
  const rawNegative = typeof lifecycle.statusCode === 'number' && lifecycle.statusCode < 0;
  return lifecycle.phase === 'failed' || lifecycle.error != null || rawNegative;
}

function readStatusSignals(lifecycle: RequestLifecycle): StatusSignals {
  const err = lifecycle.error;
  const teardown = isDocumentTeardownFailure(lifecycle);
  return {
    code: effectiveStatusCode(lifecycle),
    failed: isRequestFailed(lifecycle),
    canceled: isCancellationShapedTerminal(lifecycle),
    cors: err?.code.startsWith('oh:cors') ?? false,
    // A correlator-supplied block reason (the CDP path names CORP/COEP/CSP/…
    // precisely) wins over the net-stack-code vocabulary, which collapses
    // those to `other`. Absent on the heuristic path, so its label is
    // unchanged. A document teardown is a cancel, never a block.
    blockedWord: err?.blockedReason ?? (err != null && !teardown ? (BLOCKED_REASON_WORD[err.code] ?? null) : null),
    isDataUrl: lifecycle.url.startsWith('data:'),
    finished: lifecycle.phase === 'completed',
    statusText: (lifecycle.statusText ?? currentHarEntry(lifecycle)?.response?.statusText ?? '').trim(),
    errorCode: err?.code ?? null,
  };
}

/** The inferred status text — explicit text when present, else the reason phrase. */
function inferredStatusText(s: StatusSignals): string {
  if (s.statusText) return s.statusText;
  return s.code != null ? (REASON_PHRASE[s.code] ?? '') : '';
}

/**
 * The status-cell label. Strict cascade, mirroring the browser:
 *
 *   (failed) → 4xx/5xx code → (data) → (canceled) → (blocked:reason)
 *   → CORS error → code → status text → Finished → (pending)
 *
 * A genuine wire failure wins over everything except a cancellation, a
 * named block, or a CORS rejection (which get their own labels). A real
 * HTTP code — including a cache hit's 2xx/3xx or a 304 — renders as the
 * bare number; the reason phrase rides in the tooltip, not a subtitle (our
 * table is compact, where the browser hides subtitles too).
 */
export function statusCellText(lifecycle: RequestLifecycle): string {
  const s = readStatusSignals(lifecycle);
  // Browser parity: the net-stack error rides inline next to "(failed)" (the
  // browser shows it as an always-visible subtitle, even in a compact table).
  if (s.failed && !s.canceled && !s.blockedWord && !s.cors) {
    return s.errorCode ? `(failed) ${s.errorCode}` : '(failed)';
  }
  if (s.code != null && s.code >= 400) return String(s.code);
  if (s.code == null && s.isDataUrl) return '(data)';
  if (s.code == null && s.canceled) return '(canceled)';
  if (s.blockedWord) return `(blocked:${s.blockedWord})`;
  if (s.cors) return 'CORS error';
  if (s.code != null) return String(s.code);
  if (s.statusText) return s.statusText;
  if (s.finished) return 'Finished';
  return '(pending)';
}

/**
 * The status-cell tooltip — `<code> <reason phrase>` for a real response, a
 * one-line failure / block description otherwise, and the label itself as a
 * last resort.
 */
export function statusCellTitle(lifecycle: RequestLifecycle): string {
  const s = readStatusSignals(lifecycle);
  const err = lifecycle.error;
  if (s.failed && !s.canceled && !s.blockedWord && !s.cors) {
    // The net-stack code is shown inline in the cell; the tooltip carries the
    // one-line explanation of what that failure means.
    return err ? lookupErrorCode(err.code).description : '(failed)';
  }
  if (s.code != null) return `${s.code} ${inferredStatusText(s)}`.trim();
  if (s.blockedWord && err) return lookupErrorCode(err.code).description;
  if (s.cors && err) return err.reason || lookupErrorCode(err.code).description;
  return statusCellText(lifecycle);
}

/**
 * The browser's red-row trigger: a wire failure with no HTTP status, any
 * 4xx/5xx, or a CORS rejection. (Cancellations are wire failures with no
 * status, so they read red too — the browser shows them red as well.)
 */
export function isFailedNetworkRequest(lifecycle: RequestLifecycle): boolean {
  const s = readStatusSignals(lifecycle);
  if (s.failed && s.code == null) return true;
  if (s.code != null && s.code >= 400) return true;
  return s.cors;
}

/**
 * Whether the status cell renders dim (grey): a cache hit, or any non-failed
 * row that has no HTTP status (pending / opaque). Mirrors the browser's
 * dim-cell rule — and unlike our old behaviour, it greys only the cell, not
 * the whole cached row.
 */
export function isDimStatusCell(lifecycle: RequestLifecycle): boolean {
  if (isFailedNetworkRequest(lifecycle)) return false;
  if (cacheSource(lifecycle) != null) return true;
  return effectiveStatusCode(lifecycle) == null;
}

/**
 * Stable CSS-class modifier for the row: red for a genuine failure, nothing
 * otherwise. Pending, cache hits, and redirects carry no row-level styling —
 * the browser scopes those cues to individual cells (the pending Status /
 * Time cells, the dimmed Size cell), never the whole row.
 */
export function rowStateClass(lifecycle: RequestLifecycle): string | null {
  return isFailedNetworkRequest(lifecycle) ? 'dt-row--error' : null;
}
