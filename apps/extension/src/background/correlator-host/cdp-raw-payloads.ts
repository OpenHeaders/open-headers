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
