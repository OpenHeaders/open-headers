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
 * Why these seven:
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

export type CdpNetworkEvent =
  | CdpRequestWillBeSent
  | CdpResponseReceived
  | CdpDataReceived
  | CdpLoadingFinished
  | CdpLoadingFailed
  | CdpRequestWillBeSentExtraInfo
  | CdpResponseReceivedExtraInfo;

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

/** Result of `Network.getResponseBody` — body text + its encoding flag. */
export interface CdpResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/**
 * The seam between the host-neutral correlator and the chrome bindings.
 * Tests inject an in-memory source; the extension SW injects a source
 * backed by `chrome.debugger` (Slice 2). No `chrome.*` reference crosses
 * into this package.
 *
 * `subscribe` is the push half — the `Network.*` event stream. The lone
 * pull half is {@link fetchResponseBody}: the correlator commands a body
 * fetch on demand (Slice 8) when the panel asks for one. The seam takes
 * `(tabId, sessionId, rawRequestId)` because a CDP `requestId` is unique
 * only within a session and the adapter routes the command on the matching
 * `chrome.debugger` session (root page target vs a flattened child). It
 * rejects when the body is unavailable — the host evicted it, or the host
 * has no CDP transport at all (Firefox / Safari) — and the correlator
 * surfaces that as an empty body rather than a thrown error.
 */
export interface CdpEventSource {
  subscribe(listener: (event: CdpNetworkEvent) => void): () => void;
  fetchResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpResponseBody>;
}
