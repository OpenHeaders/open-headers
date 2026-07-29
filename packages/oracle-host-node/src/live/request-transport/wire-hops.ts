/**
 * The wire pipelines below the seam — one round-trip for one hop, on
 * whichever pipeline can carry it faithfully: undici fetch for
 * ordinary hops, undici `request()` for GET/HEAD-with-body and gRPC
 * hops, and the hand-rolled prior-knowledge h2 session for every hop
 * of a `'2-prior-knowledge'` send. All three share the deadline, the
 * error classification, and the `HopResponse` surface the policy layer
 * above consumes.
 */

import { STATUS_CODES } from 'node:http';
import { Readable } from 'node:stream';
import {
  TransportError,
  type TransportHeader,
  type TransportRequest,
} from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher } from 'undici';
import { Headers } from 'undici';
import { h2PriorKnowledgeHop } from '../h2-prior-knowledge';
import { classifyFetchFailure } from './classify-error';
import { buildBody, buildH2Body, buildHeaders, buildRequestBody } from './hop-body';
import {
  type Deadline,
  type H2Leg,
  type HopResponse,
  type HopState,
  type NodeFetchFn,
  type NodeRequestFn,
  type NodeRequestInit,
  type NodeRequestResponse,
  timeoutError,
} from './seam';

/** True when the hop's method forbids a fetch() body — the WHATWG rule
 *  for GET/HEAD — while the hop still carries one. Those hops take the
 *  `request()` wire path, which enforces no such rule. */
function bodylessMethodWithBody(hop: HopState): boolean {
  const method = hop.method.toUpperCase();
  return (method === 'GET' || method === 'HEAD') && hop.body.kind !== 'none';
}

/** True when the hop declares a gRPC exchange (`Content-Type:
 *  application/grpc*`). Those hops take the `request()` wire path too —
 *  the only pipeline that exposes HTTP trailers, where gRPC puts its
 *  `grpc-status`/`grpc-message` (probed: undici fetch surfaces no
 *  trailers at all). The trade — `request()` advertises no
 *  Accept-Encoding and applies no transparent decompression — is moot
 *  here: gRPC compresses per message frame, never the HTTP body. */
function grpcHop(hop: HopState): boolean {
  return hop.headers.some(
    (h) => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().startsWith('application/grpc'),
  );
}

/** One wire round-trip for a hop, on whichever pipeline can carry it:
 *  the prior-knowledge h2 session for EVERY hop of a
 *  `'2-prior-knowledge'` send (it carries GET/HEAD bodies and native
 *  trailers itself); otherwise fetch for every ordinary hop,
 *  `request()` for a GET/HEAD hop with a body (fetch refuses to
 *  construct those) and for gRPC hops (fetch exposes no trailers —
 *  see {@link grpcHop}). */
export async function wireHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  h2: H2Leg | null,
): Promise<HopResponse> {
  if (h2 !== null) return h2Hop(request, hop, deadline, h2);
  if (bodylessMethodWithBody(hop) || grpcHop(hop)) return requestHop(requestFn, request, hop, deadline, dispatcher);
  return fetchHop(fetchFn, request, hop, deadline, dispatcher);
}

/**
 * One wire round-trip over the prior-knowledge h2 pipeline — a fresh
 * `node:http2` session speaking the h2 preface from its first byte,
 * TLS and cleartext alike (see `h2-prior-knowledge.ts`). Rides the
 * same deadline and error classification as the other wire paths and
 * adapts onto the same hop surface via {@link adaptRequestResponse}
 * (the stream is the body; trailers fill after the capped read).
 */
async function h2Hop(request: TransportRequest, hop: HopState, deadline: Deadline, h2: H2Leg): Promise<HopResponse> {
  const { payload, contentType } = await buildH2Body(hop.body);
  const headers =
    contentType !== undefined && !hop.headers.some((h) => h.key.toLowerCase() === 'content-type')
      ? [...hop.headers, { key: 'content-type', value: contentType }]
      : hop.headers;
  try {
    const response = await h2PriorKnowledgeHop({
      url: hop.url,
      method: hop.method.toUpperCase(),
      headers,
      ...(payload !== undefined ? { payload } : {}),
      connect: h2.connect,
      ...(deadline ? { signal: deadline.signal } : {}),
      onProtocol: h2.onProtocol,
    });
    return adaptRequestResponse(hop.url, response);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/** One wire round-trip over fetch. Always `redirect: 'manual'` — the
 *  chain is chased (or surfaced) by the caller, never by undici. */
async function fetchHop(
  fetchFn: NodeFetchFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<HopResponse> {
  const init: NodeRequestInit = {
    method: hop.method,
    headers: buildHeaders(hop.headers),
    redirect: 'manual',
    // No ambient cookie jar in the main process, so `credentials` has
    // nothing to ride — cookies only travel when the send's opt-in jar
    // attached a header upstream (see `withJarCookie`).
  };
  // The per-request connection policy rides EVERY hop of the chain.
  if (dispatcher !== undefined) init.dispatcher = dispatcher;
  const body = buildBody(hop.body);
  if (body !== undefined) init.body = body;
  if (deadline) init.signal = deadline.signal;
  try {
    return await fetchFn(hop.url, init);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/**
 * One wire round-trip over undici `request()` — the pipeline for hops
 * fetch cannot carry faithfully: a GET/HEAD hop with a body (WHATWG
 * fetch refuses to construct one, but HTTP allows it and real APIs use
 * it) and gRPC hops (fetch exposes no HTTP trailers, where gRPC puts
 * its status). Rides the same dispatcher, deadline, and error
 * classification as the fetch path; never follows redirects on its
 * own, matching the fetch path's `redirect: 'manual'`.
 */
async function requestHop(
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
): Promise<HopResponse> {
  const { body, contentType } = buildRequestBody(hop.body);
  const headers = buildHeaders(hop.headers);
  if (contentType !== undefined && !headers.has('content-type')) headers.set('content-type', contentType);
  try {
    const response = await requestFn(hop.url, {
      method: hop.method.toUpperCase(),
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(dispatcher !== undefined ? { dispatcher } : {}),
      ...(deadline ? { signal: deadline.signal } : {}),
    });
    return adaptRequestResponse(hop.url, response);
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw new TransportError(classifyFetchFailure(hop.url, err, request));
  }
}

/** Flatten undici's `Record<string, string | string[]>` field shape to
 *  seam headers, arrays entry-wise. */
function transportHeadersOf(record: Record<string, string | string[] | undefined>): TransportHeader[] {
  const out: TransportHeader[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) out.push({ key, value: v });
    } else {
      out.push({ key, value });
    }
  }
  return out;
}

/**
 * Map an undici `request()` result onto the hop surface: headers
 * re-minted as fetch `Headers` (`set-cookie` arrays preserved
 * entry-wise for the jar), the body's Node stream bridged to a web
 * stream for the capped read, the reason phrase from the canonical
 * status table (`request()` does not surface one), and trailers as a
 * thunk over undici's live trailers object — it fills only once the
 * body has been consumed, so the reader must ask after the capped read.
 */
function adaptRequestResponse(url: string, response: NodeRequestResponse): HopResponse {
  const headers = new Headers();
  for (const { key, value } of transportHeadersOf(response.headers)) headers.append(key, value);
  return {
    status: response.statusCode,
    statusText: STATUS_CODES[response.statusCode] ?? '',
    url,
    headers,
    body: Readable.toWeb(response.body),
    trailers: () => transportHeadersOf(response.trailers ?? {}),
  };
}
