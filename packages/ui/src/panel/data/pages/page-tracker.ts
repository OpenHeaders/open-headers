/**
 * Page lifecycle owner.
 *
 *   startPage(now, url?)   — push a new page, set as current
 *   attachNavTiming(t)     — finalize current page's URL + DCL/Load
 *   ensurePage(entryStart) — return current page id, lazily creating
 *                            page_1 from the first entry's timestamp
 *                            when no nav event has landed yet
 *   reset()                — drop all pages, reset id counter
 *
 * Owned by InspectorStore (composition); the store wires it to the
 * inspector port's `nav` / `nav-timing` messages and to entry ingest.
 */

import type { InspectorNavTiming } from '@openheaders/core/types';
import type { InspectorPage } from './types';

export class PageTracker {
  private pages: InspectorPage[] = [];
  private counter = 1;

  reset(): void {
    this.pages = [];
    this.counter = 1;
  }

  /**
   * Start a new page. Returns the new page id.
   *
   * Race-handling: if the current page is a "ghost" (lazy-created from
   * an early entry, no title or timings yet), absorb it instead of
   * pushing a fresh page. This handles the common pattern where a
   * navigation's document fetch arrives at the panel before the `nav`
   * message does — we'd otherwise emit a titleless page_N followed by
   * page_N+1 for the same navigation, splitting redirect chains across
   * pages. Chrome treats redirects as one page; absorbing matches that.
   */
  startPage(startedDateTime: string, url: string | null = null): string {
    const current = this.pages[this.pages.length - 1];
    if (current && !current.title && current.pageTimings.onContentLoad === -1 && current.pageTimings.onLoad === -1) {
      current.title = url;
      // Keep the earlier startedDateTime — the lazy ghost was created
      // from the first entry, which is closer to actual nav start than
      // the `nav` message's arrival timestamp.
      if (startedDateTime < current.startedDateTime) current.startedDateTime = startedDateTime;
      return current.id;
    }
    const id = `page_${this.counter++}`;
    this.pages.push({
      id,
      startedDateTime,
      title: url,
      pageTimings: { onContentLoad: -1, onLoad: -1 },
    });
    return id;
  }

  /**
   * Update the current page with nav-timing data. If no page exists
   * (nav-timing landed before any `nav` event or HAR entry), lazy-
   * create one so the URL + timings aren't lost — common when the
   * panel opens after a navigation has already happened.
   *
   * `title` is only filled from `pageOrigin` when it's currently empty:
   * the `nav` message carries the full URL (with trailing slash and
   * path) and is the better source — Chrome's HAR uses the full URL,
   * not the origin.
   */
  attachNavTiming(timing: InspectorNavTiming): void {
    if (this.pages.length === 0) this.startPage(new Date().toISOString(), timing.pageOrigin ?? null);
    const current = this.pages[this.pages.length - 1];
    if (!current.title && timing.pageOrigin) current.title = timing.pageOrigin;
    if (timing.dclMs != null) current.pageTimings.onContentLoad = timing.dclMs;
    if (timing.loadMs != null) current.pageTimings.onLoad = timing.loadMs;
  }

  /**
   * Ensure a current page exists; if no nav event has landed yet,
   * lazily create page_1 from the given entry timestamp. Returns the
   * page id the entry should reference as `pageref`.
   */
  ensurePage(startedDateTime: string): string {
    const current = this.pages[this.pages.length - 1];
    if (current) return current.id;
    return this.startPage(startedDateTime);
  }

  /**
   * Adopt an earlier `startedDateTime` for the current page when a
   * matching entry (typically the document fetch) reports one closer
   * to the actual navigation start. Our `nav` message arrives after
   * the browser already began the request, so the message-arrival
   * timestamp drifts ~100ms past Chrome's HAR. Pinning to the earliest
   * entry timestamp closes that gap.
   */
  adoptEarliestStart(startedDateTime: string): void {
    const current = this.pages[this.pages.length - 1];
    if (!current) return;
    if (startedDateTime < current.startedDateTime) {
      current.startedDateTime = startedDateTime;
    }
  }

  /** Snapshot of all known pages in arrival order. */
  list(): readonly InspectorPage[] {
    return this.pages;
  }
}
