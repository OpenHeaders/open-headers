/**
 * DPoP nonces (RFC 9449 §8 / §9) — the per-origin cache every proof
 * reads and every response feeds. A server that wants a nonce answers
 * the first proof with a challenge and a `DPoP-Nonce`; the client
 * repeats the request once with it and keeps sending it until the
 * server rotates (a fresh `DPoP-Nonce` on any response replaces it).
 *
 * Host-resident, in memory: the node hosts keep it for the process,
 * the extension SW loses it on idle — the next send pays one retry,
 * which is the RFC's own recovery path. Keyed by origin because a
 * nonce is the server's (§8: "the authorization server's", §9: "the
 * resource server's"), not the URL's.
 */

const nonces = new Map<string, string>();

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The nonce the server at `url`'s origin last issued, if any. */
export function dpopNonceFor(url: string): string | undefined {
  const origin = originOf(url);
  return origin === null ? undefined : nonces.get(origin);
}

/** Remember a nonce a response carried; `undefined` is a no-op so a
 *  caller can pass `dpopNonceOf(headers)` straight through. */
export function rememberDpopNonce(url: string, nonce: string | undefined): void {
  if (nonce === undefined) return;
  const origin = originOf(url);
  if (origin !== null) nonces.set(origin, nonce);
}

/** Forget every nonce — test isolation. */
export function __resetDpopNoncesForTests(): void {
  nonces.clear();
}
