/**
 * Resource-timing observer (ISOLATED world) — closes the observability gap
 * that webRequest leaves open for cache-served subresources.
 *
 * MV3's webRequest API doesn't fire for responses served from the
 * renderer's in-process memory cache, Service-Worker-intercepted fetches
 * that reuse a cached Response, or bfcache restores. That means rules
 * targeting a subresource domain (e.g. github.githubassets.com) can
 * appear "not firing" on cached reloads even when they would have fired
 * had the request gone to the network. The Resource Timing API sees
 * every subresource the page actually loaded, cache layer be damned, so
 * we observe through that instead of (in addition to) webRequest.
 *
 * Runs at document_start on <all_urls>. Registers a `PerformanceObserver`
 * with `buffered: true` so entries that landed before the observer
 * attached are replayed to us. Batches entries to reduce SW wakeups —
 * typical page loads emit 50–200 resource entries in under 200ms, which
 * would be 50–200 runtime.sendMessage calls without coalescing.
 *
 * Batch coalescing: 150ms debounce OR 32 entries, whichever comes first.
 * Ships batches to the SW as a `perfResourceEntries` message. The SW
 * handler is responsible for deciding which entries match any rule and
 * feeding the verdict engine.
 *
 * Cache-hit detection: `transferSize === 0 && encodedBodySize > 0`.
 * Memory cache and HTTP cache both flag `transferSize: 0` because there
 * was no network round-trip; `encodedBodySize > 0` distinguishes a real
 * cached body from a 304/empty response. Chrome and Firefox both
 * follow this convention per the Resource Timing Level 2 spec.
 *
 * bfcache restore: when `pageshow` fires with `persisted === true`, the
 * document is being reanimated from the back/forward cache. Resource
 * entries from the original load are still in the buffer and will NOT
 * re-appear — but the subresources are still "live" on the page, so we
 * drain the buffer once on pageshow to signal the tab still has these
 * resources loaded. The SW side interprets this as "this tab reloaded,
 * here's what it has" and re-seeds its tracked-URL map.
 *
 * CSP: Resource Timing is part of the platform; strict-CSP sites
 * (GitHub, banking apps, etc.) cannot block it. Content scripts run in
 * an ISOLATED world with their own JS realm and are exempt from page
 * CSP for their own code. We never inject MAIN-world script here, so
 * there's no CSP surface.
 */

import type { PerfResourceEntry } from '@/types/perf';

declare const browser: typeof chrome | undefined;

const BATCH_INTERVAL_MS = 150;
const BATCH_MAX_ENTRIES = 32;

const api: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

// Extension pages (popup, workspace, devtools panel) inject their own
// content-script-adjacent code via message handlers — we have no business
// reporting Resource Timing entries for our own chrome-extension://
// document tree.
function isExtensionOrigin(origin: string): boolean {
  return (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    origin.startsWith('extension://') ||
    origin.startsWith('safari-web-extension://')
  );
}

if (!isExtensionOrigin(location.origin)) {
  (() => {
    let queue: PerfResourceEntry[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const seenUrls = new Set<string>();

    function flush(): void {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (queue.length === 0) return;
      const payload = queue;
      queue = [];
      try {
        api.runtime.sendMessage({ type: 'perfResourceEntries', entries: payload }).catch?.(() => {
          /* SW terminated / reloading — drop the batch silently */
        });
      } catch {
        /* runtime.sendMessage can synchronously throw on context invalidation */
      }
    }

    function schedule(): void {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
    }

    function enqueue(entry: PerfResourceEntry): void {
      queue.push(entry);
      if (queue.length >= BATCH_MAX_ENTRIES) {
        flush();
        return;
      }
      schedule();
    }

    function toEntry(raw: PerformanceResourceTiming): PerfResourceEntry | null {
      const url = raw.name;
      if (!url || !(url.startsWith('http:') || url.startsWith('https:'))) {
        return null;
      }
      if (seenUrls.has(url)) return null;
      seenUrls.add(url);
      const encodedBodySize = raw.encodedBodySize ?? 0;
      const transferSize = raw.transferSize ?? 0;
      // Cache-hit heuristic — transferSize is 0 for cache reuse (no bytes
      // crossed the wire); encodedBodySize > 0 guards against 304s and
      // zero-byte responses being misreported as cached.
      const servedFromCache = transferSize === 0 && encodedBodySize > 0;
      return {
        url,
        initiatorType: raw.initiatorType ?? '',
        startTime: raw.startTime ?? 0,
        servedFromCache,
      };
    }

    function handleEntries(entries: readonly PerformanceEntry[]): void {
      for (const e of entries) {
        if (e.entryType !== 'resource') continue;
        const mapped = toEntry(e as PerformanceResourceTiming);
        if (mapped) enqueue(mapped);
      }
    }

    try {
      const observer = new PerformanceObserver((list) => {
        handleEntries(list.getEntries());
      });
      // `buffered: true` replays entries that landed before we attached,
      // critical because our content script starts at document_start but
      // the very first subresources (favicon prefetch, preload hints)
      // can fire before our observer callback runs the first time.
      observer.observe({ type: 'resource', buffered: true });

      // Expand the ring buffer so long-running SPAs don't silently drop
      // entries once the default 250-entry limit fills.
      try {
        performance.setResourceTimingBufferSize?.(2048);
      } catch {
        /* not all browsers expose this */
      }

      // bfcache restore: when the user navigates back/forward and the
      // browser re-attaches an existing document, drain whatever's in
      // the buffer again so the SW's tracked-URL map gets re-seeded.
      window.addEventListener('pageshow', (ev: PageTransitionEvent) => {
        if (!ev.persisted) return;
        seenUrls.clear();
        const existing = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        handleEntries(existing);
      });

      // Page visibility flip: when the tab returns to foreground, flush
      // anything sitting in the queue so the popup opens against fresh
      // data instead of waiting for the next interval tick.
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') flush();
      });

      // Last-chance flush before the page unloads so in-flight entries
      // aren't dropped on navigation.
      window.addEventListener('pagehide', flush, { capture: true });
    } catch {
      /* PerformanceObserver unavailable — degrade silently */
    }
  })();
}
