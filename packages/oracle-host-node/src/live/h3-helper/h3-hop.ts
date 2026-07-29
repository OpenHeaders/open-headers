/**
 * HTTP/3 hop — the wire pipeline behind the seam's `httpVersion: '3'`,
 * one framed round-trip over the helper client. Shaped as the
 * transport's `NodeRequestResponse` so the policy layer above (redirect
 * chain, digest leg, jar, deadline, capped read) adapts it exactly like
 * the h2 pipeline: the hop resolves at the response head with a
 * Readable fed by RESPONSE_BODY frames as the body, and trailers as the
 * live ask-after-the-read record.
 *
 * Header hygiene is the h2 rule set applied node-side (the helper
 * builds only pseudo-headers): connection-specific fields dropped, `te`
 * surviving only as `trailers`, a user-set `Host` folded into the
 * head's `authority`. RESPONSE_HEAD is wire truth — the helper sends it
 * only after real HTTP/3 framing came back, so `onProtocol` reports
 * `'h3'` there, never from the knob.
 *
 * Honest failure: a pre-head ERROR frame rejects the hop with the
 * helper's classified failure for the transport's classifier to name
 * the setting; post-head errors destroy the body stream (the
 * `request()` contract). The caller's signal (the merged deadline)
 * cancels the helper exchange — pre-head it rejects, post-head it
 * errors the body read. Destroying the body (the capped read's abort)
 * cancels the exchange too, so the helper never streams into a closed
 * sink.
 */

import { Readable } from 'node:stream';
import type { TransportHeader } from '@openheaders/oracle/live/request-exec/transport';
import type { NodeRequestResponse } from '../request-transport/seam';
import type { H3HelperClient, H3HelperFailure } from './helper-process';
import type { H3ClientCert, H3HeaderPair, H3RequestHead } from './protocol';

export interface H3HopRequest {
  url: string;
  method: string;
  headers: ReadonlyArray<TransportHeader>;
  /** Body bytes to send — absent ends the exchange at the head. */
  payload?: string | Uint8Array;
  /** `sslVerification: false`. */
  insecure?: boolean;
  clientCert?: H3ClientCert;
  /** resolveToAddress pin. */
  connectAddress?: string;
  client: H3HelperClient;
  signal?: AbortSignal;
  /** Reports the protocol this exchange SPOKE, keyed like the other
   *  pipelines' facts (`hostname:port`). Fired at the response head —
   *  wire truth, never the knob echoed. */
  onProtocol?(origin: string, alpnProtocol: string): void;
}

/** Connection-specific headers HTTP/3 forbids (the h2 rule carried
 *  over — RFC 9114 inherits RFC 9113's field-hygiene). */
const H3_CONNECTION_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
]);

/** The hop's headers as protocol pairs: connection-specific fields
 *  dropped, `te` surviving only as `trailers`, a user-set `Host`
 *  extracted as the head's `authority` (its h3 spelling). */
function protocolHeadersFor(headers: ReadonlyArray<TransportHeader>): {
  pairs: H3HeaderPair[];
  authority?: string;
} {
  const pairs: H3HeaderPair[] = [];
  let authority: string | undefined;
  for (const { key, value } of headers) {
    const name = key.toLowerCase();
    if (H3_CONNECTION_HEADERS.has(name)) continue;
    if (name === 'te' && value.trim().toLowerCase() !== 'trailers') continue;
    if (name === 'host') {
      authority = value;
      continue;
    }
    pairs.push([name, value]);
  }
  return { pairs, ...(authority !== undefined ? { authority } : {}) };
}

/** Protocol pairs folded to the `request()`-shaped record the
 *  transport's adapter reads — repeats into arrays, Node's encoding. */
function recordOf(pairs: H3HeaderPair[]): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of pairs) {
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

export function h3Hop(request: H3HopRequest): Promise<NodeRequestResponse> {
  const url = new URL(request.url);
  const origin = `${url.hostname}:${url.port !== '' ? url.port : '443'}`;
  const { pairs, authority } = protocolHeadersFor(request.headers);
  const payload =
    request.payload === undefined
      ? undefined
      : typeof request.payload === 'string'
        ? Buffer.from(request.payload, 'utf8')
        : request.payload;
  const head: H3RequestHead = {
    url: request.url,
    method: request.method,
    ...(authority !== undefined ? { authority } : {}),
    headers: pairs,
    bodyBytes: payload?.length ?? 0,
    ...(request.insecure === true ? { insecure: true } : {}),
    ...(request.clientCert !== undefined ? { clientCert: request.clientCert } : {}),
    ...(request.connectAddress !== undefined ? { connectAddress: request.connectAddress } : {}),
  };
  return new Promise<NodeRequestResponse>((resolve, reject) => {
    let settled = false;
    let ended = false;
    let body: Readable | null = null;
    // Live view: fills when the trailers frame arrives, before
    // RESPONSE_END — the transport's adapter asks only once the capped
    // read has consumed the stream, the same ask-after contract as the
    // other pipelines'.
    const trailers: Record<string, string | string[] | undefined> = {};

    const detachSignal = (): void => {
      request.signal?.removeEventListener('abort', onAbort);
    };
    const fail = (err: Error): void => {
      detachSignal();
      if (!settled) {
        settled = true;
        handle.cancel();
        reject(err);
        return;
      }
      if (!ended) body?.destroy(err);
    };
    const onAbort = (): void => {
      handle.cancel();
      fail(new Error('aborted'));
    };

    const handle = request.client.request(head, payload, {
      onHead: (response) => {
        if (settled) return;
        settled = true;
        request.onProtocol?.(origin, 'h3');
        body = new Readable({
          read() {},
          destroy(err, callback) {
            // The capped read (or an abort) tearing the body down must
            // stop the helper's stream too — never stream into a
            // closed sink.
            if (!ended) handle.cancel();
            detachSignal();
            callback(err);
          },
        });
        // A hop torn down before its body is read (client dispose, a
        // crash behind a buffered response) destroys the stream with
        // nobody listening — the no-op seat keeps that from surfacing
        // as an unhandled 'error'; actual readers still get the
        // failure through their own subscription.
        body.on('error', () => {});
        resolve({
          statusCode: response.status,
          headers: recordOf(response.headers),
          body,
          trailers,
        });
      },
      onBody: (chunk) => {
        body?.push(chunk);
      },
      onTrailers: (incoming) => {
        for (const [key, value] of Object.entries(recordOf(incoming))) trailers[key] = value;
      },
      onEnd: () => {
        ended = true;
        detachSignal();
        body?.push(null);
      },
      onError: (err: H3HelperFailure) => {
        fail(err);
      },
    });

    if (request.signal !== undefined) {
      if (request.signal.aborted) {
        onAbort();
        return;
      }
      request.signal.addEventListener('abort', onAbort);
    }
  });
}
