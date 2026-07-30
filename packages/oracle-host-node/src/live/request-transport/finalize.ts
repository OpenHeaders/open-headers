/**
 * Finalize the last hop into the seam's `TransportResponse`: surface
 * the head to a streaming observer, run the capped body read, ask for
 * trailers after it, and attribute phase timings, network facts, and
 * the always-on negotiated-protocol report.
 */

import type {
  TransportHeader,
  TransportNetworkFacts,
  TransportRedirectHop,
  TransportRequest,
  TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import type { ConnectionRecord } from '../instrumented-connector';
import { readCappedBody } from './capped-read';
import type { JarActivity } from './jar-leg';
import { type Deadline, type HopResponse, type StreamingLeg, timeoutError } from './seam';

/** Dispatch instants for the snapshot's phase timing — the send as a
 *  whole and the FINAL hop (the redirect/waiting boundary). Manual
 *  marks: undici exposes no per-request timings on either result
 *  surface, and its diagnostics_channel events carry no per-send
 *  correlation token (probed on 7.24.6) — so the transport measures
 *  the phases its own loop delimits. DNS/connect/TLS are not
 *  observable per send without an always-custom connector; they sit
 *  inside the waiting phase, and the view says so. */
export interface PhaseMarks {
  sentAt: number;
  finalHopSentAt: number;
}

/** Clamp a mark delta to a non-negative tenth of a millisecond. */
function phaseMs(ms: number): number {
  return Math.max(0, Math.round(ms * 10) / 10);
}

/**
 * Socket phase legs from the send's FIRST instrumented dial — the one
 * connection a redirect-free send rides end to end. A chained send's
 * dial belongs to its first hop, inside the redirect phase, so the
 * legs are omitted rather than mis-attributed. `readyAt` hands the
 * caller the waiting phase's true near edge.
 */
function socketLegsOf(
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  hadRedirects: boolean,
): { dnsMs?: number; connectMs?: number; tlsMs?: number; readyAt: number } | undefined {
  if (hadRedirects || capture === undefined) return undefined;
  const first = capture[0];
  if (first === undefined || first.readyAt === undefined) return undefined;
  if (first.tcpEndAt === undefined) {
    // A QUIC record (the `'3'` pipeline's instrumented dial): transport
    // establishment and TLS are ONE handshake, so there is no TCP leg —
    // the whole handshake lands in the TLS seat, `connectMs` absent.
    if (!first.tlsUsed) return undefined;
    return {
      ...(first.dnsEndAt !== undefined ? { dnsMs: phaseMs(first.dnsEndAt - first.startAt) } : {}),
      tlsMs: phaseMs(first.readyAt - (first.dnsEndAt ?? first.startAt)),
      readyAt: first.readyAt,
    };
  }
  return {
    ...(first.dnsEndAt !== undefined ? { dnsMs: phaseMs(first.dnsEndAt - first.startAt) } : {}),
    connectMs: phaseMs(first.tcpEndAt - (first.dnsEndAt ?? first.startAt)),
    ...(first.tlsUsed ? { tlsMs: phaseMs(first.readyAt - first.tcpEndAt) } : {}),
    readyAt: first.readyAt,
  };
}

/** `hostname:port` a URL's final hop dialed — the key connectors
 *  record their facts under (socket-path dials key by the path). */
function originOfUrl(finalUrl: string): string | undefined {
  try {
    const url = new URL(finalUrl);
    const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80';
    return `${url.hostname}:${port}`;
  } catch {
    return undefined;
  }
}

/**
 * The always-on negotiated protocol for a non-instrumented send: the
 * dispatcher's per-origin log entry for the connection that served
 * the final hop. Absent when the send had no log (proxied) or the
 * origin never completed a dial this dispatcher remembers.
 */
function negotiatedProtocolFor(
  negotiated: ReadonlyMap<string, string> | undefined,
  request: TransportRequest,
  finalUrl: string,
): string | undefined {
  if (negotiated === undefined) return undefined;
  if (request.unixSocketPath !== undefined) return negotiated.get(request.unixSocketPath);
  const origin = originOfUrl(finalUrl);
  return origin !== undefined ? negotiated.get(origin) : undefined;
}

/**
 * Connection facts for the socket that served the FINAL hop: the last
 * completed dial whose `hostname:port` matches the final URL (a
 * redirect chain dials once per origin; the final response rides the
 * last match). Falls back to the last completed dial when the origin
 * can't be matched (socket-path dials record the path).
 */
function networkFactsOf(
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  finalUrl: string,
): TransportNetworkFacts | undefined {
  if (capture === undefined) return undefined;
  const completed = capture.filter((c) => c.readyAt !== undefined);
  if (completed.length === 0) return undefined;
  const origin = originOfUrl(finalUrl);
  let record: ConnectionRecord | undefined;
  for (let i = completed.length - 1; i >= 0; i--) {
    if (completed[i]?.origin === origin) {
      record = completed[i];
      break;
    }
  }
  record ??= completed[completed.length - 1];
  if (record === undefined) return undefined;
  return {
    ...(record.alpnProtocol !== undefined ? { httpVersion: record.alpnProtocol } : {}),
    ...(record.localAddress !== undefined ? { localAddress: record.localAddress } : {}),
    ...(record.localPort !== undefined ? { localPort: record.localPort } : {}),
    ...(record.remoteAddress !== undefined ? { remoteAddress: record.remoteAddress } : {}),
    ...(record.remotePort !== undefined ? { remotePort: record.remotePort } : {}),
  };
}

/** Read the final response's body under the cap and map it to the
 *  seam's `TransportResponse`. Only ever called on the LAST hop —
 *  intermediate 3xx bodies are canceled, not read. A streaming leg
 *  surfaces the head to the observer BEFORE the read (so status +
 *  headers render while the body streams) and rides its chunks through
 *  the capped read; a mid-body abort or connection failure then
 *  materializes the partial body with `streamEndedEarly` instead of
 *  throwing — once the head is in, arrived bytes are never discarded. */
export async function finalizeResponse(
  response: HopResponse,
  request: TransportRequest,
  finalUrl: string,
  deadline: Deadline,
  authorizationForwarded: boolean,
  jarActivity: JarActivity | undefined,
  redirectChain: ReadonlyArray<TransportRedirectHop> | undefined,
  marks: PhaseMarks,
  streaming: StreamingLeg | null,
  capture?: ReadonlyArray<ConnectionRecord>,
  negotiated?: ReadonlyMap<string, string>,
): Promise<TransportResponse> {
  const headAt = performance.now();
  const headers: TransportHeader[] = [];
  response.headers.forEach((value, key) => {
    headers.push({ key, value });
  });
  streaming?.observer.onHead({
    status: response.status,
    statusText: response.statusText,
    url: response.url || finalUrl,
    headers,
  });
  let read: Awaited<ReturnType<typeof readCappedBody>>;
  try {
    read = await readCappedBody(
      response,
      request.maxBodyBytes,
      streaming !== null
        ? { onChunk: (bytes, totalBytes) => streaming.observer.onChunk(bytes, totalBytes), deadline }
        : undefined,
    );
  } catch (err) {
    if (deadline?.expired()) throw timeoutError(request.timeoutMs);
    throw err;
  }
  // The capped read just ended — the download phase's far edge.
  const readEndedAt = performance.now();
  // Trailers arrive after the body — ask only now that the capped read
  // has consumed it. Only `request()` hops carry the thunk (fetch
  // exposes no trailers); a truncated read may have canceled the
  // stream before they arrived, in which case the object is empty.
  const trailers = response.trailers?.() ?? [];
  const hadRedirects = redirectChain !== undefined && redirectChain.length > 0;
  // Instrumented sends split the socket legs out of Waiting; the
  // waiting phase then starts at socket readiness instead of dispatch.
  const legs = socketLegsOf(capture, hadRedirects);
  const network = networkFactsOf(capture, response.url || finalUrl);
  // The always-on protocol fact — from the instrumented dial's record
  // when the send had one, from the dispatcher's per-origin log
  // otherwise. Always the wire's answer, never the knob's.
  const wireVersion = network?.httpVersion ?? negotiatedProtocolFor(negotiated, request, response.url || finalUrl);
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url || finalUrl,
    headers,
    ...(trailers.length > 0 ? { trailers } : {}),
    ...(hadRedirects ? { redirectChain } : {}),
    phaseTimings: {
      ...(hadRedirects ? { redirectMs: phaseMs(marks.finalHopSentAt - marks.sentAt) } : {}),
      ...(legs !== undefined
        ? {
            ...(legs.dnsMs !== undefined ? { dnsMs: legs.dnsMs } : {}),
            ...(legs.connectMs !== undefined ? { connectMs: legs.connectMs } : {}),
            ...(legs.tlsMs !== undefined ? { tlsMs: legs.tlsMs } : {}),
          }
        : {}),
      waitingMs: phaseMs(headAt - (legs?.readyAt ?? marks.finalHopSentAt)),
      downloadMs: phaseMs(readEndedAt - headAt),
    },
    ...(network !== undefined ? { network } : {}),
    ...(wireVersion !== undefined ? { httpVersion: wireVersion } : {}),
    body: read.body,
    ...(read.bodyEncoding ? { bodyEncoding: read.bodyEncoding } : {}),
    bodyBytes: read.bodyBytes,
    bodyTruncated: read.bodyTruncated,
    ...(read.endedEarly !== undefined ? { streamEndedEarly: read.endedEarly } : {}),
    ...(authorizationForwarded ? { authorizationForwarded: true } : {}),
    ...(jarActivity?.cookieHeaderAttached !== undefined
      ? { cookieHeaderAttached: jarActivity.cookieHeaderAttached }
      : {}),
    ...(jarActivity !== undefined && jarActivity.cookiesCaptured.length > 0
      ? { cookiesCaptured: jarActivity.cookiesCaptured }
      : {}),
  };
}
