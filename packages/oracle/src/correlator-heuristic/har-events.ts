/**
 * Host-neutral HAR event seam — the H2 counterpart to
 * {@link WebRequestEventSource}.
 *
 * Two event kinds flow through this seam:
 *   - `har-entry` — a HAR row for a finished request, forwarded by the
 *     host's HAR pipeline (`chrome.devtools.network.onRequestFinished` in
 *     the extension; a future desktop host will surface its own
 *     equivalent).
 *   - `har-body` — the response body for an already-delivered HAR row,
 *     keyed by `(method, url, startedDateTime)` because HAR bodies are
 *     fetched asynchronously via `entry.getContent` and arrive after the
 *     entry itself.
 *
 * Port-presence (a HAR feed becoming active / inactive for a tab) is a
 * **separate seam** {@link HarPresenceSource} — the correlator never
 * sees presence events, and consumers that need both subscribe to both
 * from the same host adapter instance.
 *
 * `InspectorHarEntry` / `InspectorHarBody` are imported from
 * `@openheaders/core/types` and contain no chrome surface — they are the
 * HAR 1.2 + `_*` extension shape, host-neutral by construction.
 */

import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

/** A HAR row arriving for a tracked tab. */
export interface HarEntryEvent {
  readonly kind: 'har-entry';
  readonly tabId: number;
  readonly entry: InspectorHarEntry;
}

/** A response body for an already-delivered HAR row. */
export interface HarBodyEvent {
  readonly kind: 'har-body';
  readonly tabId: number;
  readonly body: InspectorHarBody;
}

export type HarEvent = HarEntryEvent | HarBodyEvent;

/** Host-side HAR data source. The correlator subscribes to exactly this. */
export interface HarEventSource {
  subscribe(listener: (event: HarEvent) => void): () => void;
}

/**
 * HAR feed becoming active or inactive for a tab. Used by hosts that
 * keep per-tab session state tied to whether a HAR pipeline is alive
 * (e.g. legacy inspector-port broadcast). The correlator does not care.
 */
export type HarPresenceEvent =
  | { readonly kind: 'tab-har-active'; readonly tabId: number }
  | { readonly kind: 'tab-har-inactive'; readonly tabId: number };

export interface HarPresenceSource {
  subscribePresence(listener: (event: HarPresenceEvent) => void): () => void;
}
