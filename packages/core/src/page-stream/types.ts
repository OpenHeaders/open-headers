/**
 * Page stream — shared primitive for `@openheaders/core/page-stream`.
 *
 * The page stream is the **navigation** half of the network panel data
 * plane, sibling to `request-lifecycle`. Lifecycles describe per-request
 * shape; pages describe the navigations those requests belong to (HAR
 * `log.pages[]`). They are emitted on a dedicated `oh-page:<tabId>`
 * pipe so non-devtools hosts (desktop, daemon) can lift the page
 * concept without inheriting any request shape, and vice versa.
 *
 * Model:
 *   - One `Page` per navigation, with a sequential id (`page_1`, ...).
 *   - `pageOrigin` + nav-timing milestones (`dclMs`, `loadMs`) fill in
 *     monotonically as `performance.getEntriesByType('navigation')`
 *     reports them. Fields can REFINE but never disappear (same
 *     invariant 5 spirit as `RequestLifecycle`).
 *   - A tab can have zero pages until the first navigation is observed;
 *     the panel synthesizes a `page_1` placeholder only if no `Page` is
 *     known by the time it needs a pageref (out of scope for this
 *     module — consumer concern).
 */

import type { InspectorNavTiming } from '../types/har-source';

export interface Page {
  /** Sequential id assigned at creation, e.g. `page_1`. HAR pageref. */
  readonly id: string;
  /**
   * Wall-clock ms at navigation start. Stamped at nav-commit when the page
   * is created, then corrected down to the navigation entry's `timeOrigin`
   * once `nav-timing` reports it (the commit time lags the true start).
   */
  readonly startedAtMs: number;
  /**
   * Page URL — null until the host reports it via `nav` or `nav-timing`'s
   * `pageOrigin`. The `nav` event's full URL wins if both arrive;
   * `pageOrigin` is the fallback.
   */
  readonly url: string | null;
  /**
   * Loader id of the navigation that committed this page — CDP's main-frame
   * `frameNavigated.loaderId`, the same id the page's requests carry as
   * {@link RequestLifecycle.loaderId}. Lets a consumer bind a request to its
   * page by identity (the host's `request.loaderId === mainFrame.loaderId`
   * rule) rather than by start-time proximity. CDP-only; absent on the
   * heuristic page source.
   */
  readonly loaderId?: string;
  /**
   * UUID of the document this navigation committed — webRequest
   * `documentId` vocabulary, the heuristic page source's page-binding key
   * and the sibling of {@link loaderId}. The host resolves it at the
   * commit signal (`webNavigation.getFrame` on the main frame) and
   * attaches it via `page-document-attached`; resolution is asynchronous,
   * so the page is minted without it and gains it moments later. Matches
   * {@link RequestLifecycle.documentId} on the page's own requests.
   * Chromium-only (Firefox frames carry no `documentId`); absent when the
   * resolution lost a commit race. Set once, never changed.
   */
  readonly documentId?: string;
  /** DOMContentLoaded ms (relative to navigation start). */
  readonly dclMs?: number;
  /** Load event ms (relative to navigation start). */
  readonly loadMs?: number;
}

/**
 * Wire-shaped diff emitted by the page hub and applied by the panel
 * reducer. All updates carry `tabId` — clients filter by their own
 * subscribed tab; the wire-level filter is the port name itself, but
 * carrying `tabId` here keeps the union shape parallel to
 * `RequestLifecycleUpdate` and matches a future multi-tab consumer.
 */
export type PageStreamUpdate =
  | { kind: 'page-started'; tabId: number; page: Page }
  | { kind: 'nav-timing-attached'; tabId: number; pageId: string; timing: InspectorNavTiming }
  | { kind: 'page-document-attached'; tabId: number; pageId: string; documentId: string }
  | { kind: 'tab-cleared'; tabId: number };
