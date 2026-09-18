/**
 * The redirect policy — ONE source for every request loop that follows
 * a chain: which statuses redirect, the chain's ceiling, how the next
 * hop derives from the current one (the fetch spec's method/body
 * demotion and the cross-origin Authorization strip, each relaxable by
 * its knob), and the per-hop record the snapshot carries. The node
 * transport's follower applies it over its own wire hops; the
 * delegating transport applies it over single-hop exchanges at the
 * place (the Execution Place plan: the context decides every hop, the
 * place opens each socket — so the context's cookie jar speaks on
 * every hop and captures from every hop, exactly as an in-process jar
 * does). Pure: no wire, no clock.
 */

import { type TransportBody, TransportError, type TransportHeader, type TransportRedirectHop } from './transport';

/** Redirect-hop ceiling when the request carries no `maxRedirects`. */
export const DEFAULT_MAX_REDIRECTS = 20;

/** 3xx statuses that redirect. 304 (and any 3xx without a `Location`
 *  header) is a final response, per the fetch spec. */
export const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** Request-body metadata headers dropped alongside the body when a
 *  301/302/303 hop demotes the method to GET (fetch-spec behavior). */
const BODY_HEADERS = new Set([
  'content-length',
  'content-type',
  'content-encoding',
  'content-language',
  'content-location',
]);

/** One hop's request as the loop carries it between redirects. */
export interface RedirectHop {
  url: string;
  method: string;
  headers: ReadonlyArray<TransportHeader>;
  body: TransportBody;
}

/** The knobs that relax the spec's derivation. */
export interface RedirectKnobs {
  followOriginalHttpMethod?: boolean;
  followAuthorizationHeader?: boolean;
}

export interface NextRedirectHop {
  hop: RedirectHop;
  /** Present when the spec's method demotion fired. */
  methodChangedTo?: string;
  /** What happened to a carried `Authorization` when the hop crossed origin. */
  authorization?: 'stripped' | 'forwarded';
}

/** The `Location` a response redirects to — null for a final response
 *  (a 3xx without one included). */
export function redirectLocation(status: number, headers: ReadonlyArray<TransportHeader>): string | null {
  if (!REDIRECT_STATUSES.has(status)) return null;
  return headers.find((h) => h.key.toLowerCase() === 'location')?.value ?? null;
}

/** The chain's ceiling, hit — the request's own limit named. */
export function redirectLimitError(maxRedirects: number): TransportError {
  return new TransportError(`Stopped after ${maxRedirects} redirects — the request's redirect limit.`);
}

/**
 * Derive the next hop from a redirect response: resolve the (possibly
 * relative) `Location` against the current URL, apply the spec's
 * method/body demotion (301/302 POST→GET, 303 any-non-GET/HEAD→GET;
 * 307/308 always preserve) unless `followOriginalHttpMethod` keeps it,
 * and strip `Authorization` when the hop crosses origin unless
 * `followAuthorizationHeader` keeps it. What the derivation DID —
 * method demotion, Authorization strip/forward — is reported alongside
 * so the caller can record the hop and mark the response.
 */
export function nextRedirectHop(
  prev: RedirectHop,
  status: number,
  location: string,
  knobs: RedirectKnobs,
): NextRedirectHop {
  let nextUrl: URL;
  try {
    nextUrl = new URL(location, prev.url);
  } catch {
    throw new TransportError(`Redirect points to an invalid URL: "${location}".`);
  }
  let method = prev.method;
  let body = prev.body;
  let headers = prev.headers;
  const demoteToGet =
    knobs.followOriginalHttpMethod !== true &&
    ((status === 303 && method !== 'GET' && method !== 'HEAD') ||
      ((status === 301 || status === 302) && method === 'POST'));
  if (demoteToGet) {
    method = 'GET';
    body = { kind: 'none' };
    headers = headers.filter((h) => !BODY_HEADERS.has(h.key.toLowerCase()));
  }
  let authorization: 'stripped' | 'forwarded' | undefined;
  const crossOrigin = new URL(prev.url).origin !== nextUrl.origin;
  if (crossOrigin && headers.some((h) => h.key.toLowerCase() === 'authorization')) {
    if (knobs.followAuthorizationHeader === true) {
      authorization = 'forwarded';
    } else {
      authorization = 'stripped';
      headers = headers.filter((h) => h.key.toLowerCase() !== 'authorization');
    }
  }
  return {
    hop: { url: nextUrl.toString(), method, headers, body },
    ...(demoteToGet ? { methodChangedTo: method } : {}),
    ...(authorization !== undefined ? { authorization } : {}),
  };
}

/** The snapshot's record of a hop that redirected — what was sent,
 *  what came back, what the derivation did. */
export function redirectHopRecord(
  hop: RedirectHop,
  status: number,
  statusText: string,
  location: string,
  next: NextRedirectHop,
): TransportRedirectHop {
  return {
    url: hop.url,
    method: hop.method,
    status,
    statusText,
    location,
    ...(next.methodChangedTo !== undefined ? { methodChangedTo: next.methodChangedTo } : {}),
    ...(next.authorization !== undefined ? { authorization: next.authorization } : {}),
  };
}
