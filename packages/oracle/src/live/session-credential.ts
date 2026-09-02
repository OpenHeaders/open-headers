/**
 * Session credentials — what a WebSocket handshake or a gRPC call
 * carries for the auth types the per-kind mask admits beyond the
 * static pairs. The HTTP send's two-step discipline, applied to the
 * session kinds: {@link resolveSessionCredential} runs at the
 * pre-wire pass (every template resolves with the other Connect /
 * Invoke-time fields, so an unresolved reference gates the session
 * before the wire), and {@link mintSessionCredential} runs at the
 * WIRE — once per invoke on gRPC, once per DIAL on WebSocket, so an
 * auto-reconnect minutes later never redials with a stale signature
 * (SigV4's date window), a spent JWT `exp`, or an OAuth token the
 * store has since renewed.
 *
 * The mint returns what the dial adds: header pairs (a same-key user
 * row still wins at the executor — one value rides the wire), query
 * pairs appended to the dial URL, or the URL itself re-signed (the
 * AWS query mode — the signed URL is the credential), plus the bearer
 * token a Socket.IO CONNECT payload carries in-band when the type is
 * bearer-shaped. Placements the kind cannot carry never reach here:
 * the mask refuses them by name at resolution.
 */

import {
  type AwsSigV4Credentials,
  type JwtCredentials,
  sha256Hex,
  signAwsSigV4,
  signJwtBearer,
} from '@openheaders/core/auth-signing';
import type { ConcreteAuthConfig, OAuth2Auth } from '@openheaders/core/types';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { acquireOAuth2Bundle, type OAuthRefreshFn, oauth2AuthorizationValue } from './request-exec/oauth2-bundle';

export interface SessionPair {
  key: string;
  value: string;
}

/** The resolved credential the dial mints from — templates already
 *  resolved, nothing signed yet. */
export type SessionCredentialCarry =
  | { kind: 'pair'; placement: 'header' | 'query'; pair: SessionPair; bearerToken?: string }
  | { kind: 'oauth2'; auth: OAuth2Auth }
  | { kind: 'jwt'; credentials: JwtCredentials }
  | { kind: 'aws-sigv4'; credentials: AwsSigV4Credentials };

/**
 * Resolve the applied config into its carry; `null` when nothing
 * contributes — `none`, a suspended config, or an empty resolved
 * credential (partial configs stay saveable — the HTTP auth block's
 * posture). Every templated field resolves through `resolveStr` so
 * the caller's unresolved set fills before the wire.
 */
export function resolveSessionCredential(
  auth: ConcreteAuthConfig,
  resolveStr: (template: string) => string,
): SessionCredentialCarry | null {
  if (auth.disabled === true) return null;
  switch (auth.type) {
    case 'bearer': {
      const token = resolveStr(auth.token).trim();
      if (token === '') return null;
      return {
        kind: 'pair',
        placement: 'header',
        pair: { key: 'Authorization', value: `Bearer ${token}` },
        bearerToken: token,
      };
    }
    case 'basic': {
      const username = resolveStr(auth.username);
      const password = resolveStr(auth.password);
      if (username === '' && password === '') return null;
      const token = encodeBase64Bytes(new TextEncoder().encode(`${username}:${password}`));
      return { kind: 'pair', placement: 'header', pair: { key: 'Authorization', value: `Basic ${token}` } };
    }
    case 'api-key': {
      const key = resolveStr(auth.key).trim();
      if (key === '') return null;
      return { kind: 'pair', placement: auth.in, pair: { key, value: resolveStr(auth.value) } };
    }
    case 'oauth2':
      return { kind: 'oauth2', auth };
    case 'jwt':
      return {
        kind: 'jwt',
        credentials: {
          algorithm: auth.algorithm,
          secret: resolveStr(auth.secret),
          ...(auth.secretBase64 === true ? { secretBase64: true } : {}),
          privateKey: resolveStr(auth.privateKey),
          payload: resolveStr(auth.payload),
          ...(auth.headers !== undefined ? { headers: resolveStr(auth.headers) } : {}),
          ...(auth.headerPrefix !== undefined ? { headerPrefix: resolveStr(auth.headerPrefix) } : {}),
          addTo: auth.addTo,
          ...(auth.expiresInSeconds !== undefined ? { expiresInSeconds: auth.expiresInSeconds } : {}),
        },
      };
    case 'aws-sigv4':
      return {
        kind: 'aws-sigv4',
        credentials: {
          accessKeyId: resolveStr(auth.accessKeyId),
          secretAccessKey: resolveStr(auth.secretAccessKey),
          ...(auth.sessionToken ? { sessionToken: resolveStr(auth.sessionToken) } : {}),
          service: resolveStr(auth.service),
          region: resolveStr(auth.region),
          ...(auth.addTo ? { addTo: auth.addTo } : {}),
        },
      };
    default:
      return null;
  }
}

export interface MintSessionCredentialInput {
  /** The dial URL as it stands before the credential — every user
   *  param appended, the Socket.IO target resolved. */
  url: string;
  /** The header rows the transport will ship beside the credential —
   *  the AWS signature covers them (the browser's platform socket
   *  ships none, so a page-realm dial signs `host` alone). */
  headers: ReadonlyArray<SessionPair>;
  /** The workspace whose token store an OAuth bundle reads from. */
  workspaceId?: string;
  /** The host's silent-renewal hook; absent = the stored bundle as is. */
  refreshOAuth?: OAuthRefreshFn;
  /** The mint instant — the JWT clock and the signature date. */
  now: Date;
}

export interface MintedSessionCredential {
  /** Header pairs the dial adds (a same-key user row wins). */
  headers: SessionPair[];
  /** Query pairs appended to the dial URL (values not yet encoded). */
  query: SessionPair[];
  /** The dial URL re-signed — set only when the credential IS the URL. */
  url?: string;
  /** The bearer token a Socket.IO CONNECT payload carries in-band. */
  bearerToken?: string;
}

const NOTHING: MintedSessionCredential = { headers: [], query: [] };

/** Mint the wire form of a carry at the dial — see the module note. A
 *  signer's refusal (a JWT payload that is not JSON, an AWS scope the
 *  host cannot derive) throws with the type named. */
export async function mintSessionCredential(
  carry: SessionCredentialCarry,
  input: MintSessionCredentialInput,
): Promise<MintedSessionCredential> {
  switch (carry.kind) {
    case 'pair':
      return {
        headers: carry.placement === 'header' ? [carry.pair] : [],
        query: carry.placement === 'query' ? [carry.pair] : [],
        ...(carry.bearerToken !== undefined ? { bearerToken: carry.bearerToken } : {}),
      };
    case 'oauth2': {
      const bundle = await acquireOAuth2Bundle(carry.auth, {
        ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
        ...(input.refreshOAuth !== undefined ? { refreshOAuth: input.refreshOAuth } : {}),
      });
      if (bundle === null) return NOTHING;
      if (carry.auth.sendAs === 'query') {
        return {
          headers: [],
          query: [{ key: 'access_token', value: bundle.accessToken }],
          bearerToken: bundle.accessToken,
        };
      }
      return {
        headers: [{ key: 'Authorization', value: oauth2AuthorizationValue(carry.auth, bundle) }],
        query: [],
        bearerToken: bundle.accessToken,
      };
    }
    case 'jwt': {
      let signed: Awaited<ReturnType<typeof signJwtBearer>>;
      try {
        signed = await signJwtBearer(carry.credentials, { timestampSec: Math.floor(input.now.getTime() / 1000) });
      } catch (err) {
        throw new Error(`JWT Bearer signing failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { headers: signed.headers, query: signed.queryParams, bearerToken: signed.token };
    }
    case 'aws-sigv4': {
      try {
        const signed = await signAwsSigV4(carry.credentials, {
          method: 'GET',
          url: input.url,
          headers: input.headers,
          payloadHash: await sha256Hex(''),
          now: input.now,
        });
        return { headers: signed.headers, query: [], url: signed.url };
      } catch (err) {
        throw new Error(`AWS SigV4 signing failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
