/**
 * Projector from `Page` (the page-stream primitive) to `HarPage` (the
 * on-wire HAR 1.2 `log.pages[i]` shape).
 *
 * Sits between the page-stream snapshot and the HAR exporter so neither
 * has to know about the other's shape. Pure, no IO.
 *
 * Two shape differences worth calling out:
 *   - `Page.startedAtMs` is a wall-clock number; HAR wants an ISO
 *     timestamp.
 *   - `Page.url` is nullable until nav-timing reports it; HAR 1.2
 *     requires `title` (some viewers reject `null`), so we substitute
 *     `''` — same convention the legacy `projectPagesForRefs` used.
 *
 * Nav timings (`dclMs` / `loadMs`) are absent on `Page` until the host
 * reports them; HAR encodes "not yet observed" as `-1`, so undefined
 * folds to `-1` here.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarPage } from '@openheaders/core/types';

import { type AnchoredPageTimings, anchorPageTimings } from '../page-anchor';

export interface HarPageTimings {
  onContentLoad: number;
  onLoad: number;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTimings;
}

/**
 * Project a `Page` to a `HarPage`. `timings` overrides the page's own start /
 * milestones — the exporter passes the host-anchored values (the document's
 * network start; see `page-anchor`). Defaults to the page's own fields so a
 * caller without a document still produces a valid block.
 */
export function pageToHar(page: Page, timings?: AnchoredPageTimings): HarPage {
  const t = timings ?? { startedAtMs: page.startedAtMs, dclMs: page.dclMs, loadMs: page.loadMs };
  // Key order mirrors Chrome's exporter (`startedDateTime` first).
  return {
    startedDateTime: new Date(t.startedAtMs).toISOString(),
    id: page.id,
    title: page.url ?? '',
    pageTimings: {
      onContentLoad: t.dclMs ?? -1,
      onLoad: t.loadMs ?? -1,
    },
  };
}

/**
 * Filter the page list to those referenced by `refs`, then project each
 * survivor to a `HarPage`. Used by the HAR envelope builder so a
 * single-entry export doesn't carry the full recording's page list.
 *
 * `docByPage` maps each page id to its main document lifecycle; when present
 * each page is re-anchored to that document's network start (host parity).
 *
 * `hostPages` (CDP mode) carries the host's own `chrome.devtools.network`
 * page block. Referenced host pages are emitted first, **verbatim and in the
 * host's own order** — byte parity for their `pageTimings` floats,
 * `startedDateTime`, and the page sequence itself (the host orders pages by
 * first-seen request, which our page-stream order can't reproduce across
 * navigations). Any referenced page with no host page (an augmented OOPIF-only
 * export) then falls back to the CDP projection, appended after the host block.
 * Heuristic mode (no host pages) keeps the original CDP-only projection in
 * page-stream order.
 */
export function pagesToHarForRefs(
  pages: readonly Page[],
  refs: ReadonlySet<string>,
  docByPage?: ReadonlyMap<string, RequestLifecycle>,
  hostPages?: readonly InspectorHarPage[],
): HarPage[] {
  const out: HarPage[] = [];
  const emitted = new Set<string>();
  if (hostPages !== undefined) {
    for (const host of hostPages) {
      if (!refs.has(host.id) || emitted.has(host.id)) continue;
      out.push(host);
      emitted.add(host.id);
    }
  }
  for (const page of pages) {
    if (!refs.has(page.id) || emitted.has(page.id)) continue;
    const timings = docByPage ? anchorPageTimings(page, docByPage.get(page.id)) : undefined;
    out.push(pageToHar(page, timings));
    emitted.add(page.id);
  }
  return out;
}
