/**
 * DevTools page entry — runs inside Chrome DevTools when the user opens
 * DevTools on any tab. Two jobs:
 *
 *   1. Register the "Open Headers" panel via `chrome.devtools.panels.create`.
 *
 *   2. Bridge `chrome.devtools.network.onRequestFinished` into the
 *      background service worker. For each finished request we send
 *      two messages over the port:
 *        - `har`      — the full HAR entry (minus the `getContent`
 *                       function, which JSON serialization strips).
 *                       Carries every field DevTools exposes: request,
 *                       response, timings, cache, _initiator, _priority,
 *                       _resourceType, _webSocketMessages, etc.
 *        - `har-body` — the response body text + encoding, fetched
 *                       asynchronously via `entry.getContent`. Sent as
 *                       a separate message keyed on
 *                       (method, url, startedDateTime) so the panel's
 *                       store can attach it to the previously-delivered
 *                       HAR entry.
 *
 * The HAR bridge port is named `devtools-har-source:<tabId>` so the
 * background handler can route each HAR entry to the right inspector
 * session.
 *
 * ## Service worker eviction
 *
 * In MV3, the background service worker is evicted after idle periods.
 * When that happens, our port disconnects and Chrome wakes the SW up
 * again only on the next incoming event. The HAR listener is installed
 * once (DevTools API, process-scoped) so it keeps running, but our
 * forwarding port is dead until we reopen it. The `ensurePort` helper
 * reconnects on every forward attempt — cheap because `runtime.connect`
 * is a synchronous call — and re-establishes the port on demand
 * without needing an explicit retry loop.
 *
 * Must stay small: this file runs every time DevTools opens on any tab.
 */

// Per-engine quirks for the panel tab visual:
//   - Chromium ignores the `iconPath` argument entirely (no icon ever
//     renders next to the panel title), so we rely on a Unicode glyph
//     prefix in the title for a visual marker.
//   - Firefox honors `iconPath` AND falls back to the manifest icon
//     when the argument is empty. The fallback path renders the
//     extension icon at a larger, crisper size than the explicit 16px
//     asset — so we pass an empty string and skip the title prefix to
//     avoid a doubled-icon tab.
const isFirefox = /Firefox/.test(navigator.userAgent);
chrome.devtools.panels.create(
  isFirefox ? 'Open Headers' : '🟦 Open Headers',
  isFirefox ? '' : 'images/icon16.png',
  'panel.html',
);

// Eagerly load panel.html in a hidden iframe when the parity capture script has set the flag.
chrome.storage.local.get('__oh_parity_hook__', (res) => {
  if (!res?.__oh_parity_hook__) return;
  const iframe = document.createElement('iframe');
  iframe.src = 'panel.html';
  iframe.style.display = 'none';
  iframe.title = 'oh-parity-hook';
  document.body.appendChild(iframe);
});

const tabId = chrome.devtools.inspectedWindow.tabId;

let port: chrome.runtime.Port | null = null;

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  const next = chrome.runtime.connect({ name: `devtools-har-source:${tabId}` });
  next.onDisconnect.addListener(() => {
    // Typically this fires when the background SW is evicted. The
    // next forward call will lazy-reconnect.
    if (port === next) port = null;
  });
  port = next;
  return next;
}

function postToBackground(msg: unknown): void {
  try {
    ensurePort().postMessage(msg);
  } catch {
    // Port died mid-post; drop the cached reference so the next
    // forward starts a fresh connection.
    port = null;
  }
}

// Navigation forwarding — matches Chrome's Network tab default of
// clearing the log when the inspected window navigates. The panel
// honors this only when its "Preserve log" toggle is off.
chrome.devtools.network.onNavigated.addListener((url: string) => {
  postToBackground({ type: 'nav', url });
  scheduleNavTimingSample();
  // A new document resets the Resource Timing buffer — drop the change
  // floor so the first post of the new page always lands.
  lastResourceCount = -1;
  scheduleResourceTimingSample();
});

/**
 * Snapshot Navigation Timing from the inspected window and forward it
 * over the HAR source port. Returns whether the load event has fired,
 * letting the caller decide when polling can stop. One eval per tick.
 *
 * Uses Navigation Timing L2 (`performance.getEntriesByType('navigation')[0]`)
 * and falls back to the deprecated `performance.timing` API for older
 * Chromium contexts.
 */
interface NavTimingProbeResult {
  pageOrigin: string | null;
  dclMs?: number;
  loadMs?: number;
}

/** Chrome's eval exception info — the second arg to the callback. */
interface EvalExceptionInfo {
  isError?: boolean;
  isException?: boolean;
  value?: string;
  code?: string;
  description?: string;
}

const NAV_TIMING_EXPR = `(() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      return {
        pageOrigin: location.origin,
        dclMs: nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : undefined,
        loadMs: nav.loadEventEnd > 0 ? nav.loadEventEnd : undefined,
      };
    }
    const t = performance.timing;
    const nstart = t.navigationStart || 0;
    return {
      pageOrigin: location.origin,
      dclMs: t.domContentLoadedEventEnd > 0 ? t.domContentLoadedEventEnd - nstart : undefined,
      loadMs: t.loadEventEnd > 0 ? t.loadEventEnd - nstart : undefined,
    };
  } catch (e) {
    return { pageOrigin: null };
  }
})()`;

function sampleNavTiming(onResult: (loadFired: boolean) => void): void {
  chrome.devtools.inspectedWindow.eval(
    NAV_TIMING_EXPR,
    (result: NavTimingProbeResult | null, err?: EvalExceptionInfo) => {
      if (err || !result) {
        onResult(false);
        return;
      }
      postToBackground({
        type: 'nav-timing',
        timing: {
          pageOrigin: result.pageOrigin ?? null,
          dclMs: result.dclMs,
          loadMs: result.loadMs,
        },
      });
      onResult((result.loadMs ?? 0) > 0);
    },
  );
}

/**
 * Poll Navigation Timing until the load event has fired or the budget
 * expires. A devtools page can't receive the page's own load events
 * without attaching a debugger, so we sample `performance` instead — on
 * a ramped cadence: tight (100ms) for the first couple of seconds so a
 * fast page surfaces DOMContentLoaded / Load almost immediately, then
 * backing off (500ms) for the long tail of slow pages. Each eval returns
 * under a millisecond, and sampling stops the moment the load lands.
 */
const NAV_TIMING_FAST_MS = 100;
const NAV_TIMING_FAST_WINDOW_MS = 2000;
const NAV_TIMING_SLOW_MS = 500;
const NAV_TIMING_MAX_MS = 20_000;

let navTimingTimer: ReturnType<typeof setTimeout> | null = null;
let navTimingElapsedMs = 0;

function stopNavTimingPoll(): void {
  if (navTimingTimer != null) clearTimeout(navTimingTimer);
  navTimingTimer = null;
}

function scheduleNavTimingSample(): void {
  stopNavTimingPoll();
  navTimingElapsedMs = 0;
  // Self-scheduling so the next eval only fires after the previous one
  // resolves — never stacking round-trips at the inspected window.
  const tick = () => {
    sampleNavTiming((loadFired) => {
      if (loadFired || navTimingElapsedMs >= NAV_TIMING_MAX_MS) {
        stopNavTimingPoll();
        return;
      }
      const delay = navTimingElapsedMs < NAV_TIMING_FAST_WINDOW_MS ? NAV_TIMING_FAST_MS : NAV_TIMING_SLOW_MS;
      navTimingElapsedMs += delay;
      navTimingTimer = setTimeout(tick, delay);
    });
  };
  tick();
}

// Kick off an initial sample — the panel may open on an already-loaded
// page, in which case no onNavigated fires but Navigation Timing is
// already populated.
scheduleNavTimingSample();

/**
 * Snapshot the inspected page's Resource Timing buffer and forward it.
 *
 * This is the only banner-free source for renderer in-process cache
 * hits: a resource served from the renderer's memory cache never reaches
 * the network service, so no `webRequest` / HAR event fires for it, yet
 * it still records a `PerformanceResourceTiming` entry (with
 * `transferSize` 0). The panel reconciles this snapshot against its real
 * rows to surface the otherwise-invisible hits.
 *
 * The buffer is cumulative and append-only within a document, so each
 * snapshot supersedes the prior. We skip the forward when the entry
 * count is unchanged since the last post — a cheap "nothing new" gate
 * that avoids waking the background for an identical snapshot.
 */
const RESOURCE_TIMING_EXPR = `(() => {
  try {
    const origin = performance.timeOrigin || (Date.now() - performance.now());
    const list = performance.getEntriesByType('resource');
    const entries = [];
    for (const e of list) {
      entries.push({
        name: e.name,
        initiatorType: e.initiatorType || '',
        nextHopProtocol: e.nextHopProtocol || '',
        startTime: e.startTime || 0,
        duration: e.duration || 0,
        transferSize: e.transferSize || 0,
        encodedBodySize: e.encodedBodySize || 0,
        decodedBodySize: e.decodedBodySize || 0,
        deliveryType: e.deliveryType || '',
        responseStatus: typeof e.responseStatus === 'number' ? e.responseStatus : 0,
      });
    }
    return { timeOriginMs: origin, entries };
  } catch (e) {
    return { timeOriginMs: 0, entries: [] };
  }
})()`;

interface ResourceTimingProbeResult {
  timeOriginMs: number;
  entries: {
    name: string;
    initiatorType: string;
    nextHopProtocol: string;
    startTime: number;
    duration: number;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
    deliveryType: string;
    responseStatus?: number;
  }[];
}

let lastResourceCount = -1;

function sampleResourceTiming(): void {
  chrome.devtools.inspectedWindow.eval(
    RESOURCE_TIMING_EXPR,
    (result: ResourceTimingProbeResult | null, err?: EvalExceptionInfo) => {
      if (err || !result) return;
      if (result.entries.length === lastResourceCount) return;
      lastResourceCount = result.entries.length;
      postToBackground({
        type: 'resource-timing',
        timeOriginMs: result.timeOriginMs,
        entries: result.entries,
      });
    },
  );
}

let resourceTimingTimer: ReturnType<typeof setTimeout> | null = null;
let resourceTimingElapsedMs = 0;

function stopResourceTimingPoll(): void {
  if (resourceTimingTimer != null) clearTimeout(resourceTimingTimer);
  resourceTimingTimer = null;
}

/**
 * Poll the Resource Timing buffer on the same ramped cadence as
 * navigation timing — tight early so the bulk of load-time cache hits
 * surface fast, backing off for the long tail. Unlike nav timing there
 * is no single "done" event (lazy resources keep arriving), so the poll
 * runs to the budget ceiling and the change-count gate suppresses
 * no-op forwards.
 */
function scheduleResourceTimingSample(): void {
  stopResourceTimingPoll();
  resourceTimingElapsedMs = 0;
  const tick = () => {
    sampleResourceTiming();
    if (resourceTimingElapsedMs >= NAV_TIMING_MAX_MS) {
      stopResourceTimingPoll();
      return;
    }
    const delay = resourceTimingElapsedMs < NAV_TIMING_FAST_WINDOW_MS ? NAV_TIMING_FAST_MS : NAV_TIMING_SLOW_MS;
    resourceTimingElapsedMs += delay;
    resourceTimingTimer = setTimeout(tick, delay);
  };
  tick();
}

scheduleResourceTimingSample();

chrome.devtools.network.onRequestFinished.addListener((entry) => {
  try {
    // Serialize the HAR entry verbatim. Chrome's port.postMessage uses
    // JSON under the hood, so the `getContent` function property is
    // silently dropped — an explicit JSON round-trip avoids relying on
    // that implementation detail and makes the shipped payload
    // auditable.
    const serializable = JSON.parse(JSON.stringify(entry));
    postToBackground({ type: 'har', entry: serializable });

    // Fetch the response body asynchronously and post a follow-up so
    // the panel can attach it to the entry it already rendered. This
    // is the only way to retrieve bodies in MV3 DevTools extensions —
    // the webRequest layer can't see them.
    entry.getContent((content: string | null, encoding: string) => {
      postToBackground({
        type: 'har-body',
        method: entry.request.method,
        url: entry.request.url,
        startedDateTime: entry.startedDateTime,
        content: content ?? '',
        encoding,
      });
    });
  } catch {
    // Never let a HAR forwarding failure crash the devtools_page — it
    // would prevent the panel from registering at all.
  }
});
