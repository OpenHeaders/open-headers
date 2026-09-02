/**
 * The OAuth 2.0 grant-type UI model — which fields each grant renders
 * and the persisted flow it maps back to. A leaf module so the editor
 * and the example-card builder read one table.
 *
 * The dropdown offers the flows that actually run end-to-end on both
 * hosts: Authorization Code with and without PKCE (the same wire flow
 * — the persisted grantType suppresses the PKCE pair, see `usesPkce`
 * in core/oauth), Client Credentials, Password Credentials, JWT
 * Bearer (RFC 7523 §2.1 — the signed assertion IS the grant; no
 * authorize leg, no refresh token), and Device Code (RFC 8628 — the
 * user approves on any device while the host polls; the headless
 * hosts' one interactive grant). Implicit is removed by OAuth 2.1 and
 * stays out.
 */

import type { OAuth2Auth, OAuth2Flow } from '@openheaders/core/types';

export type GrantTypeId =
  | 'authorization-code-pkce'
  | 'authorization-code'
  | 'client-credentials'
  | 'password-credentials'
  | 'jwt-bearer'
  | 'device-code';

export interface GrantTypeDef {
  id: GrantTypeId;
  label: string;
  /** The `grant_type` value the token request carries. */
  wire:
    | 'authorization_code'
    | 'client_credentials'
    | 'password'
    | 'urn:ietf:params:oauth:grant-type:jwt-bearer'
    | 'urn:ietf:params:oauth:grant-type:device_code';
  /** Which fields to render when this grant type is active. */
  fields: {
    callbackUrl: boolean;
    authUrl: boolean;
    /** The device authorization endpoint (RFC 8628 §3.1). */
    deviceAuthUrl: boolean;
    accessTokenUrl: boolean;
    clientId: boolean;
    clientSecret: boolean;
    resourceOwner: boolean;
    pkce: boolean;
    scope: boolean;
    state: boolean;
    /** The grant assertion's own claims (issuer / subject / claims JSON). */
    assertion: boolean;
  };
  /** Maps back to the persisted flow. */
  v5Flow: OAuth2Flow;
}

export const GRANT_TYPES: GrantTypeDef[] = [
  {
    id: 'authorization-code-pkce',
    label: 'Authorization Code (With PKCE)',
    wire: 'authorization_code',
    fields: {
      callbackUrl: true,
      authUrl: true,
      deviceAuthUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: true,
      scope: true,
      state: true,
      assertion: false,
    },
    v5Flow: 'authorization-code-pkce',
  },
  {
    id: 'authorization-code',
    label: 'Authorization Code',
    wire: 'authorization_code',
    fields: {
      callbackUrl: true,
      authUrl: true,
      deviceAuthUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: true,
      assertion: false,
    },
    v5Flow: 'authorization-code-pkce',
  },
  {
    id: 'client-credentials',
    label: 'Client Credentials',
    wire: 'client_credentials',
    fields: {
      callbackUrl: false,
      authUrl: false,
      deviceAuthUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: false,
      assertion: false,
    },
    v5Flow: 'client-credentials',
  },
  {
    id: 'password-credentials',
    label: 'Password Credentials',
    wire: 'password',
    fields: {
      callbackUrl: false,
      authUrl: false,
      deviceAuthUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: true,
      pkce: false,
      scope: true,
      state: false,
      assertion: false,
    },
    v5Flow: 'password-credentials',
  },
  {
    id: 'jwt-bearer',
    label: 'JWT Bearer',
    wire: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    fields: {
      callbackUrl: false,
      authUrl: false,
      deviceAuthUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: false,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: false,
      assertion: true,
    },
    v5Flow: 'jwt-bearer',
  },
  {
    id: 'device-code',
    label: 'Device Code',
    wire: 'urn:ietf:params:oauth:grant-type:device_code',
    fields: {
      callbackUrl: false,
      authUrl: false,
      deviceAuthUrl: true,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: false,
      assertion: false,
    },
    v5Flow: 'device-code',
  },
];

export function getGrantType(auth: OAuth2Auth): GrantTypeDef {
  // Prefer the persisted UI choice. A row that stored a grant type we
  // don't offer (`implicit`) falls through to the working flow its
  // wire `flow` already maps to.
  if (auth.grantType) {
    const match = GRANT_TYPES.find((g) => g.id === auth.grantType);
    if (match) return match;
  }
  const byFlow = GRANT_TYPES.find((g) => g.v5Flow === auth.flow);
  return byFlow ?? GRANT_TYPES[0];
}
