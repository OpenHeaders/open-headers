/**
 * `PageStreamHub` — per-tab navigation broadcaster.
 *
 * Combines a tiny per-tab store (sequential page ids + the page list)
 * with the lifecycle-hub fanout pattern. Kept as one class because the
 * page model is small (three update kinds, no monotonic-phase rules);
 * splitting into store + hub + replay would be more boilerplate than
 * signal.
 *
 * Notify verbs (engine inputs):
 *   - `notifyNavStarted(tabId, startedAtMs, url?)` — page boundary;
 *     mints a `page_N` id, appends to the tab's page list, emits
 *     `page-started`.
 *   - `notifyNavTimingAttached(tabId, timing)` — refines the most-
 *     recent page with `pageOrigin` (when its url is still null) and
 *     `dclMs` / `loadMs` (when later than what we have). Emits
 *     `nav-timing-attached` only when the page actually changed.
 *   - `forgetTab(tabId)` — drops the tab's page list; emits
 *     `tab-cleared`. Called from `chrome.tabs.onRemoved` adapters.
 *
 * Replay (sink inputs):
 *   `attach(tabId, sink)` delivers `ready` then re-emits the tab's
 *   known pages as a synchronous block of `page-started` updates,
 *   followed by `nav-timing-attached` for each page that has timing.
 *   Single-block guarantee: JS is single-threaded; the notify verbs
 *   above all mutate + fan out synchronously, so no live update
 *   interleaves between snapshot read and replay emit.
 */

import type { InspectorNavTiming } from '@openheaders/core/types';
import type { Page, PageStreamUpdate } from '@openheaders/core/page-stream';

import type { AttachmentHandle, Sink } from './types';

export class PageStreamHub {
  private readonly pagesByTab = new Map<number, Page[]>();
  private readonly counters = new Map<number, number>();
  private readonly attachments = new Map<number, Set<Sink>>();
  private disposed = false;

  notifyNavStarted(tabId: number, startedAtMs: number, url: string | null = null): Page {
    this.guardDisposed();
    const list = this.pagesByTab.get(tabId) ?? [];
    if (list.length === 0) this.pagesByTab.set(tabId, list);
    const next = (this.counters.get(tabId) ?? 0) + 1;
    this.counters.set(tabId, next);
    const page: Page = { id: `page_${next}`, startedAtMs, url };
    list.push(page);
    this.broadcast(tabId, { kind: 'page-started', tabId, page });
    return page;
  }

  notifyNavTimingAttached(tabId: number, timing: InspectorNavTiming): void {
    this.guardDisposed();
    const list = this.pagesByTab.get(tabId);
    if (!list || list.length === 0) return;
    const idx = list.length - 1;
    const prev = list[idx];
    const next: Page = {
      ...prev,
      url: prev.url ?? timing.pageOrigin ?? null,
      ...(timing.dclMs != null && (prev.dclMs == null || timing.dclMs > prev.dclMs)
        ? { dclMs: timing.dclMs }
        : {}),
      ...(timing.loadMs != null && (prev.loadMs == null || timing.loadMs > prev.loadMs)
        ? { loadMs: timing.loadMs }
        : {}),
    };
    if (next === prev) return;
    if (
      next.url === prev.url &&
      next.dclMs === prev.dclMs &&
      next.loadMs === prev.loadMs
    ) {
      return;
    }
    list[idx] = next;
    this.broadcast(tabId, { kind: 'nav-timing-attached', tabId, pageId: next.id, timing });
  }

  forgetTab(tabId: number): void {
    this.guardDisposed();
    if (!this.pagesByTab.has(tabId) && !this.counters.has(tabId)) return;
    this.pagesByTab.delete(tabId);
    this.counters.delete(tabId);
    this.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — used by `attach` for replay; exposed for tests. */
  snapshotTab(tabId: number): readonly Page[] {
    return this.pagesByTab.get(tabId) ?? [];
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    if (this.disposed) throw new Error('PageStreamHub: attach after dispose');
    let sinks = this.attachments.get(tabId);
    if (sinks === undefined) {
      sinks = new Set();
      this.attachments.set(tabId, sinks);
    }
    sinks.add(sink);

    sink.deliverReady(tabId);
    const pages = this.snapshotTab(tabId);
    for (const page of pages) {
      sink.deliverUpdate({ kind: 'page-started', tabId, page });
    }
    for (const page of pages) {
      // Only emit nav-timing-attached when there is actual timing data —
      // `url` alone is already carried by the page-started replay above.
      if (page.dclMs == null && page.loadMs == null) continue;
      sink.deliverUpdate({
        kind: 'nav-timing-attached',
        tabId,
        pageId: page.id,
        timing: {
          pageOrigin: page.url,
          ...(page.dclMs != null ? { dclMs: page.dclMs } : {}),
          ...(page.loadMs != null ? { loadMs: page.loadMs } : {}),
        },
      });
    }

    let detached = false;
    return {
      tabId,
      detach: () => {
        if (detached) return;
        detached = true;
        const set = this.attachments.get(tabId);
        if (set === undefined) return;
        set.delete(sink);
        if (set.size === 0) this.attachments.delete(tabId);
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sinks of this.attachments.values()) {
      for (const sink of sinks) {
        try {
          sink.close();
        } catch {
          /* sink close is best-effort */
        }
      }
    }
    this.attachments.clear();
    this.pagesByTab.clear();
    this.counters.clear();
  }

  private broadcast(tabId: number, update: PageStreamUpdate): void {
    const sinks = this.attachments.get(tabId);
    if (sinks === undefined) return;
    for (const sink of sinks) {
      try {
        sink.deliverUpdate(update);
      } catch {
        /* sink delivery is best-effort */
      }
    }
  }

  private guardDisposed(): void {
    if (this.disposed) throw new Error('PageStreamHub: operation after dispose');
  }
}
