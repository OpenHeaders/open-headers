/**
 * Page-tracking domain types.
 *
 * The panel groups HAR entries by navigation, mirroring the HAR 1.2
 * `log.pages[]` model. Each navigation event begins a new
 * `InspectorPage`; HAR entries ingested while it's current pick up its
 * `id` as `pageref` so consumers (HAR export, debugging surfaces) can
 * reconstruct "which requests belong to which page" the same way
 * Chrome's exported HAR does.
 *
 * `pageTimings` values may be `-1` per HAR 1.2 to mean "not yet
 * observed" — the panel fills them in lazily when `nav-timing` reports
 * DOMContentLoaded / load. Consumers that render bars should treat
 * `-1` as "not available" rather than "happened at t=-1".
 */

export interface InspectorPageTimings {
  onContentLoad: number;
  onLoad: number;
}

export interface InspectorPage {
  /** Sequential id assigned at creation, e.g. "page_1". HAR consumers
   *  reference this from `entry.pageref`. */
  id: string;
  /** ISO timestamp of when the page was started (nav event arrival,
   *  or first-entry timestamp when entries land before any nav). */
  startedDateTime: string;
  /** Page URL — null until nav-timing reports `pageOrigin`. */
  title: string | null;
  /** Navigation timing milestones (ms since nav start). Either may be
   *  `-1` until the corresponding event fires. */
  pageTimings: InspectorPageTimings;
}

/**
 * On-wire shape for `log.pages[i]` per HAR 1.2. `title` is required by
 * the spec; we substitute an empty string when the URL hasn't been
 * resolved yet rather than emit `null` (which some HAR viewers reject).
 */
export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: InspectorPageTimings;
}
