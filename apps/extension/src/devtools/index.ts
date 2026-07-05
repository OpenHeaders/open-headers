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

import { harSourcePortName } from '@openheaders/core/types';
import { POLL_MAX_MS, rampedDelayMs } from './poll-cadence';
import { createResourceTimingSampler } from './resource-timing-sampler';

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

  // Parity-capture HAR sampling (`action: 'har'`): answer with the host's
  // own `chrome.devtools.network.getHAR` — byte-shaped like its "Save all
  // as HAR" export. Handled HERE and not in the panel's parity bridge
  // because getHAR's callback never fires inside a sub-frame of the
  // devtools page; the main frame resolves it normally.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const req = changes.__oh_parity_request__?.newValue as { tabId: number; ts: number; action: string } | undefined;
    if (!req || req.tabId !== chrome.devtools.inspectedWindow.tabId || req.action !== 'har') return;
    const key = `__oh_parity_har_${req.tabId}__`;
    try {
      chrome.devtools.network.getHAR((har) => {
        chrome.storage.local.set({ [key]: { reqTs: req.ts, har } });
      });
    } catch (err) {
      chrome.storage.local.set({ [key]: { reqTs: req.ts, error: String(err) } });
    }
  });
});

const tabId = chrome.devtools.inspectedWindow.tabId;

// Wall-clock moment DevTools opened on this tab — the Resource Timing
// floor. The buffer is cumulative since navigation, so the sampler scopes
// the feed to entries that started at/after this (Chrome parity: only
// requests since DevTools opened).
const openedAtWallMs = Date.now();

// Per-DevTools-session token, minted once per DevTools-open. It lives on
// the devtools_page (which is NOT evicted with the SW), so it survives SW
// eviction and changes only on a genuine reopen. Sent as the first frame on
// every (re)connect so the background relearns it after a cold start; the
// engine resets per-session state only when the token actually changes.
const sessionToken = crypto.randomUUID();

let port: chrome.runtime.Port | null = null;

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  const next = chrome.runtime.connect({ name: harSourcePortName(tabId) });
  next.onDisconnect.addListener(() => {
    // Typically this fires when the background SW is evicted. The
    // next forward call will lazy-reconnect. Reading lastError marks it
    // checked — a connect that lands while the SW is restarting closes
    // with "receiving end does not exist", which would otherwise surface
    // as an Unchecked runtime.lastError in the extension's error log.
    void chrome.runtime.lastError;
    if (port === next) port = null;
  });
  port = next;
  // Announce the DevTools session as the first frame on every (re)connect,
  // ahead of any har/nav/rt frames, so the background floors at the right
  // session before ingesting anything.
  try {
    next.postMessage({ type: 'session', token: sessionToken, openedAtWallMs });
  } catch {
    port = null;
  }
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

// Open the port eagerly at DevTools-open so the `session` frame lands
// before the user opens the panel — `ensurePort` posts it on connect. Guard
// the connect itself (it can throw "Extension context invalidated" if the
// page outlives an extension reload); the next forward will lazy-reconnect.
try {
  ensurePort();
} catch {
  port = null;
}

const resourceTimingSampler = createResourceTimingSampler({
  evalInPage: (expr, cb) => chrome.devtools.inspectedWindow.eval(expr, cb),
  forward: (snapshot) =>
    postToBackground({
      type: 'resource-timing',
      timeOriginMs: snapshot.timeOriginMs,
      entries: snapshot.entries,
      ...(snapshot.navigation !== undefined ? { navigation: snapshot.navigation } : {}),
    }),
  openedAtWallMs,
});

// Navigation forwarding — matches Chrome's Network tab default of
// clearing the log when the inspected window navigates. The panel
// honors this only when its "Preserve log" toggle is off.
chrome.devtools.network.onNavigated.addListener((url: string) => {
  postToBackground({ type: 'nav', url });
  scheduleNavTimingSample();
  // A new document resets the Resource Timing buffer — restart the sampler
  // so the first post of the new page always lands.
  resourceTimingSampler.restart();
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
  navStartMs?: number;
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
        navStartMs: performance.timeOrigin > 0 ? performance.timeOrigin : undefined,
        dclMs: nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : undefined,
        loadMs: nav.loadEventEnd > 0 ? nav.loadEventEnd : undefined,
      };
    }
    const t = performance.timing;
    const nstart = t.navigationStart || 0;
    return {
      pageOrigin: location.origin,
      navStartMs: nstart > 0 ? nstart : undefined,
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
          navStartMs: result.navStartMs,
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
 * without attaching a debugger, so we sample `performance` on the shared
 * ramped cadence (see `poll-cadence`), and stop the moment the load lands.
 */
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
      if (loadFired || navTimingElapsedMs >= POLL_MAX_MS) {
        stopNavTimingPoll();
        return;
      }
      const delay = rampedDelayMs(navTimingElapsedMs);
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

// Kick off the Resource Timing poll — like nav timing, the panel may open
// on an already-loaded page whose buffer is already populated.
resourceTimingSampler.restart();

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
