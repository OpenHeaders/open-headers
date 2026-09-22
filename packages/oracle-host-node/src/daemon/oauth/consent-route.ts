/**
 * Where a browser goes to decide on a pending authorization (the client
 * sign-in plan §14.4). The consent page is a ROUTE OF THE WEB APP,
 * entered like the OIDC callback enters it — an opaque handle in the
 * fragment (`/#authorize=<id>`), never the request's parameters — so
 * the SPA can approve as the signed-in person with the session bearer
 * it already holds. Where the SPA cannot exist the OAuth handler
 * renders the same record as a server-side page with the credential
 * form (`/auth/oauth/authorize/<id>`): two renderings of one record.
 *
 * "The SPA can exist" is decided the way the web app decides it at
 * boot (`window.isSecureContext`): the web bundle is served AND the
 * origin the browser reached is potentially trustworthy — an https
 * scheme (a trusted proxy's `X-Forwarded-Proto`) or a loopback name in
 * the Host header (`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`).
 * A plain-http LAN address is where the web app refuses to boot, so it
 * is where the fallback page renders.
 *
 * The SSO round-trip's refusal rides the same location with the reason
 * appended (`&error=` in the fragment, `?error=` on the page) so both
 * renderings show it beside the record.
 */

import type { IncomingMessage } from 'node:http';
import type { ApproveAuthorizationResult } from '@openheaders/core/identity';
import { resolveExternalOrigin } from '../../host-runtime/external-origin';

/** The fragment key the SPA's consent entry reads (S9). */
export const CONSENT_FRAGMENT_KEY = 'authorize';
/** The server-rendered consent page's path prefix, followed by the id. */
export const CONSENT_PAGE_PREFIX = '/auth/oauth/authorize/';

export interface ConsentRouterOptions {
  /** Is the web bundle served on this bind (a live getter on the desktop, fixed on the daemon)? */
  readonly spaServed: () => boolean;
  /** Same trust posture as the admission control's peer resolution. */
  readonly trustedProxy?: boolean;
}

export interface ConsentRouter {
  /** Can the web app boot at the origin this request reached? */
  spaHosts(req: IncomingMessage): boolean;
  /** The location a browser is sent to decide on `id`, with the SSO arm's refusal when there is one. */
  location(req: IncomingMessage, id: string, error?: string): string;
}

/** The secure-contexts notion of a loopback host, as a browser judges the URL it navigated to. */
export function isLoopbackHostHeader(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  let hostname: string;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname;
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname === '[::1]') return true;
  return hostname.startsWith('127.');
}

export function fallbackConsentLocation(id: string, error?: string): string {
  const base = `${CONSENT_PAGE_PREFIX}${encodeURIComponent(id)}`;
  return error ? `${base}?error=${encodeURIComponent(error)}` : base;
}

export function spaConsentLocation(id: string, error?: string): string {
  const base = `/#${CONSENT_FRAGMENT_KEY}=${encodeURIComponent(id)}`;
  return error ? `${base}&error=${encodeURIComponent(error)}` : base;
}

/**
 * The redirect target of an approved code grant — `redirect_uri?code&state&iss`
 * (RFC 6749 §4.1.2, RFC 9207). Built wherever an approval lands in a
 * browser: the decision routes and the OIDC callback.
 */
export function authorizationRedirectTarget(
  approved: Extract<ApproveAuthorizationResult, { grant: 'code' }>,
  issuer: string,
): string {
  const url = new URL(approved.redirectUri);
  url.searchParams.set('code', approved.code);
  url.searchParams.set('state', approved.state);
  url.searchParams.set('iss', issuer);
  return url.toString();
}

export function createConsentRouter(options: ConsentRouterOptions): ConsentRouter {
  const spaHosts = (req: IncomingMessage): boolean => {
    if (!options.spaServed()) return false;
    const origin = resolveExternalOrigin(req, { trustedProxy: options.trustedProxy });
    return origin.startsWith('https:') || isLoopbackHostHeader(req.headers.host);
  };
  return {
    spaHosts,
    location(req, id, error) {
      return spaHosts(req) ? spaConsentLocation(id, error) : fallbackConsentLocation(id, error);
    },
  };
}
