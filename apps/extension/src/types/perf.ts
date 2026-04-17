/**
 * Resource-timing entry shape shipped from the content-script
 * PerformanceObserver to the background service worker.
 *
 * A minimal projection of `PerformanceResourceTiming` — just the fields
 * the SW verdict engine needs. Structured-clone safe for crossing
 * the `runtime.sendMessage` boundary (no methods, no Symbols).
 */
export interface PerfResourceEntry {
  /** Full absolute URL of the subresource (PerformanceResourceTiming.name). */
  url: string;
  /**
   * DOM element or API that initiated the fetch. "img", "script", "css",
   * "link", "xmlhttprequest", "fetch", "iframe", "navigation", "beacon",
   * or "other". Maps loosely to webRequest's `resourceType` but not 1:1.
   */
  initiatorType: string;
  /** High-resolution timestamp the request started (relative to navigation). */
  startTime: number;
  /**
   * True when the response was served from the renderer's memory/HTTP
   * cache without a fresh network round-trip. Detected via
   * `transferSize === 0 && encodedBodySize > 0`.
   */
  servedFromCache: boolean;
}
