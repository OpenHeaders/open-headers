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
  CdpEventSource,
  CdpInitiator,
  CdpNetworkEvent,
  CdpRequestParams,
  CdpResourceTiming,
  CdpResponseParams,
} from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import { type BrowserAPI, getBrowserAPI } from '@/types/browser';

type Listener = (event: CdpNetworkEvent) => void;
type DetachListener = (tabId: number, reason: string) => void;
type DebuggerApi = BrowserAPI['debugger'];

/** Protocol version handed to `chrome.debugger.attach`. */
const CDP_PROTOCOL_VERSION = '1.3';

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
  private readonly detachListeners = new Set<DetachListener>();
  /** Root (page-target) tabs we hold a `chrome.debugger` attachment for. */
  private readonly attachedTabs = new Set<number>();
  /** Flattened child sessions we kept and enabled `Network` on → owning root tab. */
  private readonly childSessions = new Map<string, number>();
  private readonly removeListeners: Array<() => void> = [];

  constructor() {
    this.install();
  }

  /** `CdpEventSource` seam — fan normalized events to the correlator. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
        return;
      }
    }
    this.attachedTabs.add(tabId);
    await this.enableNetwork({ tabId });
    await this.enableAutoAttach({ tabId });
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
      case 'Network.loadingFinished':
        this.fan(normalizeLoadingFinished(tabId, sessionId, params as RawLoadingFinished));
        return;
      case 'Network.loadingFailed':
        this.fan(normalizeLoadingFailed(tabId, sessionId, params as RawLoadingFailed));
        return;
    }
    // Other Network.* events are not part of the consumed subset.
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
    for (const listener of this.detachListeners) listener(tabId, reason);
  }

  // ── chrome.debugger command helpers ───────────────────────────────

  private enableNetwork(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Network.enable');
  }

  private enableAutoAttach(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
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
}

interface RawResponse {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers?: Record<string, string>;
  readonly mimeType?: string;
  readonly remoteIPAddress?: string;
  readonly protocol?: string;
  readonly fromDiskCache?: boolean;
  readonly fromServiceWorker?: boolean;
  readonly encodedDataLength?: number;
  readonly timing?: RawResourceTiming;
}

interface RawInitiator {
  readonly type: string;
  readonly url?: string;
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
}

interface RawResponseReceived {
  readonly requestId: string;
  readonly timestamp: number;
  readonly type: string;
  readonly response: RawResponse;
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

function normalizeRequest(r: RawRequest): CdpRequestParams {
  return {
    url: r.url,
    method: r.method,
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
    ...(r.hasPostData !== undefined ? { hasPostData: r.hasPostData } : {}),
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
    ...(r.protocol !== undefined ? { protocol: r.protocol } : {}),
    ...(r.mimeType !== undefined ? { mimeType: r.mimeType } : {}),
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
  };
}

function normalizeInitiator(i: RawInitiator): CdpInitiator {
  return {
    type: normalizeInitiatorType(i.type),
    ...(i.url !== undefined ? { url: i.url } : {}),
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
