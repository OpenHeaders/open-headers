/**
 * Authorization-server discovery (RFC 8414 + OpenID Connect Discovery
 * 1.0) — the candidate URLs per issuer shape, the issuer match, the
 * fill rules and every fact rule.
 */

import { describe, expect, it } from 'vitest';
import {
  applyDiscoveredMetadata,
  clientAuthenticationMethodOf,
  discoveryFacts,
  grantTypeOf,
  hasUnlistedPick,
  type OAuth2ServerMetadata,
  parseAuthorizationServerMetadata,
  planDiscovery,
} from '../../src/oauth';
import type { OAuth2Auth } from '../../src/types/request';

const ISSUER = 'https://auth.openheaders.io';

function makeConfig(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-discovery',
    flow: 'authorization-code-pkce',
    tokenEndpoint: 'https://auth.openheaders.io/old/token',
    clientId: 'oh-client-id',
    scopes: ['openid'],
    ...overrides,
  };
}

const DOCUMENT: Record<string, unknown> = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  device_authorization_endpoint: `${ISSUER}/device`,
  revocation_endpoint: `${ISSUER}/revoke`,
  jwks_uri: `${ISSUER}/jwks`,
  scopes_supported: ['openid', 'profile', 'email'],
  grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'],
  token_endpoint_auth_signing_alg_values_supported: ['ES256', 'RS256'],
  code_challenge_methods_supported: ['S256'],
  dpop_signing_alg_values_supported: ['ES256'],
};

function metadata(overrides: Partial<OAuth2ServerMetadata> = {}): OAuth2ServerMetadata {
  return { ...parseAuthorizationServerMetadata(DOCUMENT, ISSUER), ...overrides };
}

describe('planDiscovery', () => {
  it('reads a bare origin issuer in the OpenID form, then the RFC 8414 form', () => {
    expect(planDiscovery(ISSUER)).toEqual({
      issuer: ISSUER,
      candidates: [`${ISSUER}/.well-known/openid-configuration`, `${ISSUER}/.well-known/oauth-authorization-server`],
    });
  });

  it('strips a trailing slash and ignores surrounding whitespace', () => {
    expect(planDiscovery(`  ${ISSUER}/  `).issuer).toBe(ISSUER);
  });

  it('inserts the RFC 8414 segment before a path issuer and adds the inserted OpenID form', () => {
    expect(planDiscovery(`${ISSUER}/realms/oh`)).toEqual({
      issuer: `${ISSUER}/realms/oh`,
      candidates: [
        `${ISSUER}/realms/oh/.well-known/openid-configuration`,
        `${ISSUER}/.well-known/oauth-authorization-server/realms/oh`,
        `${ISSUER}/.well-known/openid-configuration/realms/oh`,
      ],
    });
  });

  it('accepts a pasted OpenID well-known URL, reading it first and deriving the issuer', () => {
    const plan = planDiscovery(`${ISSUER}/realms/oh/.well-known/openid-configuration`);
    expect(plan.issuer).toBe(`${ISSUER}/realms/oh`);
    expect(plan.candidates[0]).toBe(`${ISSUER}/realms/oh/.well-known/openid-configuration`);
    expect(plan.candidates).toHaveLength(3);
  });

  it('accepts a pasted RFC 8414 inserted URL and derives the issuer path behind the segment', () => {
    const plan = planDiscovery(`${ISSUER}/.well-known/oauth-authorization-server/realms/oh`);
    expect(plan.issuer).toBe(`${ISSUER}/realms/oh`);
    expect(plan.candidates[0]).toBe(`${ISSUER}/.well-known/oauth-authorization-server/realms/oh`);
  });

  it('refuses a query string, a fragment, a non-http scheme and a non-URL', () => {
    expect(() => planDiscovery(`${ISSUER}?x=1`)).toThrow(/no query string or fragment/);
    expect(() => planDiscovery(`${ISSUER}#frag`)).toThrow(/no query string or fragment/);
    expect(() => planDiscovery('ftp://auth.openheaders.io')).toThrow(/http\(s\) URL/);
    expect(() => planDiscovery('not a url')).toThrow(/is not a URL/);
  });
});

describe('parseAuthorizationServerMetadata', () => {
  it('folds the document into the metadata shape', () => {
    expect(parseAuthorizationServerMetadata(DOCUMENT, ISSUER)).toEqual({
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      deviceAuthorizationEndpoint: `${ISSUER}/device`,
      revocationEndpoint: `${ISSUER}/revoke`,
      jwksUri: `${ISSUER}/jwks`,
      scopesSupported: ['openid', 'profile', 'email'],
      grantTypesSupported: ['authorization_code', 'client_credentials', 'refresh_token'],
      tokenEndpointAuthMethodsSupported: ['client_secret_basic', 'private_key_jwt'],
      tokenEndpointAuthSigningAlgValuesSupported: ['ES256', 'RS256'],
      codeChallengeMethodsSupported: ['S256'],
      dpopSigningAlgValuesSupported: ['ES256'],
    });
  });

  it('leaves an omitted list absent rather than defaulting it', () => {
    const parsed = parseAuthorizationServerMetadata({ issuer: ISSUER, token_endpoint: `${ISSUER}/token` }, ISSUER);
    expect(parsed.grantTypesSupported).toBeUndefined();
    expect(parsed.codeChallengeMethodsSupported).toBeUndefined();
    expect(parsed.authorizationEndpoint).toBeUndefined();
  });

  it('drops non-string list entries and blank strings', () => {
    const parsed = parseAuthorizationServerMetadata(
      { issuer: ISSUER, scopes_supported: ['openid', 4, null], token_endpoint: '  ' },
      ISSUER,
    );
    expect(parsed.scopesSupported).toEqual(['openid']);
    expect(parsed.tokenEndpoint).toBeUndefined();
  });

  it('matches the issuer as a normalized URL — the root slash is not a difference', () => {
    expect(parseAuthorizationServerMetadata({ issuer: `${ISSUER}/` }, ISSUER).issuer).toBe(`${ISSUER}/`);
  });

  it('refuses a document naming another issuer, or none', () => {
    expect(() => parseAuthorizationServerMetadata({ issuer: 'https://other.openheaders.io' }, ISSUER)).toThrow(
      /names issuer "https:\/\/other.openheaders.io", expected/,
    );
    expect(() => parseAuthorizationServerMetadata({ issuer: `${ISSUER}/realms/oh` }, ISSUER)).toThrow(/expected/);
    expect(() => parseAuthorizationServerMetadata({ token_endpoint: `${ISSUER}/token` }, ISSUER)).toThrow(
      /names no issuer/,
    );
  });
});

describe('applyDiscoveredMetadata', () => {
  it('writes the three endpoints the document carries and records the issuer', () => {
    const { config, filled } = applyDiscoveredMetadata(makeConfig(), metadata());
    expect(config.issuer).toBe(ISSUER);
    expect(config.authorizationEndpoint).toBe(`${ISSUER}/authorize`);
    expect(config.deviceAuthorizationEndpoint).toBe(`${ISSUER}/device`);
    expect(config.tokenEndpoint).toBe(`${ISSUER}/token`);
    expect(filled).toEqual(['authorizationEndpoint', 'deviceAuthorizationEndpoint', 'tokenEndpoint']);
  });

  it('leaves an endpoint the document omits untouched', () => {
    const base = makeConfig({ authorizationEndpoint: 'https://auth.openheaders.io/old/authorize' });
    const { config, filled } = applyDiscoveredMetadata(
      base,
      metadata({ authorizationEndpoint: undefined, deviceAuthorizationEndpoint: undefined }),
    );
    expect(config.authorizationEndpoint).toBe('https://auth.openheaders.io/old/authorize');
    expect(config.deviceAuthorizationEndpoint).toBeUndefined();
    expect(filled).toEqual(['tokenEndpoint']);
  });

  it('moves nothing else — the grant, the client authentication, the binding and the preset stay', () => {
    const base = makeConfig({
      flow: 'client-credentials',
      clientAuthentication: 'private-key-jwt',
      tokenBinding: 'dpop',
      providerPresetId: 'okta',
      refreshEndpoint: 'https://auth.openheaders.io/old/refresh',
      sendAs: 'query',
    });
    const { config } = applyDiscoveredMetadata(base, metadata());
    expect(config).toMatchObject({
      flow: 'client-credentials',
      clientAuthentication: 'private-key-jwt',
      tokenBinding: 'dpop',
      providerPresetId: 'okta',
      refreshEndpoint: 'https://auth.openheaders.io/old/refresh',
      sendAs: 'query',
    });
  });
});

describe('clientAuthenticationMethodOf / grantTypeOf', () => {
  it('names the wire method by the config, none for a public client', () => {
    expect(clientAuthenticationMethodOf(makeConfig())).toBe('none');
    expect(clientAuthenticationMethodOf(makeConfig({ clientAuthentication: 'basic-header' }))).toBe('none');
    expect(clientAuthenticationMethodOf(makeConfig({ clientSecret: 's' }))).toBe('client_secret_post');
    expect(clientAuthenticationMethodOf(makeConfig({ clientSecret: 's', clientAuthentication: 'basic-header' }))).toBe(
      'client_secret_basic',
    );
    expect(clientAuthenticationMethodOf(makeConfig({ clientAuthentication: 'private-key-jwt' }))).toBe(
      'private_key_jwt',
    );
    expect(clientAuthenticationMethodOf(makeConfig({ clientAuthentication: 'client-secret-jwt' }))).toBe(
      'client_secret_jwt',
    );
  });

  it('names the grant_type the flow POSTs', () => {
    expect(grantTypeOf(makeConfig())).toBe('authorization_code');
    expect(grantTypeOf(makeConfig({ flow: 'client-credentials' }))).toBe('client_credentials');
    expect(grantTypeOf(makeConfig({ flow: 'password-credentials' }))).toBe('password');
    expect(grantTypeOf(makeConfig({ flow: 'device-code' }))).toBe('urn:ietf:params:oauth:grant-type:device_code');
    expect(grantTypeOf(makeConfig({ flow: 'jwt-bearer' }))).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
  });
});

describe('discoveryFacts', () => {
  it('reads the grant, PKCE and the scopes for a public PKCE client — no client-authentication fact', () => {
    expect(discoveryFacts(makeConfig(), metadata())).toEqual([
      {
        kind: 'grant-type',
        grantType: 'authorization_code',
        supported: ['authorization_code', 'client_credentials', 'refresh_token'],
        listed: true,
      },
      { kind: 'pkce', supported: ['S256'], listed: true },
      { kind: 'scopes', supported: ['openid', 'profile', 'email'] },
    ]);
  });

  it('flags a client authentication the document does not list', () => {
    const facts = discoveryFacts(makeConfig({ clientSecret: 's' }), metadata());
    expect(facts[0]).toEqual({
      kind: 'client-authentication',
      method: 'client_secret_post',
      supported: ['client_secret_basic', 'private_key_jwt'],
      listed: false,
    });
    expect(hasUnlistedPick(facts)).toBe(true);
  });

  it('flags a grant the document does not list', () => {
    const facts = discoveryFacts(makeConfig({ flow: 'device-code' }), metadata());
    expect(facts.find((f) => f.kind === 'grant-type')).toMatchObject({ listed: false });
    expect(facts.find((f) => f.kind === 'pkce')).toBeUndefined();
  });

  it('reads the DPoP and assertion algorithms against their lists and the issuer as the audience', () => {
    const facts = discoveryFacts(
      makeConfig({
        flow: 'client-credentials',
        clientAuthentication: 'private-key-jwt',
        assertionAlgorithm: 'PS256',
        tokenBinding: 'dpop',
      }),
      metadata(),
    );
    expect(facts).toEqual([
      {
        kind: 'client-authentication',
        method: 'private_key_jwt',
        supported: ['client_secret_basic', 'private_key_jwt'],
        listed: true,
      },
      {
        kind: 'grant-type',
        grantType: 'client_credentials',
        supported: ['authorization_code', 'client_credentials', 'refresh_token'],
        listed: true,
      },
      { kind: 'dpop-algorithm', algorithm: 'ES256', supported: ['ES256'], listed: true },
      { kind: 'assertion-algorithm', algorithm: 'PS256', supported: ['ES256', 'RS256'], listed: false },
      { kind: 'audience', issuer: ISSUER },
      { kind: 'scopes', supported: ['openid', 'profile', 'email'] },
    ]);
  });

  it('defaults the assertion algorithm by method — HS256 under the secret, RS256 under a key', () => {
    const secret = discoveryFacts(makeConfig({ clientAuthentication: 'client-secret-jwt' }), metadata());
    expect(secret.find((f) => f.kind === 'assertion-algorithm')).toMatchObject({ algorithm: 'HS256', listed: false });
    const key = discoveryFacts(makeConfig({ clientAuthentication: 'private-key-jwt' }), metadata());
    expect(key.find((f) => f.kind === 'assertion-algorithm')).toMatchObject({ algorithm: 'RS256', listed: true });
  });

  it('names the audience for the JWT bearer grant without an assertion-algorithm fact', () => {
    const facts = discoveryFacts(makeConfig({ flow: 'jwt-bearer' }), metadata());
    expect(facts.find((f) => f.kind === 'audience')).toEqual({ kind: 'audience', issuer: ISSUER });
    expect(facts.find((f) => f.kind === 'assertion-algorithm')).toBeUndefined();
  });

  it('says nothing for a list the document omits', () => {
    const bare = parseAuthorizationServerMetadata({ issuer: ISSUER, token_endpoint: `${ISSUER}/token` }, ISSUER);
    expect(discoveryFacts(makeConfig({ clientSecret: 's', tokenBinding: 'dpop' }), bare)).toEqual([]);
    expect(hasUnlistedPick([])).toBe(false);
  });
});
