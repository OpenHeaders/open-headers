/**
 * Request transport seam — the one host-specific port the host-neutral
 * chain request executor calls out to for the actual network round-trip.
 *
 * The seam carries ONLY plain data in both directions: a normalized
 * {@link TransportRequest} in, a {@link TransportResponse} out (or a
 * {@link TransportError} thrown). It never traffics platform fetch
 * objects (`Request` / `Response` / `RequestInit` / `Headers` /
 * `FormData`). Two reasons:
 *
 *   1. **Type isolation.** `@openheaders/oracle` compiles under the
 *      `node` lib; the browser SW under the DOM lib. A `Response` that
 *      crossed the seam would be a different nominal type on each side.
 *      Plain records unify cleanly.
 *   2. **Out-of-process survival.** When the engine later runs in a
 *      daemon / remote VM (see the public/private split), the transport
 *      becomes the host's local network capability — each host owns its
 *      own `fetch`. A data-only seam is the same contract whether the
 *      transport is in-process or behind an RPC.
 *
 * Body construction (URLSearchParams / FormData / raw string), the
 * offline pre-flight, host-access gating, and error classification are
 * all the transport's concern — they differ per host (the browser SW
 * gets `navigator.onLine` + `chrome.permissions`; Node gets a richer
 * `err.cause` it can classify precisely). The executor stays blind to
 * all of it.
 */

/** A single header on the wire. Repeated keys are allowed (the host
 *  appends them in order). */
export interface TransportHeader {
  key: string;
  value: string;
}

/**
 * Normalized request body. The executor resolves the domain
 * `RequestBody` union down to this wire shape — including reading file
 * blobs to bytes — so the transport only has to materialize host fetch
 * primitives from plain data.
 */
export type TransportBody =
  | { kind: 'none' }
  /** Pre-serialized text payload (json / xml / text / graphql). The
   *  Content-Type is already on `headers` when the user didn't set one. */
  | { kind: 'raw'; content: string }
  /** `application/x-www-form-urlencoded` — the host builds URLSearchParams
   *  and lets it set the Content-Type. */
  | { kind: 'urlencoded'; fields: ReadonlyArray<{ name: string; value: string }> }
  /** `multipart/form-data` — the host builds FormData and lets it set the
   *  Content-Type WITH the generated boundary (any user-set multipart
   *  Content-Type is already stripped from `headers`). */
  | { kind: 'multipart'; parts: ReadonlyArray<TransportMultipartPart> };

export type TransportMultipartPart =
  | { kind: 'text'; name: string; value: string }
  | { kind: 'file'; name: string; filename: string; mimeType: string; bytes: Uint8Array<ArrayBuffer> };

export interface TransportRequest {
  method: string;
  /** Scheme-normalized, query-appended, ready to hit the wire. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
  body: TransportBody;
  /** `'manual'` surfaces the first 3xx verbatim; `'follow'` chases it. */
  redirect: 'follow' | 'manual';
  /** Cookie-jar policy. `'omit'` unless the request opted into `'include'`. */
  credentials: 'omit' | 'include';
}

export interface TransportResponse {
  status: number;
  statusText: string;
  /** Final URL after any redirects. */
  url: string;
  headers: ReadonlyArray<TransportHeader>;
  /** Full response body as text — the executor applies the byte cap. */
  body: string;
}

/**
 * Thrown by a transport when the request never produced a response
 * (DNS failure, connection refused, offline, abort, missing host
 * permission). `message` is the host's already-classified,
 * user-actionable string — the executor surfaces it verbatim on the
 * snapshot's `error` field. A 4xx / 5xx is NOT an error here: the
 * transport resolves normally so extractors can read error bodies and
 * status-code gates can branch.
 */
export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface RequestTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}
