/**
 * Raw CDP protocol payloads — `chrome.debugger.onEvent` hands params as a bare
 * `object`; these interfaces shape the subset the adapter reads so the
 * normalizers stay field-checked. Field names are CDP-verbatim. Pure shapes
 * (no oracle types), consumed by both the adapter (casts) and the normalizers.
 */

export interface RawRequest {
  readonly url: string;
  readonly method: string;
  readonly headers?: Record<string, string>;
  readonly hasPostData?: boolean;
  readonly postData?: string;
  readonly initialPriority?: string;
}

export interface RawResourceTiming {
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
  readonly workerStart?: number;
  readonly workerReady?: number;
  readonly workerFetchStart?: number;
  readonly workerRespondWithSettled?: number;
}

export interface RawResponse {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers?: Record<string, string>;
  readonly mimeType?: string;
  readonly charset?: string;
  readonly remoteIPAddress?: string;
  readonly remotePort?: number;
  readonly connectionId?: number;
  readonly protocol?: string;
  readonly fromDiskCache?: boolean;
  readonly fromServiceWorker?: boolean;
  readonly encodedDataLength?: number;
  readonly timing?: RawResourceTiming;
}

export interface RawCallFrame {
  readonly functionName: string;
  readonly scriptId: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

export interface RawStackTrace {
  readonly description?: string;
  readonly callFrames: readonly RawCallFrame[];
  readonly parent?: RawStackTrace;
}

export interface RawInitiator {
  readonly type: string;
  readonly url?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly stack?: RawStackTrace;
}

export interface RawRequestWillBeSent {
  readonly requestId: string;
  readonly loaderId: string;
  readonly documentURL: string;
  readonly request: RawRequest;
  readonly timestamp: number;
  readonly wallTime: number;
  readonly initiator?: RawInitiator;
  readonly redirectResponse?: RawResponse;
  readonly type?: string;
  readonly frameId?: string;
}

export interface RawResponseReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly response: RawResponse;
}

export interface RawDataReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly dataLength: number;
  readonly encodedDataLength: number;
}

export interface RawLoadingFinished {
  readonly requestId: string;
  readonly timestamp: number;
  readonly encodedDataLength: number;
}

export interface RawLoadingFailed {
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly errorText: string;
  readonly canceled?: boolean;
  readonly blockedReason?: string;
}

export interface RawRequestWillBeSentExtraInfo {
  readonly requestId: string;
  readonly headers: Record<string, string>;
}

export interface RawWebSocketCreated {
  readonly requestId: string;
  readonly url: string;
  readonly initiator?: RawInitiator;
}

export interface RawWebSocketWillSendHandshakeRequest {
  readonly requestId: string;
  readonly timestamp: number;
  readonly wallTime: number;
  readonly request: { readonly headers: Record<string, string> };
}

export interface RawWebSocketHandshakeResponseReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly response: {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Record<string, string>;
    readonly headersText?: string;
    readonly requestHeaders?: Record<string, string>;
    readonly requestHeadersText?: string;
  };
}

export interface RawWebSocketFrameEvent {
  readonly requestId: string;
  readonly timestamp: number;
  readonly response: {
    readonly opcode: number;
    readonly mask: boolean;
    readonly payloadData: string;
  };
}

export interface RawWebSocketFrameError {
  readonly requestId: string;
  readonly timestamp: number;
  readonly errorMessage: string;
}

export interface RawWebSocketClosed {
  readonly requestId: string;
  readonly timestamp: number;
}

export interface RawEventSourceMessageReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly eventName: string;
  readonly eventId: string;
  readonly data: string;
}

export interface RawResponseReceivedExtraInfo {
  readonly requestId: string;
  readonly headers: Record<string, string>;
}

export interface RawRequestPaused {
  readonly requestId: string;
  readonly request: RawRequest;
  readonly frameId?: string;
  readonly resourceType: string;
  readonly networkId?: string;
  readonly responseStatusCode?: number;
  readonly responseStatusText?: string;
  readonly responseHeaders?: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  readonly responseErrorReason?: string;
}

export interface RawAuthChallenge {
  readonly source?: 'Server' | 'Proxy';
  readonly origin: string;
  readonly scheme: string;
  readonly realm: string;
}

export interface RawAuthRequired {
  readonly requestId: string;
  readonly request: RawRequest;
  readonly frameId?: string;
  readonly resourceType: string;
  readonly authChallenge: RawAuthChallenge;
}

/** `Runtime.bindingCalled` — `payload` is the wrapper's JSON.stringify of
 *  `{ruleUid,url,kind,t}`; `name` discriminates which addBinding fired. */
export interface RawBindingCalled {
  readonly name: string;
  readonly payload: string;
  readonly executionContextId?: number;
}

/**
 * `Runtime.RemoteObject` (subset) — a console arg / thrown value. Primitives
 * carry `value`; non-primitives carry `description` (+ an inline `preview`).
 * `value` is a JSON value, hence `unknown`. Phase G renders text from these
 * inline fields only — no `Runtime.getProperties` round-trip in v1.
 */
export interface RawRemoteObject {
  readonly type: string;
  readonly subtype?: string;
  readonly className?: string;
  readonly value?: unknown;
  readonly unserializableValue?: string;
  readonly description?: string;
  readonly preview?: RawObjectPreview;
}

/** `Runtime.PropertyPreview` (subset) — one member of an inline preview. */
export interface RawPropertyPreview {
  readonly name: string;
  readonly type: string;
  readonly subtype?: string;
  readonly value?: string;
  readonly valuePreview?: RawObjectPreview;
}

/** `Runtime.ObjectPreview` (subset) — the inline shallow render of an object
 *  or array. `overflow` flags that members were truncated. */
export interface RawObjectPreview {
  readonly type: string;
  readonly subtype?: string;
  readonly description?: string;
  readonly overflow: boolean;
  readonly properties: readonly RawPropertyPreview[];
}

/** `Runtime.consoleAPICalled` — a `console.*` call. `type` is the call kind
 *  (`log`/`warning`/`error`/…); `timestamp` is wall-clock ms. */
export interface RawConsoleApiCalled {
  readonly type: string;
  readonly args: readonly RawRemoteObject[];
  readonly timestamp: number;
  readonly executionContextId?: number;
  readonly stackTrace?: RawStackTrace;
}

/** `Runtime.ExceptionDetails` (subset) — the body of an uncaught error /
 *  unhandled rejection. `exception` is the thrown value; `text` is the
 *  fallback label (`Uncaught` / `Uncaught (in promise)`). */
export interface RawExceptionDetails {
  readonly text: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
  readonly url?: string;
  readonly exception?: RawRemoteObject;
  readonly stackTrace?: RawStackTrace;
  readonly executionContextId?: number;
}

/** `Runtime.ExecutionContextDescription` — one live JS context on a session.
 *  `auxData` carries the frame binding, main-world flag, and world type
 *  (`default` / `isolated` / `worker`). */
export interface RawExecutionContextDescription {
  readonly id: number;
  readonly origin: string;
  readonly name: string;
  readonly auxData?: {
    readonly frameId?: string;
    readonly isDefault?: boolean;
    readonly type?: string;
  };
}

/** `Runtime.executionContextCreated` — a context came alive (also replayed
 *  for every already-live context when Runtime is enabled). */
export interface RawExecutionContextCreated {
  readonly context: RawExecutionContextDescription;
}

/** `Runtime.executionContextDestroyed` — a context died. `executionContextId`
 *  is the session-scoped numeric id. */
export interface RawExecutionContextDestroyed {
  readonly executionContextId: number;
}

/** `Runtime.exceptionThrown` — an uncaught error or unhandled rejection. */
export interface RawExceptionThrown {
  readonly timestamp: number;
  readonly exceptionDetails: RawExceptionDetails;
}

/**
 * `Log.LogEntry` (subset) — one browser-generated console message
 * (failed/blocked network request, deprecation, violation, …). `source` is
 * the browser's category label; `level` is `verbose`/`info`/`warning`/
 * `error`; `timestamp` is wall-clock ms. `url`/`lineNumber` locate the
 * resource the entry is about; `stackTrace`, when present, points at the
 * initiating code. `args`, when present, supplement the rendered `text`.
 */
export interface RawLogEntry {
  readonly source: string;
  readonly level: string;
  readonly text: string;
  readonly timestamp: number;
  readonly url?: string;
  readonly lineNumber?: number;
  readonly stackTrace?: RawStackTrace;
  /** Session-scoped CDP request id, present on `network`-source entries. */
  readonly networkRequestId?: string;
  readonly args?: readonly RawRemoteObject[];
}

/** `Log.entryAdded` — a browser-generated log entry. */
export interface RawLogEntryAdded {
  readonly entry: RawLogEntry;
}

/** `Network.getResponseBody` result — body text + whether it is base64. */
export interface RawGetResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/** `Network.streamResourceContent` result — bytes received so far, base64. */
export interface RawStreamResourceContent {
  readonly bufferedData: string;
}

/** `Page.getFrameTree` result — only the root frame's id is consumed. */
export interface RawGetFrameTree {
  readonly frameTree?: {
    readonly frame?: { readonly id?: string };
  };
}

export interface RawTargetInfo {
  readonly type: string;
  readonly targetId: string;
  readonly title?: string;
  readonly url?: string;
  readonly attached?: boolean;
}

export interface RawAttachedToTarget {
  readonly sessionId: string;
  readonly targetInfo: RawTargetInfo;
  readonly waitingForDebugger?: boolean;
}

export interface RawDetachedFromTarget {
  readonly sessionId: string;
  readonly targetId?: string;
}

export interface RawPageFrame {
  readonly id: string;
  readonly parentId?: string;
  readonly loaderId: string;
  readonly url: string;
}

export interface RawFrameNavigated {
  readonly frame: RawPageFrame;
}

export interface RawPageLifecycleTimestamp {
  readonly timestamp: number;
}

export interface RawFrameStoppedLoading {
  readonly frameId: string;
}

/** `Storage.indexedDB*Updated` / `Storage.cacheStorage*Updated` — the
 *  shared fields the storage inspector consumes from either tracking
 *  event family. */
export interface RawStorageUpdated {
  readonly origin: string;
  readonly storageKey: string;
}
