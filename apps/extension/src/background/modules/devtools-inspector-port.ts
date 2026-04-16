/**
 * DevTools Inspector Port Handler — long-lived port between the
 * DevTools Inspector panel and the background service worker.
 *
 * ## Port name
 *
 *   `devtools-inspector:<tabId>`
 *
 * The panel reads `chrome.devtools.inspectedWindow.tabId` in the
 * devtools_page context and encodes it into the name so this handler
 * can route events to the right subscriber without a separate
 * subscription message hop.
 *
 * ## Lifecycle
 *
 *   1. Panel mounts → opens port.
 *   2. This handler accepts the connection, parses the tab id, starts
 *      tab-telemetry tracking for that tab under the
 *      `devtools:<tabId>` reason (so request-monitor begins ingesting
 *      observations), subscribes to the request-event stream and the
 *      inferred fire stream, and registers the port in the per-tab
 *      open-ports map so authoritative fires (from onRuleMatchedDebug
 *      on Chrome/Edge) can target it directly.
 *   3. Every observation / fire is posted over the port as a tagged
 *      message. The panel's data layer correlates request events with
 *      its HAR stream, and fires with its rule-executions view.
 *   4. On disconnect, this handler unsubscribes, removes the tracking
 *      reason (tearing down tab-telemetry state if no other consumer
 *      holds the tab), and drops the port from the map.
 *
 * Idempotent setup: safe to call `setupDevtoolsInspectorPorts` more
 * than once at extension start.
 */

import { logger } from '@utils/logger';
import { isTracked, type RequestRecord, startTracking, stopTracking, subscribeFires } from './tab-telemetry';

/** Prefix for panel-facing devtools-inspector port names. */
const INSPECTOR_PREFIX = 'devtools-inspector:';
/** Prefix for devtools_page-facing HAR source port names. */
const HAR_SOURCE_PREFIX = 'devtools-har-source:';

/** Tab-telemetry tracking reason for a devtools-inspector session. */
function trackingReason(tabId: number): string {
  return `devtools:${tabId}`;
}

function parseDevtoolsPortName(name: string): number | null {
  if (!name.startsWith(INSPECTOR_PREFIX)) return null;
  const raw = name.slice(INSPECTOR_PREFIX.length);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseHarSourcePortName(name: string): number | null {
  if (!name.startsWith(HAR_SOURCE_PREFIX)) return null;
  const raw = name.slice(HAR_SOURCE_PREFIX.length);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Full HAR entry forwarded verbatim from the devtools_page via
 * `chrome.devtools.network.onRequestFinished`. The shape matches the
 * HAR 1.2 spec that Chrome implements, plus the non-standard `_`-
 * prefixed extensions (`_initiator`, `_priority`, `_resourceType`,
 * `_webSocketMessages`, `_fromCache`) that DevTools annotates onto
 * each entry. The background doesn't interpret any of this — it just
 * relays entries to the panel's data layer.
 *
 * All fields are optional because the HAR format is structurally open
 * and future Chrome versions may add or remove `_`-prefixed metadata.
 * The panel's UI reads defensively through optional chaining.
 */
export interface InspectorHarEntry {
  startedDateTime: string;
  time?: number;
  request?: {
    method: string;
    url: string;
    httpVersion?: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    cookies?: Array<{ name: string; value: string }>;
    headersSize?: number;
    bodySize?: number;
    postData?: {
      mimeType: string;
      text?: string;
      params?: Array<{ name: string; value?: string }>;
    };
  };
  response?: {
    status: number;
    statusText: string;
    httpVersion?: string;
    headers: Array<{ name: string; value: string }>;
    cookies?: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      compression?: number;
      text?: string;
      encoding?: string;
    };
    redirectURL?: string;
    headersSize?: number;
    bodySize?: number;
  };
  cache?: unknown;
  timings?: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send?: number;
    wait?: number;
    receive?: number;
    ssl?: number;
  };
  serverIPAddress?: string;
  connection?: string;
  pageref?: string;
  _initiator?: unknown;
  _priority?: string;
  _resourceType?: string;
  _webSocketMessages?: unknown[];
  _fromCache?: string;
}

/** Response body payload fetched asynchronously via entry.getContent. */
export interface InspectorHarBody {
  method: string;
  url: string;
  startedDateTime: string;
  content: string;
  encoding: string;
}

/**
 * Wire format for messages posted over the port. Discriminated union
 * keyed by `type`. The panel's data layer parses incoming messages
 * against this shape.
 */
export type InspectorPortMessage =
  | { type: 'fire'; record: RequestRecord; authoritative: boolean }
  | { type: 'har'; entry: InspectorHarEntry }
  | { type: 'har-body'; body: InspectorHarBody }
  | { type: 'nav'; url: string }
  | { type: 'ready'; tabId: number };

/**
 * Open inspector ports, keyed by inspected tab id. A tab can have at
 * most one active DevTools window in Chrome's UI, but the Map<Set>
 * shape means we gracefully handle edge cases like a second DevTools
 * window being opened on the same tab (devtools-for-devtools).
 */
const openPorts: Map<number, Set<chrome.runtime.Port>> = new Map();

/**
 * Ring buffer of HAR messages per tab, populated by the devtools_page
 * HAR source port regardless of whether any inspector port is open.
 * When a panel connects, this buffer is flushed onto its port so the
 * user sees the backlog captured between DevTools open and clicking
 * the panel tab. Without this, requests that happen before the
 * inspector port exists are visible as background-only entries
 * (observation fires right away from webRequest) but never graduate
 * to `joined` because the HAR entry was broadcast to zero listeners.
 *
 * Separate ring per tab. Each ring caps at `HAR_BUFFER_MAX` so long
 * idle DevTools sessions don't grow unbounded. Buffered messages are
 * re-broadcast IN ORDER on flush so the store's correlation logic
 * sees them in the same temporal order as live events.
 */
type BufferedHarMessage = { type: 'har'; entry: InspectorHarEntry } | { type: 'har-body'; body: InspectorHarBody };

const HAR_BUFFER_MAX = 500;
const harBuffer: Map<number, BufferedHarMessage[]> = new Map();

function pushHarBuffer(tabId: number, msg: BufferedHarMessage): void {
  let buffer = harBuffer.get(tabId);
  if (!buffer) {
    buffer = [];
    harBuffer.set(tabId, buffer);
  }
  buffer.push(msg);
  if (buffer.length > HAR_BUFFER_MAX) {
    buffer.splice(0, buffer.length - HAR_BUFFER_MAX);
  }
}

function flushHarBuffer(tabId: number, port: chrome.runtime.Port): void {
  const buffer = harBuffer.get(tabId);
  if (!buffer || buffer.length === 0) return;
  for (const msg of buffer) {
    try {
      port.postMessage(msg satisfies InspectorPortMessage);
    } catch {
      // Race with disconnect — onDisconnect will clean up.
    }
  }
}

function addPort(tabId: number, port: chrome.runtime.Port): void {
  let set = openPorts.get(tabId);
  if (!set) {
    set = new Set();
    openPorts.set(tabId, set);
  }
  set.add(port);
}

function removePort(tabId: number, port: chrome.runtime.Port): void {
  const set = openPorts.get(tabId);
  if (!set) return;
  set.delete(port);
  if (set.size === 0) openPorts.delete(tabId);
}

function broadcastToInspectorPorts(tabId: number, message: InspectorPortMessage): void {
  const set = openPorts.get(tabId);
  if (!set || set.size === 0) return;
  for (const port of set) {
    try {
      port.postMessage(message);
    } catch {
      // Disconnect races are handled by onDisconnect.
    }
  }
}

/**
 * Broadcast an authoritative fire record to every open inspector port
 * for the given tab. Called from the onRuleMatchedDebug wiring on
 * Chrome/Edge. Separate from the `subscribeFires` path so the panel
 * can distinguish "Chrome told us this rule actually executed" from
 * "the URL matched the rule's conditions." Silent no-op on tabs with
 * no open port — the onRuleMatchedDebug listener is global and the
 * gating lives here.
 */
export function broadcastAuthoritativeFire(tabId: number, record: RequestRecord): void {
  broadcastToInspectorPorts(tabId, { type: 'fire', record, authoritative: true });
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
    // HAR source (from devtools_page) — relay to live inspector ports
    // AND stash into the per-tab ring buffer so late-connecting panels
    // can still see the backlog.
    const harTabId = parseHarSourcePortName(port.name);
    if (harTabId != null) {
      port.onMessage.addListener(
        (msg: { type?: string; entry?: InspectorHarEntry; url?: string } & Partial<InspectorHarBody>) => {
          if (msg?.type === 'har' && msg.entry) {
            const outgoing: InspectorPortMessage = { type: 'har', entry: msg.entry };
            broadcastToInspectorPorts(harTabId, outgoing);
            pushHarBuffer(harTabId, outgoing);
            return;
          }
          if (
            msg?.type === 'har-body' &&
            typeof msg.method === 'string' &&
            typeof msg.url === 'string' &&
            typeof msg.startedDateTime === 'string'
          ) {
            const outgoing: InspectorPortMessage = {
              type: 'har-body',
              body: {
                method: msg.method,
                url: msg.url,
                startedDateTime: msg.startedDateTime,
                content: msg.content ?? '',
                encoding: msg.encoding ?? '',
              },
            };
            broadcastToInspectorPorts(harTabId, outgoing);
            pushHarBuffer(harTabId, outgoing);
            return;
          }
          if (msg?.type === 'nav' && typeof msg.url === 'string') {
            // Navigation in the inspected window — relay to live
            // inspector ports so the panel can honor clear-on-nav.
            // Not buffered: a buffered nav would replay stale clears
            // on a late-connecting inspector and wipe legitimate
            // backlog from the HAR buffer. Live-only is correct.
            broadcastToInspectorPorts(harTabId, { type: 'nav', url: msg.url });
          }
        },
      );
      port.onDisconnect.addListener(() => {
        // DevTools window closed — drop the buffer to free memory.
        // A subsequent DevTools-reopen on the same tab will start with
        // a fresh buffer, which is the expected behavior.
        harBuffer.delete(harTabId);
      });
      return;
    }

    const tabId = parseDevtoolsPortName(port.name);
    if (tabId == null) return; // Not one of ours.

    const alreadyTracked = isTracked(tabId);
    startTracking(tabId, trackingReason(tabId));
    addPort(tabId, port);
    logger.debug('DevtoolsInspectorPort', `Port opened for tab ${tabId} (already tracked=${alreadyTracked})`);

    const unsubFires = subscribeFires(tabId, (record) => {
      try {
        port.postMessage({
          type: 'fire',
          record,
          authoritative: false,
        } satisfies InspectorPortMessage);
      } catch {
        // Port disconnect races are handled by onDisconnect below.
      }
    });

    try {
      port.postMessage({ type: 'ready', tabId } satisfies InspectorPortMessage);
    } catch {
      // If posting the handshake already fails, the disconnect handler
      // will fire next and clean up.
    }

    // Flush any HAR entries that arrived before this inspector port
    // connected. Ordering is preserved so the store's correlation
    // window behaves identically to the live path.
    flushHarBuffer(tabId, port);

    port.onDisconnect.addListener(() => {
      unsubFires();
      removePort(tabId, port);
      stopTracking(tabId, trackingReason(tabId));
      logger.debug('DevtoolsInspectorPort', `Port closed for tab ${tabId}`);
    });
  });
}
