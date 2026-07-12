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

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { type JsContext, jsContextKey } from '@openheaders/core/js-contexts';
import type {
  CdpBufferedResponseBody,
  CdpEventSource,
  CdpFetchEvent,
  CdpNetworkEvent,
  CdpPageEvent,
  CdpResponseBody,
} from '@openheaders/oracle/correlator-cdp';
import { OH_BINDING } from '@openheaders/rule-engine/content-scripts';
import { logger } from '@utils/logger';
import { type BrowserAPI, getBrowserAPI } from '@/types/browser';
import {
  normalizeAuthRequired,
  normalizeConsoleApiCalled,
  normalizeDataReceived,
  normalizeEventSourceMessageReceived,
  normalizeExceptionThrown,
  normalizeExecutionContextCreated,
  normalizeFrameNavigated,
  normalizeFrameStoppedLoading,
  normalizeLoadingFailed,
  normalizeLoadingFinished,
  normalizeLogEntryAdded,
  normalizePageLifecycle,
  normalizeRequestPaused,
  normalizeRequestWillBeSent,
  normalizeRequestWillBeSentExtraInfo,
  normalizeResponseReceived,
  normalizeResponseReceivedExtraInfo,
  normalizeWebSocketClosed,
  normalizeWebSocketCreated,
  normalizeWebSocketFrame,
  normalizeWebSocketFrameError,
  normalizeWebSocketHandshakeResponseReceived,
  normalizeWebSocketWillSendHandshakeRequest,
  parseBindingFire,
} from './cdp-normalizers';
import type {
  RawAttachedToTarget,
  RawAuthRequired,
  RawBindingCalled,
  RawConsoleApiCalled,
  RawDataReceived,
  RawDetachedFromTarget,
  RawEventSourceMessageReceived,
  RawExceptionThrown,
  RawExecutionContextCreated,
  RawExecutionContextDestroyed,
  RawFrameNavigated,
  RawFrameStoppedLoading,
  RawGetFrameTree,
  RawGetResponseBody,
  RawLoadingFailed,
  RawLoadingFinished,
  RawLogEntryAdded,
  RawPageLifecycleTimestamp,
  RawRequestPaused,
  RawRequestWillBeSent,
  RawRequestWillBeSentExtraInfo,
  RawResponseReceived,
  RawResponseReceivedExtraInfo,
  RawStorageUpdated,
  RawStreamResourceContent,
  RawWebSocketClosed,
  RawWebSocketCreated,
  RawWebSocketFrameError,
  RawWebSocketFrameEvent,
  RawWebSocketHandshakeResponseReceived,
  RawWebSocketWillSendHandshakeRequest,
} from './cdp-raw-payloads';
import { type CdpBindingFire, type ChildTargetKind, type KeptChildSession, ROOT_SESSION_ID } from './cdp-session';
import { clearMainFrameId, setMainFrameId } from './main-frame-registry';

export type { CdpBindingFire, ChildTargetKind, KeptChildSession } from './cdp-session';
// Re-exported for importers that consumed these from this module before the
// raw-payloads / normalizers split (cdp-control-replay, the correlator-host
// barrel, tests).
export { cdpRootTarget, ROOT_SESSION_ID } from './cdp-session';

type Listener = (event: CdpNetworkEvent) => void;
type PageListener = (event: CdpPageEvent) => void;
type FetchListener = (event: CdpFetchEvent) => void;
type DetachListener = (tabId: number, reason: string) => void;
type ChildSessionListener = (tabId: number, sessionId: string, kind: ChildTargetKind) => void;
type BindingListener = (fire: CdpBindingFire) => void;
type ConsoleListener = (tabId: number, entry: ConsoleEntry) => void;
type JsContextsListener = (event: CdpJsContextEvent) => void;
type StorageTrackingKind = 'indexeddb' | 'cachestorage';
type StorageTrackingListener = (tabId: number, storageKey: string, kind: StorageTrackingKind) => void;
type DebuggerApi = BrowserAPI['debugger'];

/**
 * Engine-input event for the JS-contexts plane (Phase A) — the adapter's fan
 * shape toward `JsContextHub`. Session-level teardown is explicit
 * (`session-cleared` when one session's contexts all die while the tab stays
 * attached; `tab-detached` when the whole attachment ends) so the hub can
 * drop exactly the affected subset.
 */
export type CdpJsContextEvent =
  | { kind: 'context-created'; tabId: number; context: JsContext }
  | { kind: 'context-destroyed'; tabId: number; contextKey: string }
  | { kind: 'session-cleared'; tabId: number; sessionKey: string }
  | { kind: 'tab-detached'; tabId: number };

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
 * Map a raw CDP target type onto the {@link ChildTargetKind} we auto-attach to
 * (B1 product call) — or `undefined` for one we skip. The parity goal is
 * 1-to-1 with Chrome's own page Network tab, which under a per-tab attach
 * equals the heuristic's `webRequest` coverage:
 *
 *   - `iframe` — out-of-process iframes. The headline B1 gap; their
 *     traffic never flows through the page session.
 *   - `worker` — dedicated workers. `webRequest` attributes their fetches
 *     to the owning page's `tabId`, and Chrome's page Network tab shows
 *     them, so excluding them would undercount.
 *
 * Skipped: `service_worker` / `shared_worker`. `webRequest` reports them
 * with `tabId === -1` (dropped by the heuristic), and Chrome surfaces
 * them in a *separate* DevTools instance, not the page tab — attaching
 * would invert parity the other way and surface cross-page traffic the
 * user never saw. They are also not reachable from a per-tab attach (they
 * are browser-scoped targets, not children of the tab target); full
 * coverage would require a browser-level debuggee, deferred out of this
 * epic. Returning the typed kind (not a boolean) carries the page-vs-worker
 * distinction out to the control-replay fan, which projects a worker's state.
 */
function childTargetKind(type: string): ChildTargetKind | undefined {
  return type === 'iframe' || type === 'worker' ? type : undefined;
}

export class ChromeDebuggerEventSource implements CdpEventSource {
  private readonly listeners = new Set<Listener>();
  private readonly pageListeners = new Set<PageListener>();
  private readonly fetchListeners = new Set<FetchListener>();
  private readonly detachListeners = new Set<DetachListener>();
  private readonly childAttachListeners = new Set<ChildSessionListener>();
  private readonly childDetachListeners = new Set<ChildSessionListener>();
  private readonly bindingListeners = new Set<BindingListener>();
  private readonly consoleListeners = new Set<ConsoleListener>();
  private readonly jsContextsListeners = new Set<JsContextsListener>();
  private readonly storageTrackingListeners = new Set<StorageTrackingListener>();
  /** Root (page-target) tabs we hold a `chrome.debugger` attachment for. */
  private readonly attachedTabs = new Set<number>();
  /**
   * Flattened child sessions we kept and enabled `Network` on → their owning
   * root tab and target kind. The kind rides along so the control-replay fan
   * can project a worker's standing state onto its Network/Fetch-only subset.
   */
  private readonly childSessions = new Map<string, { readonly owner: number; readonly kind: ChildTargetKind }>();
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

  /** `CdpEventSource` seam — fan normalized `Fetch.*` control-input events
   *  (paused requests) to the host's pause handler (Phase D). */
  subscribeFetch(listener: FetchListener): () => void {
    this.fetchListeners.add(listener);
    return () => {
      this.fetchListeners.delete(listener);
    };
  }

  /**
   * Subscribe to private fire-bridge events (E4) — a residual wrapper's fire on
   * any session of a CDP-attached tab, delivered via `Runtime.bindingCalled`
   * instead of `window.postMessage`. Page-invisible: the page can neither read
   * nor forge these (a forged DOM message never reaches the debugger). NOT part
   * of the oracle `CdpEventSource` interface — rule fires are a host concern, so
   * the pipeline consumes this directly off the chrome adapter.
   */
  subscribeBinding(listener: BindingListener): () => void {
    this.bindingListeners.add(listener);
    return () => {
      this.bindingListeners.delete(listener);
    };
  }

  /**
   * Subscribe to captured console output (Phase G) — a CDP-attached tab's
   * `console.*` calls + uncaught exceptions (riding E4's standing
   * `Runtime.enable`) and the browser's own log entries (`Log.entryAdded` —
   * failed/blocked network requests, deprecations, violations, …), delivered
   * as host-neutral {@link ConsoleEntry}s already routed by `tabId` (root +
   * kept worker/OOPIF children). Observation only (no page effect). NOT part
   * of the oracle `CdpEventSource` interface — console is a host concern, so
   * the pipeline consumes this directly off the chrome adapter (mirror of
   * `subscribeBinding`).
   */
  subscribeConsole(listener: ConsoleListener): () => void {
    this.consoleListeners.add(listener);
    return () => {
      this.consoleListeners.delete(listener);
    };
  }

  /**
   * Subscribe to JS execution-context lifecycle (JS contexts Phase A) — the
   * `Runtime.executionContextCreated/Destroyed/executionContextsCleared`
   * events the standing `Runtime.enable` already delivers on the root and
   * every kept child session, formerly dropped by the router. The enable
   * replays already-live contexts as `created` on attach, so the registry
   * self-seeds — no snapshot pull. Session teardown fans explicitly:
   * `session-cleared` when a kept child detaches, `tab-detached` when the
   * tab's attachment ends. NOT part of the oracle `CdpEventSource` interface
   * — contexts are a host concern (mirror of `subscribeConsole`).
   */
  subscribeContexts(listener: JsContextsListener): () => void {
    this.jsContextsListeners.add(listener);
    return () => {
      this.jsContextsListeners.delete(listener);
    };
  }

  /**
   * Subscribe to storage tracking updates (storage-panel slices 4/5) —
   * `Storage.indexedDB*Updated` / `Storage.cacheStorage*Updated` for a
   * storage key the storage inspector armed via the
   * `Storage.track*ForStorageKey` commands on the tab's root session.
   * Pure invalidation input: the panel refetches through its read plane
   * (injected for IndexedDB — its CDP read domain stays blocked, see
   * STORAGE_PANEL_PLAN.md §2.3 — arbitrated for Cache Storage). NOT part
   * of the oracle `CdpEventSource` interface — storage inspection is a
   * host concern (mirror of `subscribeConsole`).
   */
  subscribeStorageTracking(listener: StorageTrackingListener): () => void {
    this.storageTrackingListeners.add(listener);
    return () => {
      this.storageTrackingListeners.delete(listener);
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

  /**
   * True when `chrome.debugger` exists on this host (false on Firefox /
   * Safari). The control-port adapters gate their `available` on it.
   */
  get cdpAvailable(): boolean {
    return this.api() !== undefined;
  }

  /**
   * Control-plane seam — issue one CDP command on a tab's session and
   * return its raw result. The session-routed counterpart of the body-fetch
   * pulls: the synthetic root session id maps to a `{tabId}` debuggee, a
   * flattened child carries its real id. The control-port adapters route
   * every typed command through here, so `chrome.debugger.*` stays named in
   * this file alone and no second attach path is introduced. Rejects on an
   * absent transport; surfaces command errors to the caller, which owns the
   * tolerance decision (a standing-state replay logs and moves on; a
   * per-request reaction may care).
   */
  async sendOnSession(
    tabId: number,
    sessionId: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const api = this.api();
    if (!api) throw new Error('CDP transport unavailable');
    return api.sendCommand(this.sessionFor(tabId, sessionId), method, params);
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
   * Observe flattened child sessions (workers / OOPIFs) being kept and
   * released. The control plane (Phase D) listens here to fan a tab's
   * standing CDP state — `Fetch.enable` patterns above all — onto each
   * child session as it attaches, so interception reaches worker- and
   * iframe-originated requests, not just the root page target. Detach fires
   * on the child's own teardown and when its owning tab detaches.
   */
  onChildAttached(listener: ChildSessionListener): () => void {
    this.childAttachListeners.add(listener);
    return () => {
      this.childAttachListeners.delete(listener);
    };
  }

  onChildDetached(listener: ChildSessionListener): () => void {
    this.childDetachListeners.add(listener);
    return () => {
      this.childDetachListeners.delete(listener);
    };
  }

  /** The kept child sessions for a tab (workers / OOPIFs) with their kind, in no order. */
  childSessionsOf(tabId: number): KeptChildSession[] {
    const sessions: KeptChildSession[] = [];
    for (const [sessionId, { owner, kind }] of this.childSessions) {
      if (owner === tabId) sessions.push({ sessionId, kind });
    }
    return sessions;
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
    // The root's main-frame navigation + load lifecycle is the page-timing
    // source. Page is also enabled on iframe children (handleTargetAttached)
    // for Page-plane control delivery, but the event router fans page timings
    // from the root session alone, so child Page.* never enters the feed.
    await this.enablePage({ tabId });
    await this.enableAutoAttach({ tabId });
    // Private fire-bridge (E4): a Runtime binding the in-page wrappers report
    // through instead of window.postMessage — page-invisible. Fanned to kept
    // children too (handleTargetAttached) so an OOPIF wrapper's fire reaches us.
    await this.enableRuntimeBinding({ tabId });
    // Console capture, browser plane (Phase G): the Log domain carries the
    // browser's own console entries (failed/blocked network requests,
    // deprecations, violations, …), which never surface on the Runtime
    // events. Enabling also replays the target's retained backlog, so the
    // Console tool window shows history from before Debug mode attached.
    await this.enableLog({ tabId });
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
    this.fanContexts({ kind: 'tab-detached', tabId });
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
    this.fetchListeners.clear();
    this.detachListeners.clear();
    this.childAttachListeners.clear();
    this.childDetachListeners.clear();
    this.bindingListeners.clear();
    this.consoleListeners.clear();
    this.jsContextsListeners.clear();
    this.storageTrackingListeners.clear();
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
      // Page timings are a main-frame concern, sourced from the root session
      // alone. An iframe child also has Page enabled (for control delivery),
      // so it can emit Page.* — drop those here so page-timing stays
      // root-sourced.
      if (source.sessionId === undefined && params !== undefined) this.handlePageEvent(method, tabId, params);
      return;
    }
    if (method.startsWith('Fetch.')) {
      // Control-input stream (Phase D): a paused request on the root or a
      // kept child session. Same session gating as `Network.*` — paused
      // worker / OOPIF requests carry the child id; the root has none.
      if (params === undefined) return;
      const fetchChildSessionId = source.sessionId;
      if (fetchChildSessionId !== undefined && !this.childSessions.has(fetchChildSessionId)) return;
      this.handleFetchEvent(method, tabId, fetchChildSessionId ?? ROOT_SESSION_ID, params);
      return;
    }
    if (method.startsWith('Runtime.')) {
      // E4 fire-bridge + Phase G console capture + JS-contexts Phase A all
      // ride the standing Runtime.enable: bindingCalled is the page-invisible
      // fire channel; consoleAPICalled/exceptionThrown are the page's console
      // output + uncaught errors; executionContextCreated/Destroyed/
      // executionContextsCleared are the live context registry. All route by
      // tabId (a worker/OOPIF line belongs to the tab) but gate the session
      // like Network./Fetch.: only the root or a kept child.
      const runtimeChildSessionId = source.sessionId;
      if (runtimeChildSessionId !== undefined && !this.childSessions.has(runtimeChildSessionId)) return;
      const sessionKey = runtimeChildSessionId ?? ROOT_SESSION_ID;
      if (method === 'Runtime.executionContextsCleared') {
        // The one consumed Runtime event with no parameters — dispatch it
        // before the params gate.
        this.fanContexts({ kind: 'session-cleared', tabId, sessionKey });
        return;
      }
      if (params === undefined) return;
      if (method === 'Runtime.bindingCalled') {
        this.handleBindingCalled(tabId, params as RawBindingCalled);
      } else if (method === 'Runtime.consoleAPICalled') {
        this.fanConsole(tabId, normalizeConsoleApiCalled(sessionKey, params as RawConsoleApiCalled));
      } else if (method === 'Runtime.exceptionThrown') {
        this.fanConsole(tabId, normalizeExceptionThrown(sessionKey, params as RawExceptionThrown));
      } else if (method === 'Runtime.executionContextCreated') {
        const kind = runtimeChildSessionId === undefined ? 'page' : this.childSessions.get(runtimeChildSessionId)?.kind;
        if (kind === undefined) return;
        this.fanContexts({
          kind: 'context-created',
          tabId,
          context: normalizeExecutionContextCreated(sessionKey, kind, params as RawExecutionContextCreated),
        });
      } else if (method === 'Runtime.executionContextDestroyed') {
        const destroyed = params as RawExecutionContextDestroyed;
        this.fanContexts({
          kind: 'context-destroyed',
          tabId,
          contextKey: jsContextKey(sessionKey, destroyed.executionContextId),
        });
      }
      return;
    }
    if (method === 'Log.entryAdded') {
      // Phase G console capture, browser plane: the browser's own log entries
      // (failed/blocked network requests, deprecations, violations, …) — the
      // third stream Chrome's console merges alongside console.*/exceptions.
      // Same tabId routing + session gating as the Runtime console events.
      if (params === undefined) return;
      const logChildSessionId = source.sessionId;
      if (logChildSessionId !== undefined && !this.childSessions.has(logChildSessionId)) return;
      this.fanConsole(tabId, normalizeLogEntryAdded(logChildSessionId ?? ROOT_SESSION_ID, params as RawLogEntryAdded));
      return;
    }
    if (method.startsWith('Storage.')) {
      // Tracking is armed on the root session only (storage-panel slices
      // 4/5), so that is where its events arrive; a child session never
      // emits them. Other Storage.* events are not consumed.
      if (params === undefined || source.sessionId !== undefined) return;
      const kind: StorageTrackingKind | null =
        method === 'Storage.indexedDBListUpdated' || method === 'Storage.indexedDBContentUpdated'
          ? 'indexeddb'
          : method === 'Storage.cacheStorageListUpdated' || method === 'Storage.cacheStorageContentUpdated'
            ? 'cachestorage'
            : null;
      if (kind === null) return;
      const updated = params as RawStorageUpdated;
      if (typeof updated.storageKey === 'string') this.fanStorageTracking(tabId, updated.storageKey, kind);
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

  private handleFetchEvent(method: string, tabId: number, sessionId: string, params: object): void {
    if (method === 'Fetch.requestPaused') {
      this.fanFetch(normalizeRequestPaused(tabId, sessionId, params as RawRequestPaused));
      return;
    }
    if (method === 'Fetch.authRequired') {
      this.fanFetch(normalizeAuthRequired(tabId, sessionId, params as RawAuthRequired));
      return;
    }
    // Other Fetch.* events are not part of the consumed subset.
  }

  private handleBindingCalled(tabId: number, params: RawBindingCalled): void {
    // One binding is ever added; ignore any other name (defensive — a future
    // binding, or a stray event).
    if (params.name !== OH_BINDING) return;
    const fire = parseBindingFire(tabId, params.payload);
    if (fire !== null) this.fanBinding(fire);
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
      case 'Network.webSocketCreated':
        this.fan(normalizeWebSocketCreated(tabId, sessionId, params as RawWebSocketCreated));
        return;
      case 'Network.webSocketWillSendHandshakeRequest':
        this.fan(
          normalizeWebSocketWillSendHandshakeRequest(tabId, sessionId, params as RawWebSocketWillSendHandshakeRequest),
        );
        return;
      case 'Network.webSocketHandshakeResponseReceived':
        this.fan(
          normalizeWebSocketHandshakeResponseReceived(
            tabId,
            sessionId,
            params as RawWebSocketHandshakeResponseReceived,
          ),
        );
        return;
      case 'Network.webSocketFrameSent':
        this.fan(
          normalizeWebSocketFrame('Network.webSocketFrameSent', tabId, sessionId, params as RawWebSocketFrameEvent),
        );
        return;
      case 'Network.webSocketFrameReceived':
        this.fan(
          normalizeWebSocketFrame('Network.webSocketFrameReceived', tabId, sessionId, params as RawWebSocketFrameEvent),
        );
        return;
      case 'Network.webSocketFrameError':
        this.fan(normalizeWebSocketFrameError(tabId, sessionId, params as RawWebSocketFrameError));
        return;
      case 'Network.webSocketClosed':
        this.fan(normalizeWebSocketClosed(tabId, sessionId, params as RawWebSocketClosed));
        return;
      case 'Network.eventSourceMessageReceived':
        this.fan(normalizeEventSourceMessageReceived(tabId, sessionId, params as RawEventSourceMessageReceived));
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
    const kind = childTargetKind(params.targetInfo.type);
    if (kind === undefined) return;
    this.childSessions.set(childSessionId, { owner: tabId, kind });
    // Enable Network on the child and recurse auto-attach so nested
    // OOPIFs/workers under this child attach too (flatten only reaches
    // direct children per session).
    const session = { tabId, sessionId: childSessionId };
    void this.enableNetwork(session);
    void this.enableAutoAttach(session);
    // An OOPIF is page-like (has a Page domain): enable it so the fanned
    // Page-plane state (E1b bootstrap, E2 CSP bypass) lands inside the iframe,
    // not just the main frame — queued before `applyChild` runs so the enable
    // precedes those Page commands. Workers have no Page domain (Network-only);
    // child Page.* stays out of page-timing (the router fans the root alone).
    if (kind === 'iframe') void this.enablePage(session);
    // The private fire-bridge reaches every kept child (E4): a worker/OOPIF
    // wrapper's fire belongs to the tab, so addBinding + Runtime.enable on the
    // child's own session and route any bindingCalled there by tabId. Workers
    // have a Runtime domain + global, so this is uniform across child types —
    // moot for now (no worker wrapper exists yet; the deferred reach), but the
    // transport is in place for when one lands.
    void this.enableRuntimeBinding(session);
    // Browser-plane console entries fan from every kept child too — an OOPIF
    // or worker owns its own Log domain (its blocked fetches / deprecations
    // report there, not on the root). A child type without the domain just
    // fails the enable, which `send` tolerates.
    void this.enableLog(session);
    for (const listener of this.childAttachListeners) listener(tabId, childSessionId, kind);
  }

  private handleTargetDetached(params: RawDetachedFromTarget): void {
    const child = this.childSessions.get(params.sessionId);
    if (child === undefined) return;
    this.childSessions.delete(params.sessionId);
    // The session's contexts died with it and no executionContextDestroyed
    // will arrive for them — clear the session's subset explicitly.
    this.fanContexts({ kind: 'session-cleared', tabId: child.owner, sessionKey: params.sessionId });
    for (const listener of this.childDetachListeners) listener(child.owner, params.sessionId, child.kind);
  }

  private handleDetach(source: chrome.debugger.Debuggee, reason: string): void {
    const tabId = source.tabId;
    if (tabId === undefined) return;
    this.attachedTabs.delete(tabId);
    this.forgetChildrenOf(tabId);
    clearMainFrameId(tabId);
    // The context set is live state, not history — it dies with the
    // attachment (unlike the console log, which persists as backlog).
    this.fanContexts({ kind: 'tab-detached', tabId });
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

  /**
   * Enable the Log domain on a session (Phase G, browser plane). Delivery
   * requires the enable, and the enable itself replays the target's retained
   * log backlog as `Log.entryAdded` events — history capture is free.
   */
  private enableLog(session: chrome.debugger.DebuggerSession): Promise<void> {
    return this.send(session, 'Log.enable');
  }

  /**
   * Enable the Runtime domain and install the page-invisible fire binding on a
   * session (E4). `Runtime.bindingCalled` is delivered only to a client that
   * has enabled Runtime, so the enable is required, not optional — it also
   * turns on consoleAPICalled/exceptionThrown (kept by Phase G console
   * capture) and the executionContext lifecycle events (kept by the
   * JS-contexts registry). The binding (no
   * executionContextId) lands on every global on the session — main world
   * included — and survives reloads, so a bootstrap wrapper on a fresh document
   * finds it already present. Enable precedes addBinding so no early fire is
   * missed.
   */
  private async enableRuntimeBinding(session: chrome.debugger.DebuggerSession): Promise<void> {
    // Issue both on the session's serialized command queue in order — enable
    // before addBinding, so the binding never exists on a not-yet-enabled
    // Runtime and no early fire is lost — but without awaiting between them, so
    // the child fan-out (`void this.enableRuntimeBinding`) records both at once.
    const enabled = this.send(session, 'Runtime.enable');
    const bound = this.send(session, 'Runtime.addBinding', { name: OH_BINDING });
    await Promise.all([enabled, bound]);
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
    for (const [sessionId, { owner, kind }] of this.childSessions) {
      if (owner !== tabId) continue;
      this.childSessions.delete(sessionId);
      for (const listener of this.childDetachListeners) listener(tabId, sessionId, kind);
    }
  }

  private fan(event: CdpNetworkEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private fanPage(event: CdpPageEvent): void {
    for (const listener of this.pageListeners) listener(event);
  }

  private fanFetch(event: CdpFetchEvent): void {
    for (const listener of this.fetchListeners) listener(event);
  }

  private fanBinding(fire: CdpBindingFire): void {
    for (const listener of this.bindingListeners) listener(fire);
  }

  private fanConsole(tabId: number, entry: ConsoleEntry): void {
    for (const listener of this.consoleListeners) listener(tabId, entry);
  }

  private fanContexts(event: CdpJsContextEvent): void {
    for (const listener of this.jsContextsListeners) listener(event);
  }

  private fanStorageTracking(tabId: number, storageKey: string, kind: StorageTrackingKind): void {
    for (const listener of this.storageTrackingListeners) listener(tabId, storageKey, kind);
  }

  private api(): DebuggerApi | undefined {
    return getBrowserAPI().debugger;
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
