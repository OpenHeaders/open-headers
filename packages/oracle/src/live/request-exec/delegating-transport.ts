/**
 * The delegating request transport — a {@link RequestTransport} whose
 * socket opens on ANOTHER host. The context's executor resolves,
 * signs, runs scripts and builds its snapshot exactly as it does for
 * an in-process send; only the round-trip moves: the seam's request
 * rides the `delegateRequest` channel (`delegated-wire.ts`) to the
 * chosen place, the place's live `requestStreamEvent` frames feed the
 * executor's own stream observer, its answer comes back as the seam's
 * response with the answering host's stamp, and its classified failure
 * as a {@link TransportError} carrying the same stamp.
 *
 * Host-neutral: the wire itself is injected ({@link DelegatedWire}) —
 * the extension's service worker rides its backend wire client, the
 * desktop app's main process its client toward a server. The
 * transport mints its OWN send id per exchange for the wire: the
 * place's frames and the Stop rider are keyed by it, so they never
 * collide with the context's caller-minted id (the context's own
 * emitter re-broadcasts what this transport feeds the observer).
 * The executor's abort signal (Stop / deadline) forwards as the
 * place's `abortRequestSend`; the place answers with the partial body
 * and `streamEndedEarly`, exactly as an in-process transport would.
 *
 * The cookie jar stays the CONTEXT's (Phase W): with a jar registry
 * injected, a send that opted into the jar (`cookieJarKey`) gets the
 * jar's `Cookie` attached before the frame leaves and its answered
 * `Set-Cookie` rows captured — the key itself never rides, the place
 * holds no jar. The seam's jar facts are stamped on the response as
 * an in-process transport would stamp them.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { DELEGATE_REQUEST_CHANNEL } from '@openheaders/core/protocol';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { type CookieJar, captureSetCookieRows, withJarCookieHeader } from './cookie-jar';
import { type DelegatedRequestFrame, type DelegatedRequestResult, encodeDelegatedRequest } from './delegated-wire';
import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamObserver,
} from './transport';

/** The wire a delegating transport rides — one place, already chosen
 *  by an explicit backend id (never the default wire). */
export interface DelegatedWire {
  /** Send the frame and await the place's answer. Rejects on a dead
   *  wire or the place's refusal (the opt-in / capability strings),
   *  which the transport surfaces as a classified failure. */
  call(frame: DelegatedRequestFrame): Promise<DelegatedRequestResult>;
  /** Ask the place to stop the send it knows by this id. */
  abort(sendId: string): void;
  /** Claim the place's live frames for this id until the disposer runs. */
  subscribeFrames(sendId: string, onFrame: (event: RequestStreamEventWire) => void): () => void;
}

export interface DelegatingTransportOptions {
  wire: DelegatedWire;
  /** The gate's subject on the place — the context's workspace. */
  workspaceId: string;
  /** The context's jar registry by key — absent on a context whose
   *  jar is its network stack's own (the browser's cookie store). */
  jars?: (key: string) => CookieJar;
  /** Injectable for tests; defaults to a random UUID per exchange. */
  mintSendId?: () => string;
}

const NO_OBSERVER: TransportStreamObserver = { onHead: () => {}, onChunk: () => {} };

export function createDelegatingRequestTransport(options: DelegatingTransportOptions): RequestTransport {
  const mintSendId = options.mintSendId ?? (() => crypto.randomUUID());

  async function exchange(
    original: TransportRequest,
    observer: TransportStreamObserver,
    signal: AbortSignal | undefined,
  ): Promise<TransportResponse> {
    const sendId = mintSendId();
    // The context's jar speaks before the frame leaves — the place
    // never sees the key, only the header the jar contributed.
    const jar =
      options.jars !== undefined && original.cookieJarKey !== undefined ? options.jars(original.cookieJarKey) : null;
    const outgoing = jar !== null ? withJarCookieHeader(jar, original.url, original.headers) : null;
    const request = outgoing !== null ? { ...original, headers: outgoing.headers } : original;
    const unsubscribe = options.wire.subscribeFrames(sendId, (event) => {
      if (event.kind === 'head') {
        observer.onHead(event.head);
      } else if (event.kind === 'chunk') {
        const bytes = decodeBase64Bytes(event.chunkBase64);
        if (bytes !== null) observer.onChunk(bytes, event.totalBytes);
      }
    });
    const onAbort = (): void => options.wire.abort(sendId);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await options.wire.call({
        type: DELEGATE_REQUEST_CHANNEL,
        sendId,
        workspaceId: options.workspaceId,
        request: encodeDelegatedRequest(request),
      });
      if (result.success) {
        const response: TransportResponse = { ...result.response, executedOn: result.executedOn };
        if (jar === null) return response;
        // The answered rows feed the context's jar; the facts ride the
        // snapshot exactly as an in-process jar leg stamps them.
        const captured = captureSetCookieRows(jar, response.url, response.headers);
        return {
          ...response,
          ...(outgoing?.attached !== undefined ? { cookieHeaderAttached: outgoing.attached } : {}),
          ...(captured.length > 0 ? { cookiesCaptured: captured } : {}),
        };
      }
      throw new TransportError(result.error, result.hint, result.executedOn);
    } catch (err) {
      if (err instanceof TransportError) throw err;
      // A dead wire or the place's refusal — already a user-facing
      // sentence (the protocol's opt-in strings, the capability denial).
      throw new TransportError(err instanceof Error ? err.message : String(err));
    } finally {
      signal?.removeEventListener('abort', onAbort);
      unsubscribe();
    }
  }

  return {
    send: (request) => exchange(request, NO_OBSERVER, undefined),
    sendStreaming: (request, observer, signal) => exchange(request, observer, signal),
  };
}
