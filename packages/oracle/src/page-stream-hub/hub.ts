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
 *   - `notifyNavStarted(tabId, startedAtMs, url?, loaderId?)` — page
 *     boundary; mints a `page_N` id, appends to the tab's page list, emits
 *     `page-started`. `loaderId` (CDP source only) is the page-binding key.
 *     The mint instant is retained as `committedAtMs`, the immutable
 *     commit-signal time the supersession carve-out reads.
 *   - `notifyNavTimingAttached(tabId, timing)` — refines the most-
 *     recent page with `pageOrigin` (when its url is still null),
 *     `navStartMs` (corrects the nav-commit start down to the true nav
 *     start; `committedAtMs` is untouched), and `dclMs` / `loadMs` (when
 *     later than what we have). Emits `nav-timing-attached` only when the
 *     page actually changed.
 *   - `notifyPageDocumentAttached(tabId, pageId, documentId)` — attaches
 *     the committed document's UUID to the named page, set-once. The
 *     heuristic page source mints its page synchronously at the commit
 *     signal and resolves the documentId asynchronously
 *     (`webNavigation.getFrame`); this verb lands the resolution without
 *     ever reordering page minting. Emits `page-document-attached`.
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

import type { Page, PageStreamUpdate } from '@openheaders/core/page-stream';
import type { InspectorNavTiming } from '@openheaders/core/types';

import type { TabLifecycleBus } from '../tab-lifecycle-bus';
import { TabSinkRegistry } from '../tab-sink-registry';

import type { AttachmentHandle, Sink } from './types';

export interface PageStreamHubOptions {
  readonly bus?: TabLifecycleBus;
}

export class PageStreamHub {
  private readonly pagesByTab = new Map<number, Page[]>();
  private readonly counters = new Map<number, number>();
  private readonly registry = new TabSinkRegistry<PageStreamUpdate>('PageStreamHub');
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: PageStreamHubOptions = {}) {
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') this.forgetTab(event.tabId);
        })
      : null;
  }

  notifyNavStarted(tabId: number, startedAtMs: number, url: string | null = null, loaderId?: string): Page {
    this.registry.guardDisposed();
    const list = this.pagesByTab.get(tabId) ?? [];
    if (list.length === 0) this.pagesByTab.set(tabId, list);
    const next = (this.counters.get(tabId) ?? 0) + 1;
    this.counters.set(tabId, next);
    // `loaderId` is the CDP page source's page-binding key; the heuristic
    // source passes none, so the page carries no loader id and consumers fall
    // back to start-time binding. `committedAtMs` retains the mint instant —
    // the commit signal's time — which the nav-timing refinement must never
    // touch (it corrects `startedAtMs` down to the true nav start).
    const page: Page = {
      id: `page_${next}`,
      startedAtMs,
      committedAtMs: startedAtMs,
      url,
      ...(loaderId ? { loaderId } : {}),
    };
    list.push(page);
    this.registry.broadcast(tabId, { kind: 'page-started', tabId, page });
    return page;
  }

  notifyPageDocumentAttached(tabId: number, pageId: string, documentId: string): void {
    this.registry.guardDisposed();
    const list = this.pagesByTab.get(tabId);
    if (!list) return;
    const idx = list.findIndex((p) => p.id === pageId);
    if (idx < 0) return;
    const prev = list[idx];
    // Set-once: a page's committed document never changes; a duplicate or
    // late resolution (commit-race loser) must not overwrite the first.
    if (prev.documentId !== undefined) return;
    list[idx] = { ...prev, documentId };
    this.registry.broadcast(tabId, { kind: 'page-document-attached', tabId, pageId, documentId });
  }

  notifyNavTimingAttached(tabId: number, timing: InspectorNavTiming): void {
    this.registry.guardDisposed();
    const list = this.pagesByTab.get(tabId);
    if (!list || list.length === 0) return;
    const idx = list.length - 1;
    const prev = list[idx];
    // `page-started` stamps the start at nav-commit; the navigation entry's
    // `timeOrigin` is the true (earlier) nav start, so correct it downward.
    const startedAtMs =
      timing.navStartMs != null && timing.navStartMs < prev.startedAtMs ? timing.navStartMs : prev.startedAtMs;
    const next: Page = {
      ...prev,
      startedAtMs,
      url: prev.url ?? timing.pageOrigin ?? null,
      ...(timing.dclMs != null && (prev.dclMs == null || timing.dclMs > prev.dclMs) ? { dclMs: timing.dclMs } : {}),
      ...(timing.loadMs != null && (prev.loadMs == null || timing.loadMs > prev.loadMs)
        ? { loadMs: timing.loadMs }
        : {}),
    };
    if (next === prev) return;
    if (
      next.startedAtMs === prev.startedAtMs &&
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
      s.deliverReady(tabId);
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
    this.unsubscribeBus?.();
    this.registry.dispose();
    this.pagesByTab.clear();
    this.counters.clear();
  }
}
