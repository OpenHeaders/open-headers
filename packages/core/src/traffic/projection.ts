/**
 * Public traffic vocabulary — the ONLY shapes that cross the retention
 * store's boundary (the agent-traffic plan §2, §4).
 *
 * The retained record type itself is private to
 * `@openheaders/oracle/traffic-retention`; everything a consumer (MCP
 * tool, UI surface, CLI) can read is one of the projections here. That
 * placement is the structural half of the redaction law: a tool that
 * forgets to redact must be impossible to write, so redaction (S2)
 * lands in the record→projection mapping, never in tool code — and no
 * raw record can leak because no raw record type is importable.
 *
 * Bodies never ride the default projections: they are pulled on demand
 * through the lifecycle port's `request-body` message, never retained —
 * with ONE carve-out (PLAN §3): a failure body is pulled eagerly at
 * classification time, capped, counted against the ring's byte ceiling,
 * and surfaces as {@link TrafficBodyProjection} only when a consumer
 * asks for it explicitly.
 */

import type { RequestPhase } from '../request-lifecycle/types';
import type { LifecycleSource } from '../request-lifecycle/wire';
import type { TrafficResourceType } from './resource-type';

/** The two source families the tap can arm (PLAN §1 / §8 S1). */
export type TrafficSourceKind = 'browser-tab' | 'proxy';

/** One projected header. Sensitive values arrive as the stable
 *  `[redacted:<sha256-prefix>]` marker (see `./redaction`), applied at
 *  projection time — never by a consumer. */
export interface TrafficHeaderProjection {
  readonly name: string;
  readonly value: string;
}

/**
 * Cap on body text crossing to a consumer, in UTF-16 units — the same
 * agent-facing bound the MCP execute tier applies to response bodies.
 * Truncation is always flagged, never silent.
 */
export const TRAFFIC_BODY_CAP_CHARS = 100_000;

/**
 * One response body projected for consumers — a retained failure body
 * or an on-demand pull. Text content passes the token-shape redaction
 * scan at projection time (`redactBodyText`); base64 content rides
 * verbatim so binary round-trips uncorrupted.
 */
export interface TrafficBodyProjection {
  readonly content: string;
  readonly encoding: 'text' | 'base64';
  readonly truncated: boolean;
}

/** One hop of a redirect chain, projected: the URL that answered 3xx
 *  and the status it answered with. The final URL is the record's own
 *  `url` — the chain reads trail…, url (the lifecycle spine's
 *  `urlChain` shape). Hop URLs are redacted like `url`/`initiator`. */
export interface TrafficRedirectHopProjection {
  readonly url: string;
  readonly statusCode?: number;
}

/** One retained exchange, projected for consumers. */
export interface TrafficRecordProjection {
  readonly tabId: number;
  readonly requestId: string;
  readonly url: string;
  readonly method: string;
  readonly resourceType: TrafficResourceType;
  readonly initiator?: string;
  readonly phase: RequestPhase;
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly fromCache?: boolean;
  readonly error?: { readonly code: string; readonly reason: string };
  readonly startedAtMs: number;
  readonly completedAtMs?: number;
  readonly redirectHopCount: number;
  /**
   * Bounded per-hop URL trail for a redirected exchange — one entry per
   * 3xx hop, oldest first; the record's `url` is the chain's final stop.
   * Redirect hops fold into ONE record (never one row per hop), so this
   * trail is the only place the intermediate URLs survive. Present only
   * when the exchange redirected; may be shorter than `redirectHopCount`
   * when the trail bound trips.
   */
  readonly redirectTrail?: readonly TrafficRedirectHopProjection[];
  readonly requestHeaders?: readonly TrafficHeaderProjection[];
  readonly responseHeaders?: readonly TrafficHeaderProjection[];
  /** Decoded body size (HAR `content.size`) — the size fact, never the body. */
  readonly bodyBytes?: number;
  /**
   * The retained failure body (PLAN §3 carve-out), present only when the
   * consumer asked for bodies AND the record classified as an HTTP
   * failure whose body the tap captured at classification time. Success
   * bodies never appear here — they are pulled on demand.
   */
  readonly failureBody?: TrafficBodyProjection;
  /** Encoded wire bytes (HAR `_transferSize`); `0` for cache hits. */
  readonly transferBytes?: number;
  readonly mimeType?: string;
  /** Which correlator fed the record at mint time. Provenance is stamped
   *  when the record is created and never re-derived from row shape. */
  readonly provenance: LifecycleSource;
}

/** One armed source, projected for consumers. An UNARMED source has no
 *  projection at all — absence, not a disabled row (PLAN §4). */
export interface TrafficSourceProjection {
  readonly uid: string;
  readonly kind: TrafficSourceKind;
  /** Partition label — `tab <tabId> @ <nodeId>` or the proxy partition. */
  readonly label: string;
  /** Structured partition identity (browser-tab sources) — surfaces map
   *  armed state back to a rail row without parsing labels. */
  readonly nodeId?: string;
  readonly tabId?: number;
  readonly armedAtMs: number;
  /**
   * When the arm lapses (S2): an armed source streams, so an idle one —
   * no observe reads — auto-disarms at this wall-clock instant rather
   * than streaming forever. Reads push it forward; disarm is absence.
   */
  readonly expiresAtMs: number;
  /** `streaming` while the subscription is live; `refused` when the
   *  peer's consent gate rejected the watch; `ended` after disarm. */
  readonly state: 'streaming' | 'refused' | 'ended';
}

/** Content-free operational counters for one source's ring. */
export interface TrafficRetentionStats {
  readonly recordCount: number;
  readonly byteSize: number;
  readonly maxRecords: number;
  readonly maxBytes: number;
  /** Records dropped off the ring's head by the count or byte bound. */
  readonly evictedCount: number;
  /** Replayed records refused because they started at or below the arm
   *  floor — the "retention starts at arm time" law, enforced here. */
  readonly droppedPreArm: number;
  /** Replayed records refused because the ring had already evicted them
   *  — a reconnect replay must never resurrect evicted history. */
  readonly droppedEvictedReplay: number;
  /** `ready` envelopes folded so far — 1 for a clean stream; each extra
   *  is a reconnect epoch the dedup path absorbed. */
  readonly readyEpochs: number;
}
