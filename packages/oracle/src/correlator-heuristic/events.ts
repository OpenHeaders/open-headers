/**
 * Typed webRequest-shaped event variants — the subset the heuristic
 * correlator consumes (H1).
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
 *   - `onSendHeaders` — request headers just before flush. H1 consumes
 *     it only to assert ordering / invariant 7; CORS classification
 *     (H5) and request-header capture (later) attach here.
 *   - `onHeadersReceived` — response headers + initial status — `phase:
 *     'headers-received'`.
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
}

/** `chrome.webRequest.onCompleted`. */
export interface OnCompletedEvent extends WebRequestEventBase {
  readonly method_kind: 'onCompleted';
  readonly statusCode: number;
  readonly statusLine?: string;
  readonly fromCache?: boolean;
}

/** `chrome.webRequest.onErrorOccurred`. */
export interface OnErrorOccurredEvent extends WebRequestEventBase {
  readonly method_kind: 'onErrorOccurred';
  /** Chromium net-stack code, e.g. `'net::ERR_FAILED'`. */
  readonly error: string;
  readonly fromCache?: boolean;
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
