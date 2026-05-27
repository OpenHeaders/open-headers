/**
 * `PageStreamHub` — per-tab navigation broadcaster.
 *
 * Hub owns the per-tab page state (sequential page ids + the page list);
 * the per-tab sink fanout substrate is delegated to `TabSinkRegistry`.
 * Page model is small (three update kinds, no monotonic-phase rules);
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

import { TabSinkRegistry } from '../tab-sink-registry';

import type { AttachmentHandle, Sink } from './types';

export class PageStreamHub {
  private readonly pagesByTab = new Map<number, Page[]>();
  private readonly counters = new Map<number, number>();
  private readonly registry = new TabSinkRegistry<PageStreamUpdate>('PageStreamHub');

  notifyNavStarted(tabId: number, startedAtMs: number, url: string | null = null): Page {
    this.registry.guardDisposed();
    const list = this.pagesByTab.get(tabId) ?? [];
    if (list.length === 0) this.pagesByTab.set(tabId, list);
    const next = (this.counters.get(tabId) ?? 0) + 1;
    this.counters.set(tabId, next);
    const page: Page = { id: `page_${next}`, startedAtMs, url };
    list.push(page);
    this.registry.broadcast(tabId, { kind: 'page-started', tabId, page });
    return page;
  }

  notifyNavTimingAttached(tabId: number, timing: InspectorNavTiming): void {
    this.registry.guardDisposed();
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
    this.registry.broadcast(tabId, { kind: 'nav-timing-attached', tabId, pageId: next.id, timing });
  }

  forgetTab(tabId: number): void {
    this.registry.guardDisposed();
    if (!this.pagesByTab.has(tabId) && !this.counters.has(tabId)) return;
    this.pagesByTab.delete(tabId);
    this.counters.delete(tabId);
    this.registry.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — used by `attach` for replay; exposed for tests. */
  snapshotTab(tabId: number): readonly Page[] {
    return this.pagesByTab.get(tabId) ?? [];
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    return this.registry.attach(tabId, sink, (s) => {
      const pages = this.snapshotTab(tabId);
      for (const page of pages) {
        s.deliverUpdate({ kind: 'page-started', tabId, page });
      }
      for (const page of pages) {
        // Only emit nav-timing-attached when there is actual timing data —
        // `url` alone is already carried by the page-started replay above.
        if (page.dclMs == null && page.loadMs == null) continue;
        s.deliverUpdate({
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
    });
  }

  dispose(): void {
    this.registry.dispose();
    this.pagesByTab.clear();
    this.counters.clear();
  }
}
