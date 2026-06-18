/**
 * Typed webRequest-shaped event variants — the subset the heuristic
 * correlator consumes (H1). Six events, no per-chunk data event: webRequest
 * exposes no `dataReceived`-style progress, so an in-flight row holds at
 * pending (no measurable duration) until its terminal event, rather than
 * faking growth from a single first-byte signal.
 *
 * Field names match `chrome.webRequest.*` verbatim (`requestId`,
 * `tabId`, `timeStamp`, `statusCode`, `redirectUrl`, `initiator`), but
 * the types here are plain TypeScript with **no `chrome.*` reference**.
 * The chrome binding lives in the extension SW's
 * `ChromeWebRequestEventSource` adapter, which normalizes
 * `WebRequestDetails`-flavoured callback arguments into these shapes
 * and feeds them through `WebRequestEventSource.subscribe`.
 *
 * Why six events:
 *   - `onBeforeRequest` — request-start signal; `phase: 'pending'`.
 *   - `onSendHeaders` — request headers as they leave for the wire; the
 *     mapper projects them onto the lifecycle (provisional until the
 *     response confirms the exchange) so an in-flight row shows its
 *     request headers before the response-gated HAR lands. CORS
 *     classification (H5) reads the same event in the correlator.
 *   - `onHeadersReceived` — response headers + initial status — `phase:
 *     'headers-received'`; also confirms the request crossed the wire,
 *     dropping the provisional flag on the captured request headers.
 *   - `onBeforeRedirect` — 3xx + `Location`; produces a `redirect`
 *     update and resets `phase` to `pending` on the next hop.
 *   - `onCompleted` — terminal success — `phase: 'completed'`.
 *   - `onErrorOccurred` — terminal failure — `phase: 'failed'`.
 *
 * `timeStamp` is wall-clock milliseconds (matches webRequest); the
 * mapper passes it through without conversion.
 */

/** Common identity carried by every event in a request's life. */
interface WebRequestEventBase {
  readonly tabId: number;
  readonly requestId: string;
  readonly url: string;
  readonly method: string;
  /** Wall-clock ms since UNIX epoch. */
  readonly timeStamp: number;
  /** webRequest `type`: `'main_frame'`, `'xmlhttprequest'`, etc. */
  readonly type: string;
  /** Top-level frame origin / extension origin / undefined. */
  readonly initiator?: string;
  /** webRequest `frameId`; carried through for downstream consumers that need it. */
  readonly frameId?: number;
  /**
   * webRequest `documentId` — UUID of the document making the request.
   * Chromium 106+ only; absent on Firefox and on navigation requests
   * (the target document does not exist yet at `onBeforeRequest`).
   */
  readonly documentId?: string;
  /** webRequest `frameType`: `'outermost_frame'`, `'sub_frame'`, `'fenced_frame'`. Chromium 106+. */
  readonly frameType?: string;
}

/** Single name-value response or request header pair. */
export interface WebRequestHeader {
  readonly name: string;
  readonly value?: string;
}

/** `chrome.webRequest.onBeforeRequest`. */
export interface OnBeforeRequestEvent extends WebRequestEventBase {
  readonly method_kind: 'onBeforeRequest';
}

/** `chrome.webRequest.onSendHeaders`. */
export interface OnSendHeadersEvent extends WebRequestEventBase {
  readonly method_kind: 'onSendHeaders';
  readonly requestHeaders?: readonly WebRequestHeader[];
}

/** `chrome.webRequest.onHeadersReceived`. */
export interface OnHeadersReceivedEvent extends WebRequestEventBase {
  readonly method_kind: 'onHeadersReceived';
  readonly statusCode: number;
  readonly statusLine?: string;
  readonly responseHeaders?: readonly WebRequestHeader[];
  readonly fromCache?: boolean;
}

/** `chrome.webRequest.onBeforeRedirect`. */
export interface OnBeforeRedirectEvent extends WebRequestEventBase {
  readonly method_kind: 'onBeforeRedirect';
  readonly statusCode: number;
  readonly redirectUrl: string;
  readonly responseHeaders?: readonly WebRequestHeader[];
  readonly fromCache?: boolean;
  /** Server IP the hop was sent to — HAR `serverIPAddress` for the hop. */
  readonly ip?: string;
  /**
   * Set only on the SYNTHETIC redirect the correlator emits for a DNR
   * in-place URL rewrite (webRequest fires no real `onBeforeRedirect` for
   * it). Marks the resulting hop as an Open Headers internal redirect.
   */
  readonly internal?: boolean;
}

/** `chrome.webRequest.onCompleted`. */
export interface OnCompletedEvent extends WebRequestEventBase {
  readonly method_kind: 'onCompleted';
  readonly statusCode: number;
  readonly statusLine?: string;
  readonly fromCache?: boolean;
  /** Server IP the request was sent to — HAR `serverIPAddress`. */
  readonly ip?: string;
}

/** `chrome.webRequest.onErrorOccurred`. */
export interface OnErrorOccurredEvent extends WebRequestEventBase {
  readonly method_kind: 'onErrorOccurred';
  /** Chromium net-stack code, e.g. `'net::ERR_FAILED'`. */
  readonly error: string;
  readonly fromCache?: boolean;
  /** Server IP the request was sent to — HAR `serverIPAddress`. */
  readonly ip?: string;
}

export type WebRequestEvent =
  | OnBeforeRequestEvent
  | OnSendHeadersEvent
  | OnHeadersReceivedEvent
  | OnBeforeRedirectEvent
  | OnCompletedEvent
  | OnErrorOccurredEvent;

/**
 * Host-side event source. The extension SW supplies a chrome-bound
 * implementation; tests supply an in-memory one. Oracle code only ever
 * sees this seam — invariant 7 is enforced because the chrome listeners
 * are owned by exactly one adapter, one layer out.
 */
export interface WebRequestEventSource {
  subscribe(listener: (event: WebRequestEvent) => void): () => void;
}
