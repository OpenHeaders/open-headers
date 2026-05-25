/**
 * DevTools Inspector Port Handler — connects the DevTools UI surface to the
 * panel renderer.
 *
 * ## Two ports per tab
 *
 *   - `devtools-har-source:<tabId>` — opened by `devtools_page` (the DevTools
 *     extension page) the moment any DevTools window opens on the tab,
 *     regardless of which panel is active. Carries HAR entries, response
 *     bodies, navigation events, and navigation timing.
 *   - `devtools-inspector:<tabId>` — opened by the Open Headers panel iframe
 *     when it is the focused DevTools tab. Receives fire / HAR / nav messages
 *     so the React store can render the traffic list.
 *
 * The panel iframe is loaded lazily by Chrome — it only exists while the
 * Open Headers tab is the active DevTools panel. The har-source port, by
 * contrast, is alive for the lifetime of the DevTools window. Tracking and
 * fire capture must therefore be driven by the har-source port, not the
 * inspector port; otherwise requests issued before the user clicks the
 * Open Headers panel would have HAR captured (via the always-on har-source)
 * but no rule fires (because tab-telemetry tracking would not have started).
 *
 * ## Per-tab session
 *
 * `sessions` holds one entry per tab with at least one open port of either
 * type. The session is ref-counted across both port kinds and owns:
 *
 *   - the tab-telemetry tracking reason
 *   - subscriptions to fire and request-observation streams
 *   - HAR + fire ring buffers replayed to late-connecting inspector ports
 *   - per-URL FIFO of in-flight `(requestId, t)` pairs used to attach a
 *     deterministic join key to outgoing HAR messages
 *
 * The first port to open creates the session and primes its subscriptions.
 * The last port to close tears it down.
 *
 * ## Deterministic fire ↔ HAR join
 *
 * Chrome's HAR entries do not carry a stable identifier per request. The
 * panel needs to join rule fires (which carry `requestId` from webRequest)
 * to HAR rows. We attach the requestId in the background, where both views
 * are visible:
 *
 *   1. Every webRequest `onBeforeRequest` is recorded as a `RequestObservation`
 *      via `recordRequestObservation`. This module subscribes to that stream
 *      and pushes `(requestId, t)` into a per-URL FIFO scoped to the tab.
 *   2. When a HAR entry arrives from devtools_page, we pop the oldest
 *      in-flight entry for that URL whose timestamp is plausibly close to
 *      the HAR's `startedDateTime`, and emit the requestId alongside the
 *      HAR message as `chromeRequestId`.
 *   3. The panel store joins fires to HAR rows by requestId. URL + window
 *      matching is kept only as a fallback for HAR entries that arrived
 *      before tracking was active (e.g. very early requests on a cold tab).
 */

import type {
  HarSourceMessage,
  InspectorHarBody,
  InspectorHarEntry,
  InspectorNavTiming,
  InspectorPortMessage,
  InspectorRequestCompleted,
  InspectorRequestError,
  InspectorRequestRedirect,
  InspectorRequestStarted,
  RequestRecord,
} from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { buildRuleSnapshot } from '@openheaders/oracle/rule-engine/rule-snapshot';
import { subscribeRequestCompletions } from './devtools-inspector-completions';
import { lookupCorsContext, subscribeCorsTracking } from './devtools-inspector-cors';
import { subscribeRequestErrors } from './devtools-inspector-errors';
import {
  isTracked,
  startTracking,
  stopTracking,
  subscribeFires,
  subscribeRequestEvents,
  subscribeRequestRedirects,
} from './tab-telemetry';

export type {
  HarSourceMessage,
  InspectorHarBody,
  InspectorHarEntry,
  InspectorNavTiming,
  InspectorPortMessage,
} from '@openheaders/core/types';

/** Prefix for panel-facing devtools-inspector port names. */
const INSPECTOR_PREFIX = 'devtools-inspector:';
/** Prefix for devtools_page-facing HAR source port names. */
const HAR_SOURCE_PREFIX = 'devtools-har-source:';

/** Tracking reason owned by this module's per-tab session. */
function trackingReason(tabId: number): string {
  return `devtools-session:${tabId}`;
}

function parsePortName(name: string, prefix: string): number | null {
  if (!name.startsWith(prefix)) return null;
  const parsed = Number.parseInt(name.slice(prefix.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// ── Per-tab session ────────────────────────────────────────────────

/** Buffered HAR/fire messages, replayed to late-connecting inspector ports. */
type BufferedHarMessage =
  | { type: 'har'; entry: InspectorHarEntry; chromeRequestId?: string }
  | { type: 'har-body'; body: InspectorHarBody };

type BufferedFireMessage = { type: 'fire'; record: RequestRecord; authoritative: boolean };

type BufferedErrorMessage = { type: 'request-error'; error: InspectorRequestError };

type BufferedStartedMessage = { type: 'request-started'; event: InspectorRequestStarted };

type BufferedCompletedMessage = { type: 'request-completed'; event: InspectorRequestCompleted };

type BufferedRedirectMessage = { type: 'request-redirect'; event: InspectorRequestRedirect };

/** Cap on per-tab ring buffers — keeps memory bounded on long DevTools sessions. */
const HAR_BUFFER_MAX = 500;
const FIRE_BUFFER_MAX = 1000;
/** Cap on per-tab error buffer — pathological pages (CSP-misconfigured,
 *  ad-blocker storms) can fire thousands of `onErrorOccurred` events. */
const ERROR_BUFFER_MAX = 1000;
/** Cap on per-tab started-row buffer — a noisy page can fire many
 *  onBeforeRequest events per second; the panel only needs the most
 *  recent batch to repopulate after a port reconnect. */
const STARTED_BUFFER_MAX = 1000;
/** Cap on per-tab completed-event buffer — same rationale as the
 *  started buffer; the panel resolves pending rows from these on
 *  reconnect. */
const COMPLETED_BUFFER_MAX = 1000;
/** Cap on per-tab redirect-event buffer — redirect chains are rare; a
 *  generous cap covers worst-case pathological loops. */
const REDIRECT_BUFFER_MAX = 1000;
/** Max age for an in-flight (requestId, t) entry before we drop it as stale. */
const IN_FLIGHT_MAX_AGE_MS = 60_000;
/**
 * Tolerated clock skew between webRequest's `Date.now()` (in-flight entry's
 * `t`) and HAR's `Date.parse(startedDateTime)` for the *same* request.
 * Both clocks are wall-clock in the same process, so they should agree to
 * within a few ms — a generous 1s window covers any reordering Chrome
 * might inject without blunting the asymmetric "head is for a newer
 * request than this HAR" mis-attribution check.
 */
const POP_FUTURE_SKEW_MS = 1_000;
/**
 * LRU cap on the in-flight URL map. Each entry holds the FIFO of pending
 * `(requestId, t)` pairs awaiting their HAR row. URLs that produce a HAR
 * are popped to empty and removed by `popMatchingRequestId`; URLs that
 * never do (cancelled, served from bfcache, blocked before flight) sit
 * here until evicted. The cap caps total memory at roughly
 * `MAX_IN_FLIGHT_URLS * (URL string + a tiny queue) ≈ a couple hundred KB`
 * even on pathologically noisy tabs. The LRU keeps freshly-active URLs.
 */
const MAX_IN_FLIGHT_URLS = 5_000;

interface InFlightEntry {
  requestId: string;
  /** webRequest `Date.now()` at onBeforeRequest. Used to weed out stale entries
   *  whose corresponding HAR never showed up (cancelled, served from bfcache). */
  t: number;
  /** HTTP method — disambiguates a cross-origin POST from its internally-
   *  generated preflight OPTIONS, which share a URL but arrive in opposite
   *  orders on the webRequest side (POST first) vs the HAR side (OPTIONS
   *  first). Without this, the FIFO swaps requestIds between the two. */
  method: string;
}

interface TabSession {
  tabId: number;
  /** Number of open ports (har-source + inspector) tied to this session. */
  refCount: number;
  inspectorPorts: Set<chrome.runtime.Port>;
  harBuffer: BufferedHarMessage[];
  fireBuffer: BufferedFireMessage[];
  errorBuffer: BufferedErrorMessage[];
  startedBuffer: BufferedStartedMessage[];
  completedBuffer: BufferedCompletedMessage[];
  redirectBuffer: BufferedRedirectMessage[];
  /** Per-URL FIFO of in-flight webRequest observations, head = oldest. */
  inFlightByUrl: Map<string, InFlightEntry[]>;
  unsubscribeFires: () => void;
  unsubscribeRequestEvents: () => void;
  unsubscribeRequestErrors: () => void;
  unsubscribeRequestCompletions: () => void;
  unsubscribeRequestRedirects: () => void;
  unsubscribeCorsTracking: () => void;
}

const sessions: Map<number, TabSession> = new Map();

function pushBounded<T>(buffer: T[], msg: T, max: number): void {
  buffer.push(msg);
  if (buffer.length > max) buffer.splice(0, buffer.length - max);
}

function recordInFlight(session: TabSession, url: string, requestId: string, t: number, method: string): void {
  // Sweep stale FIFO entries first, *before* moving the URL to the LRU
  // tail — so the iteration position reflects actual live in-flight
  // requests rather than a queue of long-cancelled ones still tying up
  // the slot. webRequest sometimes reports requests that never produce
  // a HAR entry (cancelled, BFCache restore, Chrome internal redirects);
  // without this sweep, stale heads would poison the FIFO and the next
  // HAR hit on the same URL would mis-attribute.
  let queue = session.inFlightByUrl.get(url);
  if (queue) {
    const cutoff = t - IN_FLIGHT_MAX_AGE_MS;
    while (queue.length > 0 && queue[0].t < cutoff) queue.shift();
    // Touch-to-end via delete + re-set. JS Maps preserve insertion
    // order; re-inserting an existing key is the standard LRU idiom.
    session.inFlightByUrl.delete(url);
  } else {
    queue = [];
  }
  session.inFlightByUrl.set(url, queue);
  queue.push({ requestId, t, method });
  // Bound the total URL count. URLs that never produce a HAR entry stay
  // in the map until evicted here; the iteration-order eviction drops
  // the least-recently-touched URL first. Eviction is silent in the
  // happy path (the queue we drop is empty or holds a long-cancelled
  // request) but logs at debug level so we can tell from a verbose
  // session whether the cap is ever actually being hit in the wild —
  // any non-empty eviction means we lost a join key for that request.
  while (session.inFlightByUrl.size > MAX_IN_FLIGHT_URLS) {
    const oldest = session.inFlightByUrl.keys().next().value;
    if (oldest === undefined) break;
    const evictedQueue = session.inFlightByUrl.get(oldest);
    session.inFlightByUrl.delete(oldest);
    if (evictedQueue && evictedQueue.length > 0) {
      logger.debug(
        'DevtoolsInspectorPort',
        `In-flight LRU evicted url=${oldest} with ${evictedQueue.length} pending entries (tab=${session.tabId}) — corresponding HARs will fall back to URL+window matching`,
      );
    }
  }
}

function popMatchingRequestId(
  session: TabSession,
  url: string,
  harTimestamp: number,
  harMethod: string,
): string | undefined {
  const queue = session.inFlightByUrl.get(url);
  if (!queue || queue.length === 0) return undefined;
  // Two-sided plausibility window with deliberately asymmetric handling:
  //
  //   - `head.t < harTimestamp - IN_FLIGHT_MAX_AGE_MS` — stale entries
  //     are *dead*. The FIFO head is so old its own HAR was lost
  //     (cancelled, evicted). Drop it and reconsider the next entry;
  //     Chrome processes `onBeforeRequest` events in order, so an
  //     older head with a missing HAR cannot belong to *this* HAR
  //     either.
  //
  //   - `head.t > harTimestamp + POP_FUTURE_SKEW_MS` — future entries
  //     are *live*. The FIFO head is for a request started *after*
  //     this HAR's request — i.e. this HAR's own webRequest entry was
  //     evicted/cancelled before its HAR landed. Popping would mis-
  //     attribute a future requestId to a past HAR. We leave the head
  //     in the queue (its real HAR is on its way) and return undefined
  //     so the panel falls back to URL+window matching for *this* row
  //     only. Subsequent HARs continue to pop correctly — a single
  //     mis-ordered HAR degrades, never a cascade.
  const lower = harTimestamp - IN_FLIGHT_MAX_AGE_MS;
  while (queue.length > 0 && queue[0].t < lower) queue.shift();
  if (queue.length === 0) {
    session.inFlightByUrl.delete(url);
    return undefined;
  }
  // Method-aware FIFO: scan for the first entry whose method matches the
  // HAR's. Necessary for preflight-bearing requests (e.g. cross-origin POST
  // with a custom header) where webRequest order (POST then internal OPTIONS)
  // reverses HAR delivery order (OPTIONS then POST). Within a single method
  // the queue order is still strict FIFO. Fallback to the head when no entry
  // matches (e.g. HAR with empty method) preserves prior single-method
  // behavior.
  let idx = -1;
  if (harMethod) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].method === harMethod) {
        idx = i;
        break;
      }
    }
  }
  if (idx === -1) idx = 0;
  const entry = queue[idx];
  if (entry.t > harTimestamp + POP_FUTURE_SKEW_MS) return undefined;
  queue.splice(idx, 1);
  if (queue.length === 0) session.inFlightByUrl.delete(url);
  return entry.requestId;
}

function broadcastToInspectorPorts(session: TabSession, message: InspectorPortMessage): void {
  for (const port of session.inspectorPorts) {
    try {
      port.postMessage(message);
    } catch {
      // Disconnect races are handled by onDisconnect.
    }
  }
}

function handleFireRecord(session: TabSession, record: RequestRecord, authoritative: boolean): void {
  // Snapshot here, at the panel-bound boundary, so the panel sees an
  // immutable record of the rule as it was at fire time. Done once per
  // emit (live broadcast + ring-buffer entry share the same record
  // reference, so the freeze is a single allocation). If the rule was
  // already gone from the registry by the time we snapshot, ship the
  // record without a snapshot — the panel falls back to a "rule no
  // longer exists" affordance for that fire.
  const enriched = record.ruleSnapshot
    ? record
    : ((): RequestRecord => {
        const snapshot = buildRuleSnapshot(record.ruleUid);
        return snapshot ? { ...record, ruleSnapshot: snapshot } : record;
      })();
  const msg: BufferedFireMessage = { type: 'fire', record: enriched, authoritative };
  if (session.inspectorPorts.size > 0) {
    broadcastToInspectorPorts(session, msg);
  }
  pushBounded(session.fireBuffer, msg, FIRE_BUFFER_MAX);
}

function handleHarMessage(session: TabSession, entry: InspectorHarEntry): void {
  // Correlate before broadcasting so both live and replay paths carry the
  // join key. The panel store treats `chromeRequestId` as the primary
  // join key; we deliberately do NOT mutate the HAR's wire fields, only
  // the auxiliary `response._error` (see refineHarCorsError below).
  //
  // Timestamp trust asymmetry: HAR's `startedDateTime` is parsed from a
  // string the devtools_page forwarded — it can be NaN if Chrome ever
  // emits a malformed value, hence the `Number.isFinite` guard. The
  // in-flight `t` values come from our own `Date.now()` calls in
  // `recordRequestObservation` and are always finite by construction.
  const harUrl = entry.request?.url ?? '';
  const harMethod = entry.request?.method ?? '';
  const harTs = Date.parse(entry.startedDateTime);
  const chromeRequestId =
    harUrl && Number.isFinite(harTs) ? popMatchingRequestId(session, harUrl, harTs, harMethod) : undefined;
  if (chromeRequestId) refineHarCorsError(session.tabId, chromeRequestId, entry);
  const outgoing: BufferedHarMessage = { type: 'har', entry, chromeRequestId };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, outgoing);
  pushBounded(session.harBuffer, outgoing, HAR_BUFFER_MAX);
}

/**
 * Refine `response._error` from the generic `net::ERR_FAILED` to a CORS-
 * specific code when the captured CORS context indicates the response
 * failed the browser's cross-origin check. The panel lifts `_error` onto
 * `entry.error` in `ingestHarEntry`; refining it here means the panel's
 * classifier sees the refined code without needing CORS awareness of
 * its own. Mirrors the parallel refinement in `devtools-inspector-errors.ts`
 * so requests that produce only an `onErrorOccurred` (no HAR) get the
 * same treatment.
 */
function refineHarCorsError(tabId: number, requestId: string, entry: InspectorHarEntry): void {
  const response = entry.response;
  if (!response || response._error !== 'net::ERR_FAILED') return;
  const ctx = lookupCorsContext(tabId, requestId);
  if (!ctx || !ctx.isCrossOrigin) return;
  if (ctx.rejection.kind === 'missing-acao') response._error = 'oh:cors-missing-acao';
  else if (ctx.rejection.kind === 'origin-mismatch') response._error = 'oh:cors-origin-mismatch';
}

function handleHarBodyMessage(session: TabSession, body: InspectorHarBody): void {
  const outgoing: BufferedHarMessage = { type: 'har-body', body };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, outgoing);
  pushBounded(session.harBuffer, outgoing, HAR_BUFFER_MAX);
}

function handleRequestError(session: TabSession, error: InspectorRequestError): void {
  const msg: BufferedErrorMessage = { type: 'request-error', error };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, msg);
  pushBounded(session.errorBuffer, msg, ERROR_BUFFER_MAX);
}

function handleRequestStarted(session: TabSession, event: InspectorRequestStarted): void {
  const msg: BufferedStartedMessage = { type: 'request-started', event };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, msg);
  pushBounded(session.startedBuffer, msg, STARTED_BUFFER_MAX);
}

function handleRequestCompleted(session: TabSession, event: InspectorRequestCompleted): void {
  const msg: BufferedCompletedMessage = { type: 'request-completed', event };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, msg);
  pushBounded(session.completedBuffer, msg, COMPLETED_BUFFER_MAX);
}

function handleRequestRedirect(session: TabSession, event: InspectorRequestRedirect): void {
  const msg: BufferedRedirectMessage = { type: 'request-redirect', event };
  if (session.inspectorPorts.size > 0) broadcastToInspectorPorts(session, msg);
  pushBounded(session.redirectBuffer, msg, REDIRECT_BUFFER_MAX);
}

function flushBuffers(session: TabSession, port: chrome.runtime.Port): void {
  // HAR entries first, so a fire that references a request whose HAR was
  // already buffered finds its row on arrival. Fires carry their own
  // requestId; the order between the two streams is informational only,
  // never required for correctness.
  //
  // Failure semantics: a `postMessage` throw on a Chrome runtime port is
  // (in practice) only raised when the port is dead. We treat it as
  // "abort the rest of the flush" — pushing more messages would also
  // throw, and `port.onDisconnect` will run next to tear down the
  // session bookkeeping. Not "skip this message and continue."
  for (const msg of session.harBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
  for (const msg of session.fireBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
  for (const msg of session.errorBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
  // started-row replays come last so a reconnected panel sees completed
  // / errored entries first and only then is told about still-in-flight
  // rows — minimizes the pending → resolved flicker on reconnect.
  for (const msg of session.startedBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
  for (const msg of session.completedBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
  // Redirects must replay AFTER started events so the panel has the
  // pending source-hop row to upgrade in place. A redirect that arrived
  // before its corresponding start would mint a free-standing row, then
  // the start would create a second one — exactly the duplication we're
  // here to prevent.
  for (const msg of session.redirectBuffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      return;
    }
  }
}

function ensureSession(tabId: number): TabSession {
  const existing = sessions.get(tabId);
  if (existing) {
    existing.refCount++;
    return existing;
  }
  const alreadyTracked = isTracked(tabId);
  startTracking(tabId, trackingReason(tabId));
  const session: TabSession = {
    tabId,
    refCount: 1,
    inspectorPorts: new Set(),
    harBuffer: [],
    fireBuffer: [],
    errorBuffer: [],
    startedBuffer: [],
    completedBuffer: [],
    redirectBuffer: [],
    inFlightByUrl: new Map(),
    unsubscribeFires: () => {},
    unsubscribeRequestEvents: () => {},
    unsubscribeRequestErrors: () => {},
    unsubscribeRequestCompletions: () => {},
    unsubscribeRequestRedirects: () => {},
    unsubscribeCorsTracking: () => {},
  };
  // CORS tracking must subscribe BEFORE the error relay so the relay's
  // `onErrorOccurred` listener can consult populated CORS context. Chrome
  // dispatches `webRequest` listeners in registration order.
  session.unsubscribeCorsTracking = subscribeCorsTracking(tabId);
  // Subscribe BEFORE returning so any fire/observation that happens between
  // session creation and the caller's first message is captured.
  session.unsubscribeFires = subscribeFires(tabId, (record) => {
    handleFireRecord(session, record, false);
  });
  session.unsubscribeRequestEvents = subscribeRequestEvents(tabId, (event) => {
    // Two side effects:
    //   1. Record into the per-URL in-flight FIFO so HAR ↔ requestId
    //      correlation still works (existing fire-join behavior).
    //   2. Broadcast a `request-started` to the panel so it can mint a
    //      pending row immediately, mirroring Chrome's Network UI which
    //      renders rows from `Network.requestWillBeSent`. webRequest's
    //      `onBeforeRequest` is the closest extension-API equivalent.
    recordInFlight(session, event.url, event.requestId, event.timestamp, event.method);
    handleRequestStarted(session, {
      requestId: event.requestId,
      url: event.url,
      method: event.method,
      resourceType: event.resourceType,
      timestamp: new Date(event.timestamp).toISOString(),
      ...(event.initiator ? { initiator: event.initiator } : {}),
    });
  });
  session.unsubscribeRequestErrors = subscribeRequestErrors(tabId, {
    send: (error) => handleRequestError(session, error),
  });
  session.unsubscribeRequestCompletions = subscribeRequestCompletions(tabId, {
    send: (event) => handleRequestCompleted(session, event),
  });
  session.unsubscribeRequestRedirects = subscribeRequestRedirects(tabId, (event) => {
    handleRequestRedirect(session, {
      requestId: event.requestId,
      sourceUrl: event.sourceUrl,
      method: event.method,
      resourceType: event.resourceType,
      statusCode: event.statusCode,
      redirectUrl: event.redirectUrl,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  });
  sessions.set(tabId, session);
  logger.debug(
    'DevtoolsInspectorPort',
    `Session opened for tab ${tabId} (telemetry already tracked=${alreadyTracked})`,
  );
  return session;
}

function releaseSession(tabId: number): void {
  const session = sessions.get(tabId);
  if (!session) return;
  session.refCount--;
  if (session.refCount > 0) return;
  session.unsubscribeFires();
  session.unsubscribeRequestEvents();
  session.unsubscribeRequestErrors();
  session.unsubscribeRequestCompletions();
  session.unsubscribeRequestRedirects();
  session.unsubscribeCorsTracking();
  stopTracking(tabId, trackingReason(tabId));
  sessions.delete(tabId);
  logger.debug('DevtoolsInspectorPort', `Session closed for tab ${tabId}`);
}

/**
 * Broadcast an authoritative fire record to every open inspector port
 * for the given tab. Called from the onRuleMatchedDebug wiring on
 * Chrome/Edge. Separate from the `subscribeFires` path so the panel
 * can distinguish "Chrome told us this rule actually executed" from
 * "the URL matched the rule's conditions." Silent no-op on tabs with
 * no live session — the onRuleMatchedDebug listener is global and the
 * gating lives here.
 */
export function broadcastAuthoritativeFire(tabId: number, record: RequestRecord): void {
  const session = sessions.get(tabId);
  if (!session) return;
  handleFireRecord(session, record, true);
}

let portsSetupDone = false;

export function setupDevtoolsInspectorPorts(): void {
  if (portsSetupDone) return;
  portsSetupDone = true;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('DevtoolsInspectorPort', 'runtime.onConnect unavailable — inspector ports disabled');
    return;
  }
  chrome.runtime.onConnect.addListener((port) => {
    const harTabId = parsePortName(port.name, HAR_SOURCE_PREFIX);
    if (harTabId != null) {
      acceptHarSourcePort(harTabId, port);
      return;
    }
    const inspectorTabId = parsePortName(port.name, INSPECTOR_PREFIX);
    if (inspectorTabId != null) {
      acceptInspectorPort(inspectorTabId, port);
    }
  });
}

function acceptHarSourcePort(tabId: number, port: chrome.runtime.Port): void {
  const session = ensureSession(tabId);
  port.onMessage.addListener((msg: HarSourceMessage) => {
    if (msg?.type === 'har' && msg.entry) {
      handleHarMessage(session, msg.entry);
      return;
    }
    if (
      msg?.type === 'har-body' &&
      typeof msg.method === 'string' &&
      typeof msg.url === 'string' &&
      typeof msg.startedDateTime === 'string'
    ) {
      handleHarBodyMessage(session, {
        method: msg.method,
        url: msg.url,
        startedDateTime: msg.startedDateTime,
        content: msg.content ?? '',
        encoding: msg.encoding ?? '',
      });
      return;
    }
    if (msg?.type === 'nav' && typeof msg.url === 'string') {
      // Live-only: a buffered nav would replay on a late-connecting
      // inspector and wipe legitimate backlog from the HAR buffer.
      broadcastToInspectorPorts(session, { type: 'nav', url: msg.url });
      return;
    }
    if (msg?.type === 'nav-timing' && msg.timing && typeof msg.timing === 'object') {
      broadcastToInspectorPorts(session, { type: 'nav-timing', timing: msg.timing });
    }
  });
  port.onDisconnect.addListener(() => {
    releaseSession(tabId);
  });
}

function acceptInspectorPort(tabId: number, port: chrome.runtime.Port): void {
  const session = ensureSession(tabId);
  session.inspectorPorts.add(port);

  try {
    port.postMessage({ type: 'ready', tabId } satisfies InspectorPortMessage);
  } catch {
    // If the handshake itself fails, the disconnect handler will fire next
    // and clean up.
  }

  flushBuffers(session, port);

  port.onDisconnect.addListener(() => {
    session.inspectorPorts.delete(port);
    releaseSession(tabId);
  });
}

// ── Test helpers ───────────────────────────────────────────────────

export const __internals = {
  get sessionCount(): number {
    return sessions.size;
  },
  getSession(tabId: number): TabSession | undefined {
    return sessions.get(tabId);
  },
  reset(): void {
    for (const session of sessions.values()) {
      session.unsubscribeFires();
      session.unsubscribeRequestEvents();
      session.unsubscribeRequestErrors();
      session.unsubscribeRequestCompletions();
      session.unsubscribeRequestRedirects();
      session.unsubscribeCorsTracking();
    }
    sessions.clear();
    portsSetupDone = false;
  },
};
