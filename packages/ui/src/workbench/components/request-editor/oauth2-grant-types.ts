/**
 * The OAuth 2.0 grant-type UI model — which fields each grant renders
 * and the persisted flow it maps back to. A leaf module so the editor
 * and the example-card builder read one table.
 *
 * The dropdown offers the flows that actually run end-to-end on a
 * browser extension: Authorization Code with and without PKCE (the
 * same wire flow — the persisted grantType suppresses the PKCE pair,
 * see `usesPkce` in core/oauth), Client Credentials, and Password
 * Credentials. Implicit is removed by OAuth 2.1 and Device Code earns
 * its keep only where there is no browser; both stay out until a real
 * integration needs one.
 */

import type { OAuth2Auth, OAuth2Flow } from '@openheaders/core/types';

export type GrantTypeId =
  | 'authorization-code-pkce'
  | 'authorization-code'
  | 'client-credentials'
  | 'password-credentials';

export interface GrantTypeDef {
  id: GrantTypeId;
  label: string;
  /** The `grant_type` value the token request carries. */
  wire: 'authorization_code' | 'client_credentials' | 'password';
  /** Which fields to render when this grant type is active. */
  fields: {
    callbackUrl: boolean;
    authUrl: boolean;
    accessTokenUrl: boolean;
    clientId: boolean;
    clientSecret: boolean;
    resourceOwner: boolean;
    pkce: boolean;
    scope: boolean;
    state: boolean;
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
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: true,
      scope: true,
      state: true,
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
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: true,
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
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: false,
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
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: true,
      pkce: false,
      scope: true,
      state: false,
    },
    v5Flow: 'password-credentials',
  },
];

export function getGrantType(auth: OAuth2Auth): GrantTypeDef {
  // Prefer the persisted UI choice. Rows that stored a grant type we
  // don't offer (`implicit` / `device-code`) fall through to the
  // working flow their wire `flow` already maps to.
  if (auth.grantType) {
    const match = GRANT_TYPES.find((g) => g.id === auth.grantType);
    if (match) return match;
  }
  const byFlow = GRANT_TYPES.find((g) => g.v5Flow === auth.flow);
  return byFlow ?? GRANT_TYPES[0];
}
