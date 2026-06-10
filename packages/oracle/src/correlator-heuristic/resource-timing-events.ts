/**
 * Host-neutral Resource Timing event seam — the third input next to
 * {@link WebRequestEventSource} and {@link HarEventSource}.
 *
 * The inspected document's own Resource Timing buffer is the only
 * banner-free surface that records the connection legs (DNS / connect /
 * TLS / first byte) for a request whose devtools HAR never arrives — a
 * document canceled mid-stream gets no terminal `onRequestFinished`, so
 * its hop slot only ever holds the partial entry synthesized from
 * webRequest wire facts. This seam carries the page-recorded legs into
 * the correlator, which joins them onto the matching lifecycle so the
 * partial entry gains its `timings` block.
 *
 * One event kind: a cumulative `rt-snapshot` per document (the buffer
 * only grows until navigation resets it), carrying the `resource`
 * entries plus the document's own navigation entry — the doc row's only
 * timing source — kept apart so consumers that count resources never
 * see it.
 *
 * The seam is optional on the correlator: a host without a Resource
 * Timing pipeline (no DevTools session alive) simply never delivers,
 * and every row keeps its webRequest-floor timings.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';

/** A cumulative Resource Timing snapshot for a tracked tab's document. */
export interface ResourceTimingSnapshotEvent {
  readonly kind: 'rt-snapshot';
  readonly tabId: number;
  /** Wall-clock ms of the document time origin — lifts entry legs to wall-clock. */
  readonly timeOriginMs: number;
  readonly entries: readonly ResourceTimingEntry[];
  /** The document's own navigation entry, same projection. */
  readonly navigation?: ResourceTimingEntry;
}

export type ResourceTimingEvent = ResourceTimingSnapshotEvent;

/** Host-side Resource Timing source. The correlator subscribes to exactly this. */
export interface ResourceTimingEventSource {
  subscribe(listener: (event: ResourceTimingEvent) => void): () => void;
}
