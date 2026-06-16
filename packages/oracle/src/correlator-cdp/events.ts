/**
 * Typed CDP Network-domain event variants — the subset the correlator
 * consumes.
 *
 * Field names match the CDP protocol verbatim (`requestId`,
 * `redirectResponse`, etc.). Types are deliberately permissive about
 * fields we don't read; we shape only what the lifecycle + the
 * synthesized HAR need.
 *
 * Source: https://chromedevtools.github.io/devtools-protocol/tot/Network/
 *
 * The plain-HTTP subset (the WS/SSE vocabulary is documented at its own
 * section below) — why these seven:
 *   - `requestWillBeSent` is the only request-start signal; its
 *     `redirectResponse` field carries the prior hop's response, which is
 *     how we reconstruct redirect chains under CDP without a separate
 *     `onBeforeRedirect` event.
 *   - `responseReceived` carries response headers / status — `phase:
 *     'headers-received'`.
 *   - `dataReceived` carries no lifecycle signal; its `dataLength` chunks
 *     sum to the decoded resource size the cooked events never report.
 *   - `loadingFinished` is the terminal success signal — `phase:
 *     'completed'`.
 *   - `loadingFailed` is the terminal failure signal — `phase:
 *     'failed'`.
 *   - `requestWillBeSentExtraInfo` / `responseReceivedExtraInfo` carry the
 *     *on-the-wire* header sets — the headers the browser actually added
 *     or blocked, which the cooked `requestWillBeSent`/`responseReceived`
 *     events omit (most visibly response `Set-Cookie`). They carry no
 *     timestamp and no lifecycle signal of their own — they only refine
 *     the HAR for an already-known hop, so the builder merges them and the
 *     lifecycle mapper drops them.
 *
 * The two ExtraInfo events have no hop index and no guaranteed order
 * relative to their base event. The builder pairs them to a hop by
 * ordinal (the k-th request-extra → hop k, the k-th response-extra →
 * hop k), which is order-tolerant and correct for single-hop requests and
 * redirect chains whose every hop carries extra info.
 *
 * Every event carries `sessionId` (B1): a tab attaches to its page
 * target, and out-of-process iframes / workers attach as flattened child
 * sessions whose `Network.*` events route by `sessionId`. CDP `requestId`
 * is unique only *within* a session, so the lifecycle identity key
 * becomes `(tabId, sessionId, requestId)`. Slice 0 carries the field on
 * the contract; routing-by-`sessionId` is wired with the chrome adapter
 * (Slice 2).
 */

import type { CdpHeaderEntry, CdpResponseBody } from './control-port';
import type { CdpPageEvent } from './page-events';

export interface CdpRequestParams {
  readonly url: string;
  readonly method: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly hasPostData?: boolean;
  /** Inline request body when CDP carries it (small text bodies) — HAR
   *  `request.postData.text`, the source for the panel's Payload tab.
   *  Absent for large/binary bodies (would need `getRequestPostData`). */
  readonly postData?: string;
  /** Scheduler priority assigned at request start (`VeryLow`…`VeryHigh`) —
   *  HAR `_priority`. The later `resourceChangedPriority` refinement is not
   *  tracked; this initial value is the always-present one. */
  readonly initialPriority?: string;
}

/**
 * `Network.ResourceTiming` — connection-level timing legs for one
 * response. All offsets are milliseconds relative to the monotonic
 * `requestTime` base (seconds); a `-1` offset means the leg did not
 * occur (e.g. a reused connection has `dnsStart === -1`). The HAR
 * `timings` object is reconstructed from these by `cdpTimingToHar`.
 */
export interface CdpResourceTiming {
  /** Monotonic base for every offset below, in seconds. */
  readonly requestTime: number;
  readonly proxyStart?: number;
  readonly proxyEnd?: number;
  readonly dnsStart?: number;
  readonly dnsEnd?: number;
  readonly connectStart?: number;
  readonly connectEnd?: number;
  readonly sslStart?: number;
  readonly sslEnd?: number;
  readonly sendStart?: number;
  readonly sendEnd?: number;
  readonly receiveHeadersStart?: number;
  readonly receiveHeadersEnd?: number;
  /** Service-worker timing legs (ms offsets; `-1` when not SW-handled) —
   *  forwarded verbatim as HAR `_worker*`. */
  readonly workerStart?: number;
  readonly workerReady?: number;
  readonly workerFetchStart?: number;
  readonly workerRespondWithSettled?: number;
}

export interface CdpResponseParams {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fromDiskCache?: boolean;
  readonly fromServiceWorker?: boolean;
  /** Remote peer address — HAR `serverIPAddress`. */
  readonly remoteIPAddress?: string;
  /** Remote peer port — HAR entry-level `connection` (stringified). */
  readonly remotePort?: number;
  /** Physical connection id; `0` means none — HAR `_connectionId`
   *  (stringified, omitted at `0`). */
  readonly connectionId?: number;
  /** Negotiated protocol (`h2`, `http/1.1`, …) — HAR `response.httpVersion`. */
  readonly protocol?: string;
  /** Resolved MIME type — HAR `response.content.mimeType`. */
  readonly mimeType?: string;
  /** Charset from the `Content-Type` header (e.g. `utf-8`) — decodes a
   *  streamed (raw-bytes) body fetched for a text MIME type. */
  readonly charset?: string;
  /** Connection-level timing legs — source for HAR `timings`. */
  readonly timing?: CdpResourceTiming;
  /** Bytes over the wire (headers + encoded body) — HAR `_transferSize`.
   *  Present on a redirect hop's `redirectResponse`; the final hop's
   *  transfer size arrives separately on `loadingFinished`. */
  readonly encodedDataLength?: number;
}

/**
 * One frame of a JS call stack — `Runtime.CallFrame`. Field names match
 * the protocol; the panel's initiator view consumes this shape verbatim
 * off the synthesized HAR entry's `_initiator`.
 */
export interface CdpCallFrame {
  readonly functionName: string;
  readonly scriptId: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

/**
 * A captured stack — `Runtime.StackTrace`. `parent` chains async stacks;
 * `description` labels an async boundary ("Promise.then", …).
 */
export interface CdpStackTrace {
  readonly description?: string;
  readonly callFrames: readonly CdpCallFrame[];
  readonly parent?: CdpStackTrace;
}

/**
 * Initiator surface — `Network.Initiator`. The lifecycle's
 * `initiator` field projects only `url` (the cross-request graph key),
 * but the full structure — including the V8 `stack` that named the call
 * site — is forwarded onto the synthesized HAR entry's `_initiator` so
 * the panel can render the exact initiator chain CDP alone provides.
 */
export interface CdpInitiator {
  readonly type: 'parser' | 'script' | 'preload' | 'SignedExchange' | 'preflight' | 'other';
  readonly url?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly stack?: CdpStackTrace;
}

/** `Network.requestWillBeSent` — request-start + redirect signal. */
export interface CdpRequestWillBeSent {
  readonly method: 'Network.requestWillBeSent';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly loaderId: string;
  readonly documentURL: string;
  readonly request: CdpRequestParams;
  /** Seconds since arbitrary epoch (CDP `MonotonicTime`). */
  readonly timestamp: number;
  /** Wall-clock seconds since UNIX epoch. */
  readonly wallTime: number;
  readonly initiator?: CdpInitiator;
  /**
   * Present iff this event represents the start of a redirect's NEXT
   * hop. Carries the just-completed hop's response. Use this to
   * synthesize the `redirect` update before the new hop's `started`.
   */
  readonly redirectResponse?: CdpResponseParams;
  readonly type?: string;
  /** Frame the request is issued for — absent for worker requests. */
  readonly frameId?: string;
}

/** `Network.responseReceived` — headers-received + initial status. */
export interface CdpResponseReceived {
  readonly method: 'Network.responseReceived';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly response: CdpResponseParams;
}

/**
 * `Network.dataReceived` — one chunk of decoded response body. CDP carries
 * no single decoded-size field; `dataLength` summed across these chunks is
 * the resource (uncompressed) size — HAR `response.content.size`, which the
 * panel's "resources" total and the Size-column decoded tooltip read.
 * `encodedDataLength` is the on-the-wire delta (the authoritative transfer
 * total still arrives on `loadingFinished`). Carries no lifecycle signal.
 */
export interface CdpDataReceived {
  readonly method: 'Network.dataReceived';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  /** Decoded (uncompressed) bytes in this chunk — summed into content size. */
  readonly dataLength: number;
  /** Encoded bytes over the wire in this chunk. */
  readonly encodedDataLength: number;
}

/** `Network.loadingFinished` — terminal success. */
export interface CdpLoadingFinished {
  readonly method: 'Network.loadingFinished';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly encodedDataLength: number;
}

/** `Network.loadingFailed` — terminal failure. */
export interface CdpLoadingFailed {
  readonly method: 'Network.loadingFailed';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  /** Chromium net-stack code, e.g. `net::ERR_FAILED`. */
  readonly errorText: string;
  readonly canceled?: boolean;
  readonly blockedReason?: string;
}

/**
 * `Network.requestWillBeSentExtraInfo` — the on-the-wire request headers
 * for a hop, including headers page JS never sees (the real `Cookie`
 * header, security headers the browser injects). Carries no timestamp.
 * Pairs to its hop by ordinal; supersedes the cooked `requestWillBeSent`
 * request headers for the same hop.
 */
export interface CdpRequestWillBeSentExtraInfo {
  readonly method: 'Network.requestWillBeSentExtraInfo';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * `Network.responseReceivedExtraInfo` — the on-the-wire response headers
 * for a hop, including the `Set-Cookie` header the cooked
 * `responseReceived` event omits. Carries no timestamp. Pairs to its hop
 * by ordinal; supersedes the cooked response headers for the same hop and
 * is the authoritative source for HAR response cookies.
 */
export interface CdpResponseReceivedExtraInfo {
  readonly method: 'Network.responseReceivedExtraInfo';
  readonly tabId: number;
  /** CDP session the event arrived on — page target or a flattened child (B1). */
  readonly sessionId: string;
  readonly requestId: string;
  readonly headers: Readonly<Record<string, string>>;
}

// ── WebSocket / EventSource vocabulary ────────────────────────────────
//
// A WebSocket has NO plain-Network lifecycle on the wire: `requestWillBeSent`
// / `responseReceived` / `loadingFinished` never fire for it (probe-verified,
// message-stream probe). The `webSocket*` events ARE the whole lifecycle:
// `webSocketCreated` (row mint; no timestamp of its own) →
// `webSocketWillSendHandshakeRequest` (the issue instant — the only WS event
// carrying the wall/monotonic pair) → `webSocketHandshakeResponseReceived`
// (status 101 + both directions' on-the-wire header text) → frames →
// `webSocketClosed` (the terminal — the host finishes the row here).
// `eventSourceMessageReceived` rides a NORMAL request lifecycle (an
// EventSource row has its ordinary requestWillBeSent/responseReceived) and
// only feeds the message stream.

/**
 * `Network.webSocketCreated` — WS row mint. Carries no timestamp at the
 * wire; `atWallMs` is the adapter's arrival stamp (same posture as
 * `Page.frameStoppedLoading`), refined conceptually by the handshake's
 * wall instant that follows within the same turn of the socket setup.
 * No `loaderId`/`frameId` exists for sockets — page binding falls to the
 * start-time floor, like worker rows.
 */
export interface CdpWebSocketCreated {
  readonly method: 'Network.webSocketCreated';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly url: string;
  readonly initiator?: CdpInitiator;
  /** Arrival wall-clock ms, stamped by the adapter (the event has no timestamp). */
  readonly atWallMs: number;
}

/**
 * `Network.webSocketWillSendHandshakeRequest` — the WS issue instant.
 * The only WS event carrying both clocks (`timestamp` + `wallTime`), so it
 * doubles as the wall-clock offset source for the socket's later
 * monotonic-only events (frames, close).
 */
export interface CdpWebSocketWillSendHandshakeRequest {
  readonly method: 'Network.webSocketWillSendHandshakeRequest';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly wallTime: number;
  /** The cooked handshake request headers. */
  readonly headers: Readonly<Record<string, string>>;
}

/** The handshake response payload — status + both directions' headers,
 *  including the raw wire text the host derives header sizes from. */
export interface CdpWebSocketHandshakeResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly headersText?: string;
  /** The on-the-wire request header set (supersedes the cooked set). */
  readonly requestHeaders?: Readonly<Record<string, string>>;
  readonly requestHeadersText?: string;
}

/** `Network.webSocketHandshakeResponseReceived` — status 101 + headers. */
export interface CdpWebSocketHandshakeResponseReceived {
  readonly method: 'Network.webSocketHandshakeResponseReceived';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly response: CdpWebSocketHandshakeResponse;
}

/** One WS frame — `payloadData` is text verbatim for opcode 1, base64 of
 *  the raw bytes for opcode 2. */
export interface CdpWebSocketFrame {
  readonly opcode: number;
  readonly mask: boolean;
  readonly payloadData: string;
}

/** `Network.webSocketFrameSent` — one client→server frame. */
export interface CdpWebSocketFrameSent {
  readonly method: 'Network.webSocketFrameSent';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly response: CdpWebSocketFrame;
}

/** `Network.webSocketFrameReceived` — one server→client frame. */
export interface CdpWebSocketFrameReceived {
  readonly method: 'Network.webSocketFrameReceived';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly response: CdpWebSocketFrame;
}

/** `Network.webSocketFrameError` — a transport-level frame error. The host
 *  stores it IN the frame list (`type: 'error'`, opcode −1); it does not
 *  terminate the request (`webSocketClosed` still follows). */
export interface CdpWebSocketFrameError {
  readonly method: 'Network.webSocketFrameError';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly errorMessage: string;
}

/** `Network.webSocketClosed` — the WS terminal; the host finishes the row here. */
export interface CdpWebSocketClosed {
  readonly method: 'Network.webSocketClosed';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
}

/**
 * `Network.eventSourceMessageReceived` — one parsed Server-Sent Event on an
 * ordinary EventSource request. `eventName` is `message` for default events;
 * multi-line `data:` fields arrive already joined with `\n`.
 */
export interface CdpEventSourceMessageReceived {
  readonly method: 'Network.eventSourceMessageReceived';
  readonly tabId: number;
  readonly sessionId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly eventName: string;
  readonly eventId: string;
  readonly data: string;
}

// ── Fetch-interception vocabulary (control-input, NOT observation) ────
//
// The Fetch domain raises TWO control-input event kinds, both carried on
// the same {@link subscribeFetch} channel and discriminated by `method`:
//
//   - `Fetch.requestPaused` — a request (or response) matched by an active
//     `Fetch.enable` pattern, suspended until answered through the
//     {@link CdpRequestControlPort} (continue / fulfill).
//   - `Fetch.authRequired` — the SECOND-stage challenge: when
//     `Fetch.enable { handleAuthRequests: true }` is active, an auth-needing
//     request fires this after `requestPaused`, awaiting a `continueWithAuth`
//     answer (provide credentials / default / cancel).
//
// Unlike the `Network.*` stream — which the correlator reduces into
// lifecycles — these events drive the request-control port in the host and
// never reach the correlator, so they ride their own {@link subscribeFetch}
// channel (sibling to `subscribePage`), keeping the observation plane clean.

/**
 * `Fetch.requestPaused` — one paused request/response awaiting a control
 * answer. `requestId` is the FETCH interception id (the handle every answer
 * command keys on), distinct from `networkId` (the
 * `Network.requestWillBeSent` id of the same request, which joins the pause
 * to the observed lifecycle).
 *
 * The same event shape carries BOTH interception stages, discriminated by
 * whether the response-stage fields are present:
 *   - Request stage — no `response*` fields. The request is paused before it
 *     leaves; answered with continue / fulfill.
 *   - Response stage — `responseStatusCode` (or `responseErrorReason`) set.
 *     Reached only for a request the host sent there with
 *     `continueRequest{interceptResponse:true}`; the real reply's status and
 *     headers are now observable, so a reaction can layer overrides onto them
 *     and answer with fulfill / continueResponse.
 */
export interface CdpRequestPaused {
  readonly method: 'Fetch.requestPaused';
  readonly tabId: number;
  /** Session the pause arrived on — page target or a flattened child. */
  readonly sessionId: string;
  /** Fetch interception id — the key for continue / fulfill / continueWithAuth. */
  readonly requestId: string;
  readonly request: CdpRequestParams;
  /** CDP resource type for the paused request (`Document`, `XHR`, `Image`, …). */
  readonly resourceType: string;
  /** Frame the request belongs to; absent for worker requests. */
  readonly frameId?: string;
  /** `Network.requestWillBeSent` id of the same request — lifecycle join key. */
  readonly networkId?: string;
  /** Real reply status — present iff this is the Response stage. */
  readonly responseStatusCode?: number;
  /** Real reply status phrase (`OK`, `Not Found`) — Response stage only. */
  readonly responseStatusText?: string;
  /** Real reply headers (multiplicity preserved) — Response stage only. */
  readonly responseHeaders?: readonly CdpHeaderEntry[];
  /** Set instead of a status when the real request failed at the network
   *  layer — there is no reply to fulfill from, so release it untouched. */
  readonly responseErrorReason?: string;
}

/**
 * The auth challenge a server (401) or proxy (407) presented —
 * `Fetch.AuthChallenge`. The host resolves credentials from the matching
 * auth rule and answers; with no match it replies `Default` so the browser
 * runs its native flow (never silently cancelling a challenge we don't own).
 */
export interface CdpAuthChallenge {
  readonly source: 'Server' | 'Proxy';
  readonly origin: string;
  readonly scheme: string;
  readonly realm: string;
}

/**
 * `Fetch.authRequired` — a request paused at the AUTH stage (Phase D3). The
 * server / proxy returned a challenge and `Fetch.enable { handleAuthRequests:
 * true }` routed it here for a {@link CdpRequestControlPort.continueWithAuth}
 * answer. `requestId` is the FETCH interception id (the key every answer
 * command uses), the same id space as {@link CdpRequestPaused.requestId}.
 */
export interface CdpAuthRequired {
  readonly method: 'Fetch.authRequired';
  readonly tabId: number;
  /** Session the challenge arrived on — page target or a flattened child. */
  readonly sessionId: string;
  /** Fetch interception id — the key for `continueWithAuth`. */
  readonly requestId: string;
  readonly request: CdpRequestParams;
  /** CDP resource type for the challenged request (`Document`, `XHR`, …). */
  readonly resourceType: string;
  /** Frame the request belongs to; absent for worker requests. */
  readonly frameId?: string;
  readonly authChallenge: CdpAuthChallenge;
}

/**
 * The Fetch-domain control-input event stream (Phase D onward). A union of
 * the request-stage pause and the auth-stage challenge, discriminated by
 * `method`; both ride the single {@link subscribeFetch} channel.
 */
export type CdpFetchEvent = CdpRequestPaused | CdpAuthRequired;

export type CdpNetworkEvent =
  | CdpRequestWillBeSent
  | CdpResponseReceived
  | CdpDataReceived
  | CdpLoadingFinished
  | CdpLoadingFailed
  | CdpRequestWillBeSentExtraInfo
  | CdpResponseReceivedExtraInfo
  | CdpWebSocketCreated
  | CdpWebSocketWillSendHandshakeRequest
  | CdpWebSocketHandshakeResponseReceived
  | CdpWebSocketFrameSent
  | CdpWebSocketFrameReceived
  | CdpWebSocketFrameError
  | CdpWebSocketClosed
  | CdpEventSourceMessageReceived;

/**
 * Store-facing request identity. CDP `requestId` is unique only *within*
 * a session, so a flattened child target (OOPIF / dedicated worker) can
 * reuse an id the page session also issued. Namespacing by `sessionId`
 * realizes the `(tabId, sessionId, requestId)` identity inside the
 * `(tabId, requestId)`-keyed store so page and child rows never collide.
 * Stable across a redirect chain — CDP reuses both `sessionId` and
 * `requestId` across hops, so the composite key is constant per hop.
 */
export function cdpStoreRequestId(sessionId: string, requestId: string): string {
  return `${sessionId}::${requestId}`;
}

/**
 * Result of `Network.streamResourceContent` — every byte received so far
 * for an in-flight request, as base64 of the raw bytes. Unlike
 * `getResponseBody` (which only serves finished requests), this works on a
 * request with no terminal event yet — including a request canceled
 * mid-stream, which never gets one and stays in-flight on the CDP plane.
 */
export interface CdpBufferedResponseBody {
  readonly bufferedData: string;
}

/**
 * The seam between the host-neutral correlator and the chrome bindings.
 * Tests inject an in-memory source; the extension SW injects a source
 * backed by `chrome.debugger` (Slice 2). No `chrome.*` reference crosses
 * into this package.
 *
 * `subscribe` is the push half — the `Network.*` event stream;
 * `subscribePage` is its sibling for the `Page.*` lifecycle stream (page
 * timings), kept separate so the request correlator's network subscription
 * is unaffected. The pull half is the body-fetch pair, commanded on demand
 * (Slice 8) when the panel asks for one — {@link fetchResponseBody} for a
 * finished request, {@link streamResponseBody} for one still in flight
 * (the browser's own Response tab branches on `finished` the same way; a
 * finished request's buffered body is only reachable via the first, an
 * in-flight one only via the second). Both take
 * `(tabId, sessionId, rawRequestId)` because a CDP `requestId` is unique
 * only within a session and the adapter routes the command on the matching
 * `chrome.debugger` session (root page target vs a flattened child). They
 * reject when the body is unavailable — the host evicted it, or the host
 * has no CDP transport at all (Firefox / Safari) — and the correlator
 * surfaces that as an empty body rather than a thrown error.
 */
export interface CdpEventSource {
  subscribe(listener: (event: CdpNetworkEvent) => void): () => void;
  /** The `Page.*` lifecycle stream — page-timing source, root target only. */
  subscribePage(listener: (event: CdpPageEvent) => void): () => void;
  /**
   * The `Fetch.*` control-input stream — paused requests awaiting a control
   * answer (Phase D). Consumed by the host's pause handler, not the
   * correlator; sibling to {@link subscribePage}, never folded into the
   * `Network.*` observation stream.
   */
  subscribeFetch(listener: (event: CdpFetchEvent) => void): () => void;
  fetchResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpResponseBody>;
  streamResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpBufferedResponseBody>;
}
