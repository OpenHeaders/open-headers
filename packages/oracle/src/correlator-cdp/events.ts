/**
 * Typed CDP Network-domain event variants — the subset the stub
 * correlator consumes (K1).
 *
 * Field names match the CDP protocol verbatim (`requestId`,
 * `redirectResponse`, etc.). Types are deliberately permissive about
 * fields we don't read; we shape only what the lifecycle needs.
 *
 * Source: https://chromedevtools.github.io/devtools-protocol/tot/Network/
 *
 * Why these four:
 *   - `requestWillBeSent` is the only request-start signal; its
 *     `redirectResponse` field carries the prior hop's status, which is
 *     how we reconstruct redirect chains under CDP without a separate
 *     `onBeforeRedirect` event.
 *   - `responseReceived` carries response headers / status — `phase:
 *     'headers-received'`.
 *   - `loadingFinished` is the terminal success signal — `phase:
 *     'completed'`.
 *   - `loadingFailed` is the terminal failure signal — `phase:
 *     'failed'`.
 */

export interface CdpRequestParams {
  readonly url: string;
  readonly method: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly hasPostData?: boolean;
}

export interface CdpResponseParams {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fromDiskCache?: boolean;
  readonly fromServiceWorker?: boolean;
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
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly response: CdpResponseParams;
}

/** `Network.loadingFinished` — terminal success. */
export interface CdpLoadingFinished {
  readonly method: 'Network.loadingFinished';
  readonly tabId: number;
  readonly requestId: string;
  readonly timestamp: number;
  readonly encodedDataLength: number;
}

/** `Network.loadingFailed` — terminal failure. */
export interface CdpLoadingFailed {
  readonly method: 'Network.loadingFailed';
  readonly tabId: number;
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  /** Chromium net-stack code, e.g. `net::ERR_FAILED`. */
  readonly errorText: string;
  readonly canceled?: boolean;
  readonly blockedReason?: string;
}

export type CdpNetworkEvent =
  | CdpRequestWillBeSent
  | CdpResponseReceived
  | CdpLoadingFinished
  | CdpLoadingFailed;

/**
 * Test-side event source. The real Chrome wiring would attach
 * `chrome.debugger.onEvent` here; the stub forbids that path
 * (K4 — NotImplementedError thrown if instantiated against real Chrome).
 */
export interface CdpEventSource {
  subscribe(listener: (event: CdpNetworkEvent) => void): () => void;
}
