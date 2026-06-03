/**
 * Pure reducer for the panel-side page-stream mirror.
 *
 * Six tiny rules:
 *   - `page-started` → append (or dedup by id — replay-after-reconnect
 *     can re-emit pages we already have).
 *   - `nav-timing-attached` → refine the named page with `url`
 *     (when null), `startedAtMs` (corrected down to the true nav start),
 *     and `dclMs` / `loadMs` (when later than what we have).
 *     Hub already gated refinement; client is trust-but-apply.
 *   - `tab-cleared` → drop all pages.
 *
 * Returns `NOOP` when the update would not change observable state, so
 * the store can skip notifying React.
 */

import type { Page, PageStreamUpdate } from '@openheaders/core/page-stream';

export const NOOP = Symbol('page-client-reducer/noop');
export type Noop = typeof NOOP;

export function reducePageUpdate(prev: readonly Page[], update: PageStreamUpdate): readonly Page[] | Noop {
  switch (update.kind) {
    case 'page-started': {
      const existingIdx = prev.findIndex((p) => p.id === update.page.id);
      if (existingIdx === -1) return [...prev, update.page];
      const existing = prev[existingIdx];
      if (pagesEqual(existing, update.page)) return NOOP;
      const next = prev.slice();
      next[existingIdx] = update.page;
      return next;
    }
    case 'nav-timing-attached': {
      const idx = prev.findIndex((p) => p.id === update.pageId);
      if (idx === -1) return NOOP;
      const existing = prev[idx];
      // Correct the nav-commit placeholder down to the true nav start.
      const startedAtMs =
        update.timing.navStartMs != null && update.timing.navStartMs < existing.startedAtMs
          ? update.timing.navStartMs
          : existing.startedAtMs;
      const url = existing.url ?? update.timing.pageOrigin ?? null;
      const dclMs =
        update.timing.dclMs != null && (existing.dclMs == null || update.timing.dclMs > existing.dclMs)
          ? update.timing.dclMs
          : existing.dclMs;
      const loadMs =
        update.timing.loadMs != null && (existing.loadMs == null || update.timing.loadMs > existing.loadMs)
          ? update.timing.loadMs
          : existing.loadMs;
      if (
        startedAtMs === existing.startedAtMs &&
        url === existing.url &&
        dclMs === existing.dclMs &&
        loadMs === existing.loadMs
      )
        return NOOP;
      const next = prev.slice();
      next[idx] = {
        ...existing,
        startedAtMs,
        url,
        ...(dclMs != null ? { dclMs } : {}),
        ...(loadMs != null ? { loadMs } : {}),
      };
      return next;
    }
    case 'tab-cleared':
      return prev.length === 0 ? NOOP : [];
  }
}

function pagesEqual(a: Page, b: Page): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.startedAtMs === b.startedAtMs &&
      a.url === b.url &&
      a.dclMs === b.dclMs &&
      a.loadMs === b.loadMs)
  );
}
