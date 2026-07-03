/**
 * Builder-local state shapes and pure helpers — retention/cap constants,
 * the per-hop and per-request accumulation records, and the small
 * response/timing predicates the builder folds events through.
 */

import type { CdpWallClockResolver } from '../cdp-wall-clock';
import type { CdpInitiator, CdpRequestParams, CdpResponseParams } from '../events';

/**
 * Per-tab cap on concurrently-tracked requests. Bounds the leak from
 * requests that never reach a terminal event (no `loadingFinished` /
 * `loadingFailed`); oldest-inserted evicts first. Same envelope as the
 * heuristic correlator's in-flight maps.
 */
export const MAX_CDP_HAR_REQUESTS_PER_TAB = 5_000;

/**
 * Window a finalized request's builder state is retained after its
 * terminal event, so a trailing/duplicate event still refines rather
 * than orphaning. Measured against the monotonic event timestamp.
 * Bounded — this holds per-request memory on exactly the high-volume
 * tabs CDP targets, so it stays capped, matching the heuristic's
 * retention envelope.
 */
export const CDP_HAR_RETENTION_MS = 60_000;

/**
 * Per-tab cap on retained body refs (see {@link CdpBodyRef}). Sized to the
 * store's per-tab lifecycle cap so a row still viewable in the panel always
 * resolves a ref — the lazy body fetch (Slice 8) is keyed off the same
 * identity. Refs are a handful of strings each, so this is cheap; unlike
 * the HAR partials they survive the {@link CDP_HAR_RETENTION_MS} gc, since
 * a body can be fetched long after its lifecycle finalized.
 */
export const MAX_CDP_BODY_REFS_PER_TAB = 10_000;

export const secondsToMs = (t: number): number => Math.round(t * 1000);

/**
 * HAR `_connectionId` (stringified physical connection id), or `undefined`
 * when there is none — CDP reports `0` for a request that opened no socket
 * (cache hits, data: URLs), which Chrome's exporter omits.
 */
export function connectionIdString(connectionId: number | undefined): string | undefined {
  return connectionId === undefined || connectionId === 0 ? undefined : String(connectionId);
}

/**
 * Whether a response is a disk-cache hit — HAR `_fromCache: 'disk'`. Mirrors
 * Chrome's `cached()`: served from disk cache with nothing on the wire.
 * (Memory-cache detection needs the Resource Timing relay's signal, deferred.)
 */
export function isDiskCacheHit(response: CdpResponseParams | undefined, transferSize: number | undefined): boolean {
  return Boolean(response?.fromDiskCache) && !transferSize;
}

/**
 * Synthetic status-0 response for a request that failed before any real
 * response (a blocked beacon). Chrome still exports a full entry for these
 * — request + a `status: 0` response carrying the `_error` — so we
 * reconstruct the same shape from the request alone.
 */
export function blockedResponse(url: string): CdpResponseParams {
  return { url, status: 0, statusText: '' };
}

/**
 * The minimum a lazy body fetch needs to issue `Network.getResponseBody`
 * and shape the resulting `InspectorHarBody`: the raw CDP identity the
 * command targets, plus the source request's descriptive fields. Recorded
 * per store id at request time and kept past the HAR-partial gc — a body
 * may be opened long after the request finalized.
 */
export interface CdpBodyRef {
  /** The session the request lives on — `Network.getResponseBody` routes here. */
  readonly sessionId: string;
  /** The session-local CDP `requestId` (not the composite store id). */
  readonly rawRequestId: string;
  readonly method: string;
  readonly url: string;
  readonly startedDateTime: string;
}

/**
 * Everything a body fetch needs to pick its command and shape the result:
 * the {@link CdpBodyRef} identity, whether the request is still in flight
 * (no terminal event yet — routes the fetch to `streamResourceContent`,
 * the only command that serves an unfinished request's bytes-so-far; a
 * finished request routes to `getResponseBody`), and the current hop's
 * MIME type + charset, which decode a streamed raw-bytes body to text.
 * Composed at query time from the live HAR state; a request whose state
 * was retention-swept reads as finished (only finalized states are swept).
 */
export interface CdpBodyFetchContext extends CdpBodyRef {
  readonly inFlight: boolean;
  readonly mimeType?: string;
  readonly charset?: string;
}

export interface HopPartial {
  /** Wall-clock ISO start, stamped from this hop's `requestWillBeSent.wallTime`. */
  readonly startedDateTime: string;
  /** Monotonic issue time (`requestWillBeSent.timestamp`, seconds) — the base
   *  for HAR `timings._blocked_queueing` against the timing's `requestTime`. */
  readonly issuedSec: number;
  readonly request: CdpRequestParams;
  /** `Network.Initiator` for this hop — forwarded verbatim as HAR `_initiator`. */
  readonly initiator?: CdpInitiator;
  /** Set once the response (or `redirectResponse` for a prior hop) is known. */
  response?: CdpResponseParams;
  /** Wire bytes, known at the hop's terminal/redirect point — HAR `_transferSize`. */
  transferSize?: number;
  /** Decoded body bytes, summed from `dataReceived` — HAR `content.size`. */
  contentSize?: number;
  /** CDP `ResourceType` for this hop (`Media`, `XHR`, …) — HAR `_resourceType`, lowercased. */
  readonly resourceType?: string;
  /** Net-stack code from a terminal `loadingFailed` (`net::ERR_*`) — HAR `_error`. */
  error?: string;
  /** Total span in ms, computed at the hop's terminal/redirect point — HAR `time`. */
  totalMs?: number;
  /** Monotonic `responseReceived` event instant (seconds) — `_rawTiming`'s
   *  wait-boundary clamp source. Absent on a redirect hop (no discrete event). */
  responseReceivedSec?: number;
  /** Monotonic terminal instant (seconds): `loadingFinished`/`loadingFailed`,
   *  or the next hop's request for a redirect — `_rawTiming.endSec`. */
  terminalSec?: number;
}

export interface RequestHarState {
  /** Hop index the live response events currently attribute to. */
  hopCursor: number;
  /** Dense per-hop partials; index = hop number. */
  readonly hops: HopPartial[];
  /** On-the-wire request headers per hop (ordinal-paired ExtraInfo); index = hop. */
  readonly requestExtraByHop: Array<Readonly<Record<string, string>>>;
  /** On-the-wire response headers per hop (ordinal-paired ExtraInfo); index = hop. */
  readonly responseExtraByHop: Array<Readonly<Record<string, string>>>;
  /** Next hop ordinal a `requestWillBeSentExtraInfo` attributes to. */
  reqExtraCursor: number;
  /** Next hop ordinal a `responseReceivedExtraInfo` attributes to. */
  respExtraCursor: number;
  /** Monotonic ms of the terminal event, once seen — drives retention gc. */
  finalizedAtMs?: number;
}

export function newRequestHarState(): RequestHarState {
  return {
    hopCursor: 0,
    hops: [],
    requestExtraByHop: [],
    responseExtraByHop: [],
    reqExtraCursor: 0,
    respExtraCursor: 0,
  };
}

/**
 * Move an on-the-wire header set ordinal-mis-paired to an internal-redirect
 * hop (`from`) onto the live hop (`to`). No-op unless `from` actually holds an
 * extra and `to` is still empty — so a correctly-paired set is never disturbed.
 */
export function shiftExtraToLiveHop(byHop: Array<Readonly<Record<string, string>>>, from: number, to: number): void {
  const extra = byHop[from];
  if (extra !== undefined && byHop[to] === undefined) {
    byHop[to] = extra;
    delete byHop[from];
  }
}

/**
 * Default monotonic→wall resolver — treats the monotonic instant as wall ms
 * when no per-request offset is known, the same zero-offset degradation
 * {@link ../cdp-wall-clock.CdpWallClock} documents. Production
 * always injects the correlator's real resolver; this keeps the builder
 * independently constructible (HAR-synthesis tests that don't exercise the
 * wall clock) without a silent `undefined`.
 */
export const passThroughWallMs: CdpWallClockResolver = (_tabId, _sessionId, _requestId, monotonicSec) =>
  monotonicSec * 1000;
