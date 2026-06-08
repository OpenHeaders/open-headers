/**
 * Page-block anchoring for the HAR export.
 *
 * The host anchors `log.pages[i]` to its main document **request's** network
 * start (`PageLoad.startTime = mainRequest.startTime`, i.e. the committed
 * document's `timing.requestTime`), and reports `onContentLoad` / `onLoad` as
 * offsets from that instant. Per-entry `startedDateTime` instead uses each
 * request's issue time — which is why entries already match the host while the
 * page block can drift.
 *
 * Our page stream carries its own start: the CDP page feed anchors it to the
 * document `requestTime` (host-exact), but the Performance-API feed anchors it
 * to `navigationStart` (`timeOrigin`), which precedes the network start by the
 * queue/connect setup. This module re-anchors each exported page to its main
 * document lifecycle's network start (`hopNetworkStartMs`, the same value the
 * status-bar footer anchors to), so the page block matches the host:
 *
 *   - CDP feed: the page start already equals the doc's network start, so the
 *     leg is `0` and the projection is a precise no-op (stays byte-identical).
 *   - Performance-API feed: the leg is the navStart→network-start gap, which is
 *     subtracted off so the page start and milestones land on the host's zero.
 *
 * Pure, no IO; the join key is the existing `resolvePageref` page↔request rule.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { resolvePageref } from './inspector-row-projection';

/** Top-level navigation document — `main_frame` (webRequest) or `document` (CDP). */
export function isMainDocumentResourceType(resourceType: string | undefined): boolean {
  return resourceType === 'main_frame' || resourceType === 'document';
}

/**
 * Map each page id to its final committed main-document lifecycle — the one the
 * host binds the `PageLoad` to. A navigation's document request is grouped to
 * its page via {@link resolvePageref}; among same-page documents the latest hop
 * (`hopStartedAtMs`) is the committed one (the final hop of a folded redirect,
 * or the standalone document otherwise).
 */
export function selectMainDocByPage(
  pages: readonly Page[],
  lifecycles: readonly RequestLifecycle[],
): Map<string, RequestLifecycle> {
  const byPage = new Map<string, RequestLifecycle>();
  if (pages.length === 0) return byPage;
  for (const lc of lifecycles) {
    if (!isMainDocumentResourceType(lc.resourceType)) continue;
    const pageId = resolvePageref(lc, pages);
    if (pageId === null) continue;
    const current = byPage.get(pageId);
    if (current === undefined || lc.hopStartedAtMs > current.hopStartedAtMs) byPage.set(pageId, lc);
  }
  return byPage;
}

/**
 * The committed main-document lifecycle for a loader id — the latest-hop main
 * document whose `loaderId` matches (the host's `PageLoad.mainRequest`, bound
 * by `request.loaderId === mainFrame.loaderId`). Among same-loader documents
 * the latest hop (`hopStartedAtMs`) is the committed one. Returns `null` when
 * no main document carries this loader id (no CDP loader binding for this
 * navigation) — the caller falls back to a heuristic document selection.
 *
 * Folds the footer's main-document anchor onto the same loader join as
 * {@link resolvePageref}, so the footer zero, the page block, and the pageref
 * cannot disagree in a slow-nav transition window.
 */
export function selectMainDocByLoader(
  lifecycles: readonly RequestLifecycle[],
  loaderId: string,
): RequestLifecycle | null {
  let chosen: RequestLifecycle | null = null;
  for (const lc of lifecycles) {
    if (!isMainDocumentResourceType(lc.resourceType)) continue;
    if (lc.loaderId !== loaderId) continue;
    if (chosen === null || lc.hopStartedAtMs > chosen.hopStartedAtMs) chosen = lc;
  }
  return chosen;
}

/** Page start + milestones re-anchored to the document network start. */
export interface AnchoredPageTimings {
  readonly startedAtMs: number;
  readonly dclMs?: number;
  readonly loadMs?: number;
}

/**
 * Re-anchor a page to its main document's network start. Returns the page's own
 * values unchanged when no document is known, or when the document start is not
 * after the page start (anomalous — never shift the block backward).
 */
export function anchorPageTimings(page: Page, doc: RequestLifecycle | undefined): AnchoredPageTimings {
  const own: AnchoredPageTimings = { startedAtMs: page.startedAtMs, dclMs: page.dclMs, loadMs: page.loadMs };
  if (doc === undefined) return own;
  const docStart = doc.hopNetworkStartMs ?? doc.hopStartedAtMs;
  const leg = docStart - page.startedAtMs;
  if (leg < 0) return own;
  return {
    startedAtMs: docStart,
    dclMs: page.dclMs != null ? page.dclMs - leg : undefined,
    loadMs: page.loadMs != null ? page.loadMs - leg : undefined,
  };
}
