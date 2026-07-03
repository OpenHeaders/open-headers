/**
 * Pure HAR projection — shapes a hop's accumulated state into the
 * lifecycle updates the builder emits: the request-header `phase` patch
 * and the `har-attached` entry. No builder state is touched; everything
 * is read from the passed {@link RequestHarState}.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

import {
  cdpBlockedTimings,
  cdpInitiatorToHar,
  cdpRawTiming,
  cdpRequestToHar,
  cdpResponseToHar,
  cdpTimingToHar,
  harTimeFromTimings,
  headerRecordToHar,
} from '../cdp-har-synth';
import { connectionIdString, isDiskCacheHit, type RequestHarState } from './state';

/**
 * A `phase` patch carrying the current hop's request headers + their
 * provisional status, or `undefined` when there is no live hop to describe.
 * Effective headers are the on-the-wire set once paired, else the cooked
 * request set — the same `extra ?? cooked` precedence the HAR uses; provisional
 * means the on-the-wire set has not arrived. Emitted only for the live hop
 * cursor so a late lower-hop extra cannot patch a superseded hop's headers
 * back onto the lifecycle's current hop.
 */
export function requestHeaderUpdate(
  tabId: number,
  requestId: string,
  state: RequestHarState,
  hopIndex: number,
): RequestLifecycleUpdate | undefined {
  if (hopIndex !== state.hopCursor) return undefined;
  const hop = state.hops[hopIndex];
  if (hop === undefined) return undefined;
  const wire = state.requestExtraByHop[hopIndex];
  return {
    kind: 'phase',
    tabId,
    requestId,
    patch: {
      requestHeaders: headerRecordToHar(wire ?? hop.request.headers),
      requestHeadersProvisional: wire === undefined,
    },
  };
}

export function emitHop(
  tabId: number,
  requestId: string,
  state: RequestHarState,
  hopIndex: number,
): RequestLifecycleUpdate | undefined {
  const hop = state.hops[hopIndex];
  if (hop === undefined) return undefined;
  const response = hop.response;
  const requestExtra = state.requestExtraByHop[hopIndex];
  const responseExtra = state.responseExtraByHop[hopIndex];
  const connectionId = connectionIdString(response?.connectionId);
  const timings =
    response?.timing !== undefined
      ? cdpTimingToHar(response.timing, hop.totalMs, hop.issuedSec)
      : // A failed-before-response hop has no ResourceTiming; attribute the
        // whole span to `blocked`, matching Chrome's no-response branch.
        hop.error !== undefined && hop.totalMs !== undefined
        ? cdpBlockedTimings(hop.totalMs)
        : undefined;
  // The unfolded raw instants behind the export-dialect `timings` — only a
  // hop with real ResourceTiming carries them (a synthesized blocked
  // response has no instants to unfold).
  const rawTiming =
    response?.timing !== undefined
      ? cdpRawTiming(response.timing, hop.issuedSec, hop.responseReceivedSec, hop.terminalSec)
      : undefined;
  // `time` is the leg-sum once a terminal arrives (matching Chrome); a
  // pre-terminal partial leaves it absent, the signal that it has not
  // refined yet.
  const time =
    hop.totalMs === undefined ? undefined : timings !== undefined ? harTimeFromTimings(timings) : hop.totalMs;
  const diskCacheHit = isDiskCacheHit(response, hop.transferSize);
  // Key order mirrors Chrome's exporter (`EntryDTO`); `pageref` is
  // appended downstream by the HAR exporter.
  const har: InspectorHarEntry = {
    _initiator: cdpInitiatorToHar(hop.initiator),
    _priority: hop.request.initialPriority ?? null,
    // Request side: `requestWillBeSentExtraInfo` carries the on-the-wire
    // set, captured after the engine's rewrite — an applied modification
    // is visible there. Response side: ground-truthed PRE-rewrite for a
    // wire-crossing response — the fire-evidence probe
    // (playground/scripts/probe-fire-evidence.mjs) observed
    // `responseReceivedExtraInfo` holding the server's original header
    // while the page received the DNR-rewritten value, so a response
    // claim can never be judged against it and the section stays `raw`.
    // A disk-cache hit never crossed the wire: its cooked response set is
    // the SERVED one with the engine's rewrite re-applied (probe-observed
    // carrying the rewritten value), so that case alone is `effective` —
    // unless an ExtraInfo set landed anyway, which supersedes the cooked
    // headers wholesale and is wire-raw by definition.
    _ohHeaderCapture: {
      request: requestExtra !== undefined ? 'effective' : 'raw',
      response: diskCacheHit && responseExtra === undefined ? 'effective' : 'raw',
    },
    _ohEntrySource: 'cdp',
    ...(hop.resourceType !== undefined ? { _resourceType: hop.resourceType.toLowerCase() } : {}),
    // Empty object, HAR-spec-required and emitted on every Chrome entry.
    cache: {},
    ...(response?.remotePort !== undefined ? { connection: String(response.remotePort) } : {}),
    request: cdpRequestToHar(hop.request, response?.protocol, requestExtra),
    ...(response !== undefined
      ? { response: cdpResponseToHar(response, hop.transferSize, hop.contentSize, hop.error, responseExtra) }
      : {}),
    // IPv6 normalization, matched verbatim to Chrome's exporter (it strips
    // only an empty `[]` sequence; real bracketed addresses pass through).
    // Always present, like Chrome (`''` when no peer address is known).
    serverIPAddress: (response?.remoteIPAddress ?? '').replace(/\[\]/g, ''),
    startedDateTime: hop.startedDateTime,
    ...(time !== undefined ? { time } : {}),
    ...(timings !== undefined ? { timings } : {}),
    ...(isDiskCacheHit(response, hop.transferSize) ? { _fromCache: 'disk' } : {}),
    ...(connectionId !== undefined ? { _connectionId: connectionId } : {}),
    ...(rawTiming !== undefined ? { _rawTiming: rawTiming } : {}),
  };
  return { kind: 'har-attached', tabId, requestId, hopIndex, har };
}
