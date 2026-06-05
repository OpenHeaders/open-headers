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
 * Why these four:
 *   - `requestWillBeSent` is the only request-start signal; its
 *     `redirectResponse` field carries the prior hop's response, which is
 *     how we reconstruct redirect chains under CDP without a separate
 *     `onBeforeRedirect` event.
 *   - `responseReceived` carries response headers / status — `phase:
 *     'headers-received'`.
 *   - `loadingFinished` is the terminal success signal — `phase:
 *     'completed'`.
 *   - `loadingFailed` is the terminal failure signal — `phase:
 *     'failed'`.
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
 * Initiator surface — we project a single string for
 * `RequestLifecycle.initiator`. Real CDP carries a richer structure;
 * keep the shape small so tests don't have to mock the full union.
 */
export interface CdpInitiator {
  readonly type: 'parser' | 'script' | 'preload' | 'SignedExchange' | 'preflight' | 'other';
  readonly url?: string;
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

export type CdpNetworkEvent = CdpRequestWillBeSent | CdpResponseReceived | CdpLoadingFinished | CdpLoadingFailed;

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
 * The seam between the host-neutral correlator and the chrome bindings.
 * Tests inject an in-memory source; the extension SW injects a source
 * backed by `chrome.debugger.onEvent` (Slice 2). No `chrome.*` reference
 * crosses into this package.
 */
export interface CdpEventSource {
  subscribe(listener: (event: CdpNetworkEvent) => void): () => void;
}
