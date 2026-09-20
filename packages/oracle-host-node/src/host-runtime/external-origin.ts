/**
 * The origin a browser reached this daemon at, as the daemon should
 * name it back — in an IdP redirect URI, in the approve URL a client
 * opens. An explicit override (config `oidc.redirectOrigin`) wins;
 * otherwise the admission-validated `Host` header names the address
 * (the daemon does not know its external names — a reverse proxy or
 * the LAN address decides them), and only a trusted proxy can vouch
 * for TLS termination through `X-Forwarded-Proto`.
 */

import type { IncomingMessage } from 'node:http';

export interface ExternalOriginOptions {
  /** A configured external origin, used verbatim (trailing slash dropped). */
  readonly override?: string;
  /** Same trust posture as the admission control's peer resolution. */
  readonly trustedProxy?: boolean;
}

export function resolveExternalOrigin(req: IncomingMessage, options: ExternalOriginOptions = {}): string {
  if (options.override) return options.override.replace(/\/$/, '');
  const host = req.headers.host ?? '127.0.0.1';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    options.trustedProxy && typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https'
      ? 'https'
      : 'http';
  return `${proto}://${host}`;
}
