/**
 * Chrome adapter implementing the oracle's {@link CdpEventSource} seam,
 * backed by `chrome.debugger`. The only place in the codebase that names
 * `chrome.debugger.*` — the oracle CDP correlator stays chrome-free and
 * consumes the normalized {@link CdpNetworkEvent} stream this produces.
 *
 * Three surfaces:
 *   - {@link subscribe} — the `CdpEventSource` seam: fan normalized
 *     `CdpNetworkEvent`s to the correlator.
 *   - {@link attach} / {@link detach} — the SW reconciler (Slice 4) drives
 *     these; they own the `chrome.debugger.attach` → `Network.enable` →
 *     `Target.setAutoAttach{flatten}` handshake and its teardown.
 *   - {@link onDetach} — surfaces `chrome.debugger.onDetach` so the
 *     reconciler can route a tab back to the heuristic path (banner
 *     Cancel, tab close, …).
 *
 * B1 — child-target coverage. `chrome.debugger.attach({tabId})` only
 * attaches the tab's page target; out-of-process iframes and dedicated
 * workers are separate targets whose `Network.*` traffic never reaches
 * the page session. `Target.setAutoAttach{flatten:true}` attaches them as
 * flattened child sessions; we `Network.enable` each kept child and route
 * every event by its `sessionId`. Without this, CDP undercounts vs the
 * heuristic on any cross-origin-iframe site.
 *
 * Identity. CDP `requestId` is unique only within a session, so each
 * emitted event carries the `sessionId` it arrived on (the page session
 * for the root, the child's id for a flattened child). The oracle folds
 * `sessionId` into the store key — see `cdpStoreRequestId`.
 *
 * Inert when `chrome.debugger` is absent (Firefox / Safari): construction
 * logs and no-ops, attach/detach resolve immediately, no events fan.
 *
 * Cross-browser: uses `getBrowserAPI()` (Firefox `browser` / Chrome
 * `chrome`); the namespace is simply undefined on non-Chromium hosts.
 */

import type {
  CdpBufferedResponseBody,
  CdpCallFrame,
  CdpEventSource,
  CdpInitiator,
  CdpNetworkEvent,
  CdpPageEvent,
  CdpPageFrame,
  CdpRequestParams,
  CdpResourceTiming,
  CdpResponseBody,
  CdpResponseParams,
  CdpStackTrace,
} from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import { type BrowserAPI, getBrowserAPI } from '@/types/browser';
import { clearMainFrameId, setMainFrameId } from './main-frame-registry';

type Listener = (event: CdpNetworkEvent) => void;
type PageListener = (event: CdpPageEvent) => void;
type DetachListener = (tabId: number, reason: string) => void;
type DebuggerApi = BrowserAPI['debugger'];

/** Protocol version handed to `chrome.debugger.attach`. */
const CDP_PROTOCOL_VERSION = '1.3';

/**
 * `Network.enable` buffer sizes, matched to the browser's own DevTools
 * session so body retention behaves identically: the backend buffers
 * response bodies (served later by `getResponseBody` /
 * `streamResourceContent`) only up to these limits, and the bare-enable
 * defaults are smaller — bodies the browser's panel can still show would
 * read as evicted here.
 */
const MAX_RESPONSE_BODY_TOTAL_BUFFER_BYTES = 250 * 1024 * 1024;
const MAX_EAGER_POST_BODY_BYTES = 64 * 1024;

/**
 * Synthetic session id stamped on root (page-target) events. The
 * `chrome.debugger` root session has no id of its own — events arrive
 * with `source.sessionId === undefined` — so we name it explicitly to
 * keep the `(tabId, sessionId, requestId)` identity uniform. `tabId`
 * already namespaces across tabs; a chrome-issued child session id is a
 * long opaque string and never collides with this literal.
 */
const ROOT_SESSION_ID = 'page';

/**
 * Child target types we auto-attach to (B1 product call). The parity
 * goal is 1-to-1 with Chrome's own page Network tab, which under a
 * per-tab attach equals the heuristic's `webRequest` coverage:
 *
 *   - `iframe` — out-of-process iframes. The headline B1 gap; their
 *     traffic never flows through the page session.
 *   - `worker` — dedicated workers. `webRequest` attributes their fetches
 *     to the owning page's `tabId`, and Chrome's page Network tab shows
 *     them, so excluding them would undercount.
 *
 * Excluded: `service_worker` / `shared_worker`. `webRequest` reports them
 * with `tabId === -1` (dropped by the heuristic), and Chrome surfaces
 * them in a *separate* DevTools instance, not the page tab — attaching
 * would invert parity the other way and surface cross-page traffic the
 * user never saw. They are also not reachable from a per-tab attach (they
 * are browser-scoped targets, not children of the tab target); full
 * coverage would require a browser-level debuggee, deferred out of this
 * epic.
 */
const ATTACHABLE_CHILD_TARGET_TYPES: ReadonlySet<string> = new Set(['iframe', 'worker']);

export class ChromeDebuggerEventSource implements CdpEventSource {
  private readonly listeners = new Set<Listener>();
  private readonly pageListeners = new Set<PageListener>();
  private readonly detachListeners = new Set<DetachListener>();
  /** Root (page-target) tabs we hold a `chrome.debugger` attachment for. */
  private readonly attachedTabs = new Set<number>();
  /** Flattened child sessions we kept and enabled `Network` on → owning root tab. */
  private readonly childSessions = new Map<string, number>();
  private readonly removeListeners: Array<() => void> = [];

  constructor() {
    this.install();
  }

  /** `CdpEventSource` seam — fan normalized `Network.*` events to the correlator. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** `CdpEventSource` seam — fan normalized `Page.*` events (page-timing source). */
  subscribePage(listener: PageListener): () => void {
    this.pageListeners.add(listener);
    return () => {
      this.pageListeners.delete(listener);
    };
  }

  /**
   * `CdpEventSource` pull seam — fetch one hop's response body on demand
   * (Slice 8). Routes `Network.getResponseBody` on the matching session:
   * the root page target carries the synthetic {@link ROOT_SESSION_ID}, so
   * it maps to a bare `{tabId}` debuggee; a flattened child carries its
   * real session id. Rejects on an absent transport (Firefox / Safari), a
   * malformed result, or the host having dropped the body ("no resource
   * with given identifier" once the renderer evicts it) — the correlator
   * turns any rejection into an empty body, so the panel shows the
   * "unavailable" copy rather than spinning.
   */
  async fetchResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpResponseBody> {
    const api = this.api();
    if (!api) throw new Error('CDP transport unavailable');
    const session = this.sessionFor(tabId, sessionId);
    const result = await api.sendCommand(session, 'Network.getResponseBody', { requestId: rawRequestId });
    const raw = result as RawGetResponseBody | undefined;
    if (typeof raw?.body !== 'string' || typeof raw.base64Encoded !== 'boolean') {
      throw new Error('Network.getResponseBody returned an unexpected shape');
    }
    return { body: raw.body, base64Encoded: raw.base64Encoded };
  }

  /**
   * `CdpEventSource` pull seam — the in-flight sibling of
   * {@link fetchResponseBody}. `Network.streamResourceContent` returns the
   * bytes received so far for a request with no terminal event (base64 of
   * raw bytes), the only command that serves one — including a request
   * canceled mid-stream, which never gets a terminal. Rejects on an absent
   * transport, an already-finished request, or a malformed result; the
   * correlator turns any rejection into an empty body.
   */
  async streamResponseBody(tabId: number, sessionId: string, rawRequestId: string): Promise<CdpBufferedResponseBody> {
    const api = this.api();
    if (!api) throw new Error('CDP transport unavailable');
    const session = this.sessionFor(tabId, sessionId);
    const result = await api.sendCommand(session, 'Network.streamResourceContent', { requestId: rawRequestId });
    const raw = result as RawStreamResourceContent | undefined;
    if (typeof raw?.bufferedData !== 'string') {
      throw new Error('Network.streamResourceContent returned an unexpected shape');
    }
    return { bufferedData: raw.bufferedData };
  }

  /** Map the synthetic root session id onto a bare `{tabId}` debuggee. */
  private sessionFor(tabId: number, sessionId: string): chrome.debugger.DebuggerSession {
    return sessionId === ROOT_SESSION_ID ? { tabId } : { tabId, sessionId };
  }

  /**
   * Register a detach observer (Slice 4 wires the reconciler here).
   * Fired on `chrome.debugger.onDetach` — `reason` is the chrome string
   * (`target_closed`, `canceled_by_user`, `replaced_with_devtools`, …).
   */
  onDetach(listener: DetachListener): () => void {
    this.detachListeners.add(listener);
    return () => {
      this.detachListeners.delete(listener);
    };
  }

  /**
   * Attach CDP to a tab's page target and turn on flattened auto-attach
   * for its child targets. Idempotent — a second attach for a live tab is
   * a no-op — and tolerant of an "already attached" race (a coexisting
   * DevTools front-end, or a re-attach after SW wake).
   *
   * Rejects on a real attach failure (anything other than the
   * already-attached race) so the reconciler leaves the tab
   * heuristic-owned and surfaces the fault — it must not mark a tab
   * CDP-owned when no session was established.
   */
  async attach(tabId: number): Promise<void> {
    const api = this.api();
    if (!api) return;
    if (this.attachedTabs.has(tabId)) return;
    try {
      await api.attach({ tabId }, CDP_PROTOCOL_VERSION);
    } catch (err) {
      if (!isAlreadyAttached(err)) {
        logger.warn('CdpSource', 'debugger.attach failed', { tabId, error: errorMessage(err) });
        throw err instanceof Error ? err : new Error(errorMessage(err));
      }
    }
    this.attachedTabs.add(tabId);
    await this.enableNetwork({ tabId });
    // Page domain on the root target only — the main frame's navigation +
    // load lifecycle is the page-timing source; child targets never carry
    // page-level events.
    await this.enablePage({ tabId });
    await this.enableAutoAttach({ tabId });
    // Seed the main-frame registry before any navigation: the first
    // navigation's requestWillBeSent precedes its frameNavigated, so
    // without the seed the main/sub document split misses the first nav.
    await this.seedMainFrame(tabId);
  }

  /**
   * Detach CDP from a tab — `Network.disable` then
   * `chrome.debugger.detach`. Tolerant of "not attached" (the SW may have
   * been evicted, dropping the attachment underneath us).
   */
  async detach(tabId: number): Promise<void> {
    const api = this.api();
    if (!api) return;
    this.attachedTabs.delete(tabId);
    this.forgetChildrenOf(tabId);
    clearMainFrameId(tabId);
    await this.send({ tabId }, 'Network.disable');
    try {
      await api.detach({ tabId });
    } catch (err) {
      if (!isNotAttached(err)) {
        logger.warn('CdpSource', 'debugger.detach failed', { tabId, error: errorMessage(err) });
      }
    }
  }

  /** Remove chrome listeners + detach every live tab. Tests / SW shutdown. */
  dispose(): void {
    for (const off of this.removeListeners) off();
    this.removeListeners.length = 0;
    for (const tabId of [...this.attachedTabs]) void this.detach(tabId);
    this.listeners.clear();
    this.pageListeners.clear();
    this.detachListeners.clear();
    this.attachedTabs.clear();
    this.childSessions.clear();
  }

  // ── install / chrome event binding ────────────────────────────────

  private install(): void {
    const api = this.api();
    if (!api) {
      logger.info('CdpSource', 'chrome.debugger unavailable; CDP source inert');
      return;
    }
    const onEvent = (source: chrome.debugger.DebuggerSession, method: string, params?: object): void => {
      this.handleEvent(source, method, params);
    };
    const onDetach = (source: chrome.debugger.Debuggee, reason: string): void => {
      this.handleDetach(source, reason);
    };
    api.onEvent.addListener(onEvent);
    api.onDetach.addListener(onDetach);
    this.removeListeners.push(
      () => api.onEvent.removeListener(onEvent),
      () => api.onDetach.removeListener(onDetach),
    );
  }

  // ── event routing ─────────────────────────────────────────────────

  private handleEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    const tabId = source.tabId;
    // Only sessions rooted in a tab we own; flattened child events still
    // carry the root tab's `tabId` alongside their own `sessionId`.
    if (tabId === undefined || !this.attachedTabs.has(tabId)) return;

    if (method === 'Target.attachedToTarget') {
      if (params !== undefined) this.handleTargetAttached(tabId, params as RawAttachedToTarget);
      return;
    }
    if (method === 'Target.detachedFromTarget') {
      if (params !== undefined) this.handleTargetDetached(params as RawDetachedFromTarget);
      return;
    }
    if (method.startsWith('Page.')) {
      // Page lifecycle is enabled on the root target only (page timings are
      // a main-frame concern); a child session never carries these.
      if (source.sessionId === undefined && params !== undefined) this.handlePageEvent(method, tabId, params);
      return;
    }
    if (!method.startsWith('Network.') || params === undefined) return;
    // A child session only routes once we have chosen to keep it (type
    // filter applied in `handleTargetAttached`); the root has no id.
    const childSessionId = source.sessionId;
    if (childSessionId !== undefined && !this.childSessions.has(childSessionId)) return;
    const sessionId = childSessionId ?? ROOT_SESSION_ID;
    this.handleNetworkEvent(method, tabId, sessionId, params);
  }

  private handleNetworkEvent(method: string, tabId: number, sessionId: string, params: object): void {
    switch (method) {
      case 'Network.requestWillBeSent':
        this.fan(normalizeRequestWillBeSent(tabId, sessionId, params as RawRequestWillBeSent));
        return;
      case 'Network.responseReceived':
        this.fan(normalizeResponseReceived(tabId, sessionId, params as RawResponseReceived));
        return;
      case 'Network.dataReceived':
        this.fan(normalizeDataReceived(tabId, sessionId, params as RawDataReceived));
        return;
      case 'Network.loadingFinished':
        this.fan(normalizeLoadingFinished(tabId, sessionId, params as RawLoadingFinished));
        return;
      case 'Network.loadingFailed':
        this.fan(normalizeLoadingFailed(tabId, sessionId, params as RawLoadingFailed));
        return;
      case 'Network.requestWillBeSentExtraInfo':
        this.fan(normalizeRequestWillBeSentExtraInfo(tabId, sessionId, params as RawRequestWillBeSentExtraInfo));
        return;
      case 'Network.responseReceivedExtraInfo':
        this.fan(normalizeResponseReceivedExtraInfo(tabId, sessionId, params as RawResponseReceivedExtraInfo));
        return;
    }
    // Other Network.* events are not part of the consumed subset.
  }

  private handlePageEvent(method: string, tabId: number, params: object): void {
    switch (method) {
      case 'Page.frameNavigated': {
        const navigated = params as RawFrameNavigated;
        // A parentless frame is the tab's main frame — refresh the registry
        // (covers the rare frame-id swap the getFrameTree seed can't see).
        if (navigated.frame.parentId === undefined) setMainFrameId(tabId, navigated.frame.id);
        this.fanPage(normalizeFrameNavigated(tabId, navigated));
        return;
      }
      case 'Page.domContentEventFired':
        this.fanPage(normalizePageLifecycle('Page.domContentEventFired', tabId, params as RawPageLifecycleTimestamp));
        return;
      case 'Page.loadEventFired':
        this.fanPage(normalizePageLifecycle('Page.loadEventFired', tabId, params as RawPageLifecycleTimestamp));
        return;
      case 'Page.frameStoppedLoading':
        this.fanPage(normalizeFrameStoppedLoading(tabId, params as RawFrameStoppedLoading));
        return;
    }
    // Other Page.* events are not part of the consumed subset.
  }

  private handleTargetAttached(tabId: number, params: RawAttachedToTarget): void {
    const childSessionId = params.sessionId;
    if (!ATTACHABLE_CHILD_TARGET_TYPES.has(params.targetInfo.type)) return;
    this.childSessions.set(childSessionId, tabId);
    // Enable Network on the child and recurse auto-attach so nested
    // OOPIFs/workers under this child attach too (flatten only reaches
    // direct children per session).
    const session = { tabId, sessionId: childSessionId };
    void this.enableNetwork(session);
    void this.enableAutoAttach(session);
  }

  private handleTargetDetached(params: RawDetachedFromTarget): void {
    this.childSessions.delete(params.sessionId);
  }

  private handleDetach(source: chrome.debugger.Debuggee, reason: string): void {
    const tabId = source.tabId;
    if (tabId === undefined) return;
    this.attachedTabs.delete(tabId);
    this.forgetChildrenOf(tabId);
    clearMainFrameId(tabId);
    for (const listener of this.detachListeners) listener(tabId, reason);
  }

  // ── chrome.debugger command helpers ───────────────────────────────

  private enableNetwork(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Network.enable', {
      maxTotalBufferSize: MAX_RESPONSE_BODY_TOTAL_BUFFER_BYTES,
      maxPostDataSize: MAX_EAGER_POST_BODY_BYTES,
    });
  }

  private enablePage(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Page.enable');
  }

  private enableAutoAttach(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  }

  /**
   * Seed the per-tab main-frame id from `Page.getFrameTree`. Frame ids
   * are stable per frame (including cross-process navigations), so this
   * one fact plus parentless `Page.frameNavigated` refreshes keeps the
   * registry correct for the attachment's lifetime.
   */
  private async seedMainFrame(tabId: number): Promise<void> {
    const api = this.api();
    if (!api) return;
    try {
      const result = (await api.sendCommand({ tabId }, 'Page.getFrameTree')) as RawGetFrameTree | undefined;
      const mainFrameId = result?.frameTree?.frame?.id;
      if (typeof mainFrameId === 'string' && mainFrameId.length > 0) setMainFrameId(tabId, mainFrameId);
    } catch (err) {
      // Tolerated: the registry self-heals on the next parentless
      // frameNavigated; until then documents read as sub-frame.
      logger.debug('CdpSource', 'Page.getFrameTree failed', { tabId, error: errorMessage(err) });
    }
  }

  private async send(
    session: chrome.debugger.DebuggerSession,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    const api = this.api();
    if (!api) return;
    try {
      await api.sendCommand(session, method, params);
    } catch (err) {
      // A target can die between auto-attach and our command (fast
      // navigation, closed iframe); tolerate and move on.
      logger.debug('CdpSource', 'sendCommand failed', { method, error: errorMessage(err) });
    }
  }

  private forgetChildrenOf(tabId: number): void {
    for (const [sessionId, owner] of this.childSessions) {
      if (owner === tabId) this.childSessions.delete(sessionId);
    }
  }

  private fan(event: CdpNetworkEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private fanPage(event: CdpPageEvent): void {
    for (const listener of this.pageListeners) listener(event);
  }

  private api(): DebuggerApi | undefined {
    return getBrowserAPI().debugger;
  }
}

// ── raw CDP protocol payloads (untyped `object` in @types/chrome) ─────
//
// `chrome.debugger.onEvent` hands params as a bare `object`; these
// interfaces shape the subset we read so the normalizers below stay
// field-checked. Field names are CDP-verbatim.

interface RawRequest {
  readonly url: string;
  readonly method: string;
  readonly headers?: Record<string, string>;
  readonly hasPostData?: boolean;
  readonly postData?: string;
  readonly initialPriority?: string;
}

interface RawResourceTiming {
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

interface RawResponse {
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

interface RawCallFrame {
  readonly functionName: string;
  readonly scriptId: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

interface RawStackTrace {
  readonly description?: string;
  readonly callFrames: readonly RawCallFrame[];
  readonly parent?: RawStackTrace;
}

interface RawInitiator {
  readonly type: string;
  readonly url?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly stack?: RawStackTrace;
}

interface RawRequestWillBeSent {
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

interface RawResponseReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly response: RawResponse;
}

interface RawDataReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly dataLength: number;
  readonly encodedDataLength: number;
}

interface RawLoadingFinished {
  readonly requestId: string;
  readonly timestamp: number;
  readonly encodedDataLength: number;
}

interface RawLoadingFailed {
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly errorText: string;
  readonly canceled?: boolean;
  readonly blockedReason?: string;
}

interface RawRequestWillBeSentExtraInfo {
  readonly requestId: string;
  readonly headers: Record<string, string>;
}

interface RawResponseReceivedExtraInfo {
  readonly requestId: string;
  readonly headers: Record<string, string>;
}

/** `Network.getResponseBody` result — body text + whether it is base64. */
interface RawGetResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/** `Network.streamResourceContent` result — bytes received so far, base64. */
interface RawStreamResourceContent {
  readonly bufferedData: string;
}

/** `Page.getFrameTree` result — only the root frame's id is consumed. */
interface RawGetFrameTree {
  readonly frameTree?: {
    readonly frame?: { readonly id?: string };
  };
}

interface RawTargetInfo {
  readonly type: string;
  readonly targetId: string;
  readonly title?: string;
  readonly url?: string;
  readonly attached?: boolean;
}

interface RawAttachedToTarget {
  readonly sessionId: string;
  readonly targetInfo: RawTargetInfo;
  readonly waitingForDebugger?: boolean;
}

interface RawDetachedFromTarget {
  readonly sessionId: string;
  readonly targetId?: string;
}

interface RawPageFrame {
  readonly id: string;
  readonly parentId?: string;
  readonly loaderId: string;
  readonly url: string;
}

interface RawFrameNavigated {
  readonly frame: RawPageFrame;
}

interface RawPageLifecycleTimestamp {
  readonly timestamp: number;
}

interface RawFrameStoppedLoading {
  readonly frameId: string;
}

// ── normalizers (raw CDP params → oracle CdpNetworkEvent) ────────────

function normalizeRequestWillBeSent(tabId: number, sessionId: string, p: RawRequestWillBeSent): CdpNetworkEvent {
  return {
    method: 'Network.requestWillBeSent',
    tabId,
    sessionId,
    requestId: p.requestId,
    loaderId: p.loaderId,
    documentURL: p.documentURL,
    request: normalizeRequest(p.request),
    timestamp: p.timestamp,
    wallTime: p.wallTime,
    ...(p.initiator !== undefined ? { initiator: normalizeInitiator(p.initiator) } : {}),
    ...(p.redirectResponse !== undefined ? { redirectResponse: normalizeResponse(p.redirectResponse) } : {}),
    ...(p.type !== undefined ? { type: p.type } : {}),
    ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
  };
}

function normalizeResponseReceived(tabId: number, sessionId: string, p: RawResponseReceived): CdpNetworkEvent {
  return {
    method: 'Network.responseReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    type: p.type,
    response: normalizeResponse(p.response),
  };
}

function normalizeDataReceived(tabId: number, sessionId: string, p: RawDataReceived): CdpNetworkEvent {
  return {
    method: 'Network.dataReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    dataLength: p.dataLength,
    encodedDataLength: p.encodedDataLength,
  };
}

function normalizeLoadingFinished(tabId: number, sessionId: string, p: RawLoadingFinished): CdpNetworkEvent {
  return {
    method: 'Network.loadingFinished',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    encodedDataLength: p.encodedDataLength,
  };
}

function normalizeLoadingFailed(tabId: number, sessionId: string, p: RawLoadingFailed): CdpNetworkEvent {
  return {
    method: 'Network.loadingFailed',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    type: p.type,
    errorText: p.errorText,
    ...(p.canceled !== undefined ? { canceled: p.canceled } : {}),
    ...(p.blockedReason !== undefined ? { blockedReason: p.blockedReason } : {}),
  };
}

function normalizeRequestWillBeSentExtraInfo(
  tabId: number,
  sessionId: string,
  p: RawRequestWillBeSentExtraInfo,
): CdpNetworkEvent {
  return {
    method: 'Network.requestWillBeSentExtraInfo',
    tabId,
    sessionId,
    requestId: p.requestId,
    headers: p.headers,
  };
}

function normalizeResponseReceivedExtraInfo(
  tabId: number,
  sessionId: string,
  p: RawResponseReceivedExtraInfo,
): CdpNetworkEvent {
  return {
    method: 'Network.responseReceivedExtraInfo',
    tabId,
    sessionId,
    requestId: p.requestId,
    headers: p.headers,
  };
}

// ── page-domain normalizers (root target only) ───────────────────────

function normalizeFrameNavigated(tabId: number, p: RawFrameNavigated): CdpPageEvent {
  return {
    method: 'Page.frameNavigated',
    tabId,
    sessionId: ROOT_SESSION_ID,
    frame: normalizePageFrame(p.frame),
  };
}

function normalizePageLifecycle(
  method: 'Page.domContentEventFired' | 'Page.loadEventFired',
  tabId: number,
  p: RawPageLifecycleTimestamp,
): CdpPageEvent {
  return { method, tabId, sessionId: ROOT_SESSION_ID, timestamp: p.timestamp };
}

function normalizeFrameStoppedLoading(tabId: number, p: RawFrameStoppedLoading): CdpPageEvent {
  // The protocol event carries no timestamp; the arrival wall-clock is the
  // fact's instant (it feeds no timing math, only the teardown record).
  return {
    method: 'Page.frameStoppedLoading',
    tabId,
    sessionId: ROOT_SESSION_ID,
    frameId: p.frameId,
    atWallMs: Date.now(),
  };
}

function normalizePageFrame(f: RawPageFrame): CdpPageFrame {
  return {
    id: f.id,
    loaderId: f.loaderId,
    url: f.url,
    ...(f.parentId !== undefined ? { parentId: f.parentId } : {}),
  };
}

function normalizeRequest(r: RawRequest): CdpRequestParams {
  return {
    url: r.url,
    method: r.method,
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
    ...(r.hasPostData !== undefined ? { hasPostData: r.hasPostData } : {}),
    ...(r.postData !== undefined ? { postData: r.postData } : {}),
    ...(r.initialPriority !== undefined ? { initialPriority: r.initialPriority } : {}),
  };
}

function normalizeResponse(r: RawResponse): CdpResponseParams {
  return {
    url: r.url,
    status: r.status,
    statusText: r.statusText,
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
    ...(r.fromDiskCache !== undefined ? { fromDiskCache: r.fromDiskCache } : {}),
    ...(r.fromServiceWorker !== undefined ? { fromServiceWorker: r.fromServiceWorker } : {}),
    ...(r.remoteIPAddress !== undefined ? { remoteIPAddress: r.remoteIPAddress } : {}),
    ...(r.remotePort !== undefined ? { remotePort: r.remotePort } : {}),
    ...(r.connectionId !== undefined ? { connectionId: r.connectionId } : {}),
    ...(r.protocol !== undefined ? { protocol: r.protocol } : {}),
    ...(r.mimeType !== undefined ? { mimeType: r.mimeType } : {}),
    ...(r.charset !== undefined ? { charset: r.charset } : {}),
    ...(r.timing !== undefined ? { timing: normalizeTiming(r.timing) } : {}),
    ...(r.encodedDataLength !== undefined ? { encodedDataLength: r.encodedDataLength } : {}),
  };
}

function normalizeTiming(t: RawResourceTiming): CdpResourceTiming {
  return {
    requestTime: t.requestTime,
    ...(t.proxyStart !== undefined ? { proxyStart: t.proxyStart } : {}),
    ...(t.proxyEnd !== undefined ? { proxyEnd: t.proxyEnd } : {}),
    ...(t.dnsStart !== undefined ? { dnsStart: t.dnsStart } : {}),
    ...(t.dnsEnd !== undefined ? { dnsEnd: t.dnsEnd } : {}),
    ...(t.connectStart !== undefined ? { connectStart: t.connectStart } : {}),
    ...(t.connectEnd !== undefined ? { connectEnd: t.connectEnd } : {}),
    ...(t.sslStart !== undefined ? { sslStart: t.sslStart } : {}),
    ...(t.sslEnd !== undefined ? { sslEnd: t.sslEnd } : {}),
    ...(t.sendStart !== undefined ? { sendStart: t.sendStart } : {}),
    ...(t.sendEnd !== undefined ? { sendEnd: t.sendEnd } : {}),
    ...(t.receiveHeadersStart !== undefined ? { receiveHeadersStart: t.receiveHeadersStart } : {}),
    ...(t.receiveHeadersEnd !== undefined ? { receiveHeadersEnd: t.receiveHeadersEnd } : {}),
    ...(t.workerStart !== undefined ? { workerStart: t.workerStart } : {}),
    ...(t.workerReady !== undefined ? { workerReady: t.workerReady } : {}),
    ...(t.workerFetchStart !== undefined ? { workerFetchStart: t.workerFetchStart } : {}),
    ...(t.workerRespondWithSettled !== undefined ? { workerRespondWithSettled: t.workerRespondWithSettled } : {}),
  };
}

function normalizeInitiator(i: RawInitiator): CdpInitiator {
  return {
    type: normalizeInitiatorType(i.type),
    ...(i.url !== undefined ? { url: i.url } : {}),
    ...(i.lineNumber !== undefined ? { lineNumber: i.lineNumber } : {}),
    ...(i.columnNumber !== undefined ? { columnNumber: i.columnNumber } : {}),
    ...(i.stack !== undefined ? { stack: normalizeStackTrace(i.stack) } : {}),
  };
}

function normalizeStackTrace(s: RawStackTrace): CdpStackTrace {
  return {
    ...(s.description !== undefined ? { description: s.description } : {}),
    callFrames: s.callFrames.map(normalizeCallFrame),
    ...(s.parent !== undefined ? { parent: normalizeStackTrace(s.parent) } : {}),
  };
}

function normalizeCallFrame(f: RawCallFrame): CdpCallFrame {
  return {
    functionName: f.functionName,
    scriptId: f.scriptId,
    url: f.url,
    lineNumber: f.lineNumber,
    columnNumber: f.columnNumber,
  };
}

/** Clamp the CDP initiator type onto the oracle's known union. */
function normalizeInitiatorType(type: string): CdpInitiator['type'] {
  switch (type) {
    case 'parser':
    case 'script':
    case 'preload':
    case 'SignedExchange':
    case 'preflight':
      return type;
    default:
      return 'other';
  }
}

// ── chrome error tolerance ───────────────────────────────────────────

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `chrome.debugger.attach` on a tab another client already debugs. */
function isAlreadyAttached(err: unknown): boolean {
  return /already attached/i.test(errorMessage(err));
}

/** `chrome.debugger.detach` / `sendCommand` on a tab no longer attached. */
function isNotAttached(err: unknown): boolean {
  return /not attached/i.test(errorMessage(err));
}
