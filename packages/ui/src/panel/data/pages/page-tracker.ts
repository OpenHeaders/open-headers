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

  /** Start a new page. Returns the new page id. */
  startPage(startedDateTime: string, url: string | null = null): string {
    const id = `page_${this.counter++}`;
    this.pages.push({
      id,
      startedDateTime,
      title: url,
      pageTimings: { onContentLoad: -1, onLoad: -1 },
    });
    return id;
  }

  /** Update the current (most-recent) page with nav-timing data. */
  attachNavTiming(timing: InspectorNavTiming): void {
    const current = this.pages[this.pages.length - 1];
    if (!current) return;
    if (timing.pageOrigin) current.title = timing.pageOrigin;
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

  /** Snapshot of all known pages in arrival order. */
  list(): readonly InspectorPage[] {
    return this.pages;
  }
}
