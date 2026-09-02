/**
 * Auth inheritance — THE rule. Pins:
 *   - the innermost level with a pool supplies the default (a folder's
 *     pool overrides the collection's); a transparent level passes
 *     through; `none` is a real entry that shadows outer levels;
 *   - `defaultAuthUid` names the default, else the first entry;
 *   - a named pick reaches any level's entry, inner first; a dangling
 *     pick falls back to the default and is reported;
 *   - a host-scoped entry applies ahead of the default when the URL
 *     host matches, never otherwise;
 *   - no pool anywhere = no auth, no source;
 *   - the pre-pool single `auth` field reads as a one-entry pool
 *     (an `inherit` one as transparent);
 *   - a request's own auth wins outright; a disabled Inherit still
 *     resolves and carries `disabled`;
 *   - `withDefaultAuthConfig` keeps the default entry's uid and the
 *     other entries; `withoutDefaultAuth` keeps the named entries.
 */

import { describe, expect, it } from 'vitest';
import {
  type AuthCarrier,
  assertAuthAllowed,
  authAllowedFor,
  authMaskFor,
  authPoolOf,
  authRefusalLabel,
  defaultAuthEntry,
  type EffectiveAuth,
  effectiveAuthFor,
  hostOf,
  LEGACY_AUTH_ENTRY_UID,
  matchesAppliesTo,
  resolveInheritedAuth,
  withDefaultAuthConfig,
  withoutDefaultAuth,
} from '../../src/auth-inheritance';
import type { AuthPoolEntry, ConcreteAuthConfig } from '../../src/types';

const ADMIN: AuthPoolEntry = { uid: 'admin001', name: 'Admin token', config: { type: 'bearer', token: '{{admin}}' } };
const USER: AuthPoolEntry = { uid: 'user0001', name: 'User token', config: { type: 'bearer', token: '{{user}}' } };
const NONE: AuthPoolEntry = { uid: 'none0001', name: 'Public', config: { type: 'none' } };
const SCOPED: AuthPoolEntry = {
  uid: 'scope001',
  name: 'Partner key',
  config: { type: 'api-key', key: 'X-Key', value: '{{partner}}', in: 'header' },
  appliesTo: '*.partner.openheaders.io',
};

const collection = (overrides: Partial<AuthCarrier> = {}): AuthCarrier => ({
  level: 'collection',
  uid: 'col00001',
  name: 'Payments',
  ...overrides,
});
const folder = (overrides: Partial<AuthCarrier> = {}): AuthCarrier => ({
  level: 'folder',
  uid: 'fld00001',
  name: 'Cards',
  ...overrides,
});

describe('authPoolOf / defaultAuthEntry', () => {
  it('a transparent carrier has no pool', () => {
    expect(authPoolOf(collection())).toBeNull();
    expect(authPoolOf(collection({ auths: [] }))).toBeNull();
    expect(defaultAuthEntry(collection())).toBeNull();
  });

  it('defaultAuthUid names the default, else the first entry', () => {
    expect(defaultAuthEntry(collection({ auths: [ADMIN, USER], defaultAuthUid: 'user0001' }))).toEqual(USER);
    expect(defaultAuthEntry(collection({ auths: [ADMIN, USER] }))).toEqual(ADMIN);
    expect(defaultAuthEntry(collection({ auths: [ADMIN, USER], defaultAuthUid: 'gone0000' }))).toEqual(ADMIN);
  });

  it('the pre-pool single field reads as a one-entry pool; an inherit one as transparent', () => {
    expect(authPoolOf(collection({ auth: { type: 'bearer', token: 't' } }))).toEqual({
      entries: [{ uid: LEGACY_AUTH_ENTRY_UID, name: '', config: { type: 'bearer', token: 't' } }],
      defaultUid: LEGACY_AUTH_ENTRY_UID,
    });
    expect(authPoolOf(collection({ auth: { type: 'inherit' } }))).toBeNull();
  });
});

describe('resolveInheritedAuth — the default', () => {
  it('takes the collection pool when it is the only one', () => {
    const r = resolveInheritedAuth([collection({ auths: [ADMIN] }), folder()], {}, null);
    expect(r.auth).toEqual(ADMIN.config);
    expect(r.source).toEqual({
      level: 'collection',
      uid: 'col00001',
      name: 'Payments',
      entryUid: 'admin001',
      entryName: 'Admin token',
    });
  });

  it("a folder's pool overrides the collection's default — innermost wins", () => {
    const r = resolveInheritedAuth([collection({ auths: [ADMIN] }), folder({ auths: [USER] })], {}, null);
    expect(r.auth).toEqual(USER.config);
    expect(r.source?.level).toBe('folder');
  });

  it("a folder's `none` entry is a real carrier — it shadows the collection's bearer", () => {
    const r = resolveInheritedAuth([collection({ auths: [ADMIN] }), folder({ auths: [NONE] })], {}, null);
    expect(r.auth).toEqual({ type: 'none' });
    expect(r.source?.entryName).toBe('Public');
  });

  it('a transparent folder passes through to the collection', () => {
    const r = resolveInheritedAuth([collection({ auths: [ADMIN] }), folder(), folder({ uid: 'fld00002' })], {}, null);
    expect(r.source?.level).toBe('collection');
  });

  it('no pool anywhere = no auth, no source', () => {
    expect(resolveInheritedAuth([collection(), folder()], {}, null)).toEqual({ auth: { type: 'none' }, source: null });
    expect(resolveInheritedAuth([], {}, null)).toEqual({ auth: { type: 'none' }, source: null });
  });
});

describe('resolveInheritedAuth — a named pick', () => {
  it("reaches a collection entry from under a folder with its own pool — the pick beats the folder's default", () => {
    const chain = [collection({ auths: [ADMIN, USER], defaultAuthUid: 'user0001' }), folder({ auths: [NONE] })];
    const r = resolveInheritedAuth(chain, { authUid: 'admin001' }, null);
    expect(r.auth).toEqual(ADMIN.config);
    expect(r.source).toMatchObject({ level: 'collection', entryUid: 'admin001' });
    expect(r.danglingAuthUid).toBeUndefined();
  });

  it('a dangling pick falls back to the default and is reported', () => {
    const r = resolveInheritedAuth([collection({ auths: [ADMIN] })], { authUid: 'gone0000' }, null);
    expect(r.auth).toEqual(ADMIN.config);
    expect(r.danglingAuthUid).toBe('gone0000');
    const none = resolveInheritedAuth([collection()], { authUid: 'gone0000' }, null);
    expect(none).toEqual({ auth: { type: 'none' }, source: null, danglingAuthUid: 'gone0000' });
  });
});

describe('resolveInheritedAuth — host scope', () => {
  it('a scoped entry applies ahead of the default when the host matches', () => {
    const chain = [collection({ auths: [ADMIN, SCOPED], defaultAuthUid: 'admin001' })];
    expect(resolveInheritedAuth(chain, {}, 'api.partner.openheaders.io').source?.entryUid).toBe('scope001');
    expect(resolveInheritedAuth(chain, {}, 'api.openheaders.io').source?.entryUid).toBe('admin001');
    expect(resolveInheritedAuth(chain, {}, null).source?.entryUid).toBe('admin001');
  });

  it('matchesAppliesTo — exact, wildcard, case, empty', () => {
    expect(matchesAppliesTo('api.openheaders.io', 'API.openheaders.io')).toBe(true);
    expect(matchesAppliesTo('*.openheaders.io', 'api.openheaders.io')).toBe(true);
    expect(matchesAppliesTo('*.openheaders.io', 'openheaders.io')).toBe(false);
    expect(matchesAppliesTo('api.*', 'api.openheaders.io')).toBe(true);
    expect(matchesAppliesTo('*', 'anything.io')).toBe(true);
    expect(matchesAppliesTo('', 'api.openheaders.io')).toBe(false);
    expect(matchesAppliesTo(undefined, 'api.openheaders.io')).toBe(false);
    expect(matchesAppliesTo('api.openheaders.io', null)).toBe(false);
  });

  it('hostOf reads the hostname, port excluded; a template-only draft has none', () => {
    expect(hostOf('https://api.openheaders.io:8443/v1')).toBe('api.openheaders.io');
    expect(hostOf('{{base}}/v1')).toBeNull();
  });
});

describe('effectiveAuthFor', () => {
  it("the request's own auth wins outright with source `request`", () => {
    const r = effectiveAuthFor({ type: 'basic', username: 'u', password: 'p' }, [collection({ auths: [ADMIN] })], null);
    expect(r).toEqual({ auth: { type: 'basic', username: 'u', password: 'p' }, source: { level: 'request' } });
  });

  it('a disabled Inherit still resolves and carries `disabled`', () => {
    const r = effectiveAuthFor({ type: 'inherit', disabled: true }, [collection({ auths: [ADMIN] })], null);
    expect(r.auth).toEqual({ ...ADMIN.config, disabled: true });
    expect(r.source?.level).toBe('collection');
  });
});

describe('withDefaultAuthConfig / withoutDefaultAuth', () => {
  it('replaces the default entry’s config, keeping its uid, name, scope and the other entries', () => {
    const pool = withDefaultAuthConfig(
      collection({ auths: [ADMIN, SCOPED], defaultAuthUid: 'admin001' }),
      { type: 'none' },
      () => 'newu0001',
    );
    expect(pool).toEqual({
      auths: [{ ...ADMIN, config: { type: 'none' } }, SCOPED],
      defaultAuthUid: 'admin001',
    });
  });

  it('a transparent carrier gets a one-entry pool under the minted uid', () => {
    expect(withDefaultAuthConfig(collection(), { type: 'bearer', token: 't' }, () => 'newu0001')).toEqual({
      auths: [{ uid: 'newu0001', name: '', config: { type: 'bearer', token: 't' } }],
      defaultAuthUid: 'newu0001',
    });
  });

  it('the pre-pool single field is replaced, never kept as an entry', () => {
    const pool = withDefaultAuthConfig(
      collection({ auth: { type: 'bearer', token: 'old' } }),
      { type: 'bearer', token: 'new' },
      () => 'newu0001',
    );
    expect(pool.auths).toEqual([{ uid: 'newu0001', name: '', config: { type: 'bearer', token: 'new' } }]);
  });

  it('withoutDefaultAuth keeps the named entries and clears the default', () => {
    expect(withoutDefaultAuth(collection({ auths: [ADMIN, USER], defaultAuthUid: 'user0001' }))).toEqual({
      auths: [ADMIN],
      defaultAuthUid: undefined,
    });
    expect(withoutDefaultAuth(collection({ auth: { type: 'bearer', token: 'old' } }))).toEqual({
      auths: [],
      defaultAuthUid: undefined,
    });
  });
});

describe('the per-kind mask', () => {
  it('HTTP takes every type; the session kinds take their subsets', () => {
    expect(authMaskFor('http').has('oauth2')).toBe(true);
    expect([...authMaskFor('websocket')].sort()).toEqual([
      'api-key',
      'aws-sigv4',
      'basic',
      'bearer',
      'jwt',
      'none',
      'oauth2',
    ]);
    expect([...authMaskFor('grpc')].sort()).toEqual(['api-key', 'basic', 'bearer', 'jwt', 'none', 'oauth2']);
    expect([...authMaskFor('mqtt')].sort()).toEqual(['basic', 'none']);
  });

  it('a query-placed api-key rides the kinds with a query leg — HTTP and the WebSocket handshake URL', () => {
    const header = { type: 'api-key', key: 'X-K', value: 'v', in: 'header' } as const;
    const query = { type: 'api-key', key: 'X-K', value: 'v', in: 'query' } as const;
    expect(authAllowedFor('websocket', header)).toBe(true);
    expect(authAllowedFor('websocket', query)).toBe(true);
    expect(authAllowedFor('grpc', header)).toBe(true);
    expect(authAllowedFor('grpc', query)).toBe(false);
    expect(authAllowedFor('http', query)).toBe(true);
    expect(authAllowedFor('mqtt', header)).toBe(false);
    expect(authRefusalLabel('grpc', query)).toBe('API Key in query');
  });

  it('OAuth 2.0 rides both session kinds; its query mode needs the query leg; a DPoP binding never rides one', () => {
    const base: Extract<ConcreteAuthConfig, { type: 'oauth2' }> = {
      type: 'oauth2',
      credentialRef: 'oauth2-cred-abc12345',
      flow: 'client-credentials',
      tokenEndpoint: '',
      clientId: '',
      scopes: [],
    };
    expect(authRefusalLabel('websocket', base)).toBeNull();
    expect(authRefusalLabel('grpc', base)).toBeNull();
    expect(authRefusalLabel('websocket', { ...base, sendAs: 'query' })).toBeNull();
    expect(authRefusalLabel('grpc', { ...base, sendAs: 'query' })).toBe('OAuth 2.0 in query');
    expect(authRefusalLabel('websocket', { ...base, tokenBinding: 'dpop' })).toBe('OAuth 2.0 bound to a DPoP key');
    expect(authRefusalLabel('grpc', { ...base, tokenBinding: 'dpop' })).toBe('OAuth 2.0 bound to a DPoP key');
    expect(authRefusalLabel('http', { ...base, tokenBinding: 'dpop', sendAs: 'query' })).toBeNull();
    expect(authRefusalLabel('mqtt', base)).toBe('OAuth 2.0');
  });

  it('JWT Bearer rides both session kinds in header mode; query mode needs the query leg', () => {
    const header = {
      type: 'jwt',
      algorithm: 'HS256',
      secret: 's',
      privateKey: '',
      payload: '{}',
      addTo: 'header',
    } as const;
    const query = { ...header, addTo: 'query' } as const;
    expect(authRefusalLabel('websocket', header)).toBeNull();
    expect(authRefusalLabel('grpc', header)).toBeNull();
    expect(authRefusalLabel('websocket', query)).toBeNull();
    expect(authRefusalLabel('grpc', query)).toBe('JWT Bearer in query');
  });

  it('an AWS signature rides a WebSocket handshake only as the signed URL; gRPC never', () => {
    const header = { type: 'aws-sigv4', accessKeyId: 'a', secretAccessKey: 's', service: '', region: '' } as const;
    const query = { ...header, addTo: 'query' } as const;
    expect(authRefusalLabel('websocket', query)).toBeNull();
    expect(authRefusalLabel('websocket', header)).toBe('AWS Signature v4 in header');
    expect(authRefusalLabel('websocket', { ...header, addTo: 'header' })).toBe('AWS Signature v4 in header');
    expect(authRefusalLabel('grpc', query)).toBe('AWS Signature v4');
    expect(authRefusalLabel('http', header)).toBeNull();
  });

  it('assertAuthAllowed names the inherited entry and the kind; the allowed kind passes', () => {
    const dpopAuth: Extract<ConcreteAuthConfig, { type: 'oauth2' }> = {
      type: 'oauth2',
      credentialRef: 'oauth2-cred-abc12345',
      flow: 'authorization-code-pkce',
      tokenEndpoint: '',
      clientId: '',
      scopes: [],
      tokenBinding: 'dpop',
    };
    const effective: EffectiveAuth = {
      auth: dpopAuth,
      source: {
        level: 'collection',
        uid: 'col00001',
        name: 'Payments',
        entryUid: 'admin001',
        entryName: 'Admin token',
      },
    };
    expect(assertAuthAllowed('websocket', effective)).toBe(
      "Inherited OAuth 2.0 bound to a DPoP key from Collection 'Payments' › Admin token cannot be applied to a WebSocket session.",
    );
    expect(assertAuthAllowed('http', effective)).toBeNull();
    const { tokenBinding: _binding, ...bearerAuth } = dpopAuth;
    expect(assertAuthAllowed('grpc', { ...effective, auth: bearerAuth })).toBeNull();
  });

  it('an unnamed entry drops the entry suffix; the folder level and every kind noun read right', () => {
    const effective: EffectiveAuth = {
      auth: { type: 'aws-sigv4', accessKeyId: '', secretAccessKey: '', service: '', region: '' },
      source: { level: 'folder', uid: 'fld00001', name: 'Cards', entryUid: 'aws00001', entryName: '' },
    };
    expect(assertAuthAllowed('grpc', effective)).toBe(
      "Inherited AWS Signature v4 from Folder 'Cards' cannot be applied to a gRPC call.",
    );
    expect(assertAuthAllowed('mqtt', effective)).toBe(
      "Inherited AWS Signature v4 from Folder 'Cards' cannot be applied to an MQTT session.",
    );
  });

  it('a query-placed api-key names its placement; bearer refuses on MQTT', () => {
    expect(
      assertAuthAllowed('grpc', {
        auth: { type: 'api-key', key: 'k', value: 'v', in: 'query' },
        source: { level: 'collection', uid: 'col00001', name: 'API', entryUid: 'key00001', entryName: 'Key' },
      }),
    ).toBe("Inherited API Key in query from Collection 'API' › Key cannot be applied to a gRPC call.");
    expect(
      assertAuthAllowed('websocket', {
        auth: { type: 'aws-sigv4', accessKeyId: 'a', secretAccessKey: 's', service: '', region: '' },
        source: { level: 'collection', uid: 'col00001', name: 'API', entryUid: 'aws00001', entryName: 'Gateway' },
      }),
    ).toBe(
      "Inherited AWS Signature v4 in header from Collection 'API' › Gateway cannot be applied to a WebSocket session.",
    );
    expect(
      assertAuthAllowed('mqtt', {
        auth: { type: 'bearer', token: 't' },
        source: { level: 'collection', uid: 'col00001', name: 'API', entryUid: 'tok00001', entryName: '' },
      }),
    ).toBe("Inherited Bearer Token from Collection 'API' cannot be applied to an MQTT session.");
  });

  it('none, a suspended resolution, and a masked own type pass silently', () => {
    expect(assertAuthAllowed('mqtt', { auth: { type: 'none' }, source: null })).toBeNull();
    expect(
      assertAuthAllowed('mqtt', {
        auth: { type: 'bearer', token: 't', disabled: true },
        source: { level: 'collection', uid: 'col00001', name: 'API', entryUid: 'tok00001', entryName: '' },
      }),
    ).toBeNull();
    expect(
      assertAuthAllowed('websocket', {
        auth: { type: 'basic', username: 'u', password: 'p' },
        source: { level: 'request' },
      }),
    ).toBeNull();
  });
});
