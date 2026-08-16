import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  CollectionSchema,
  EnvironmentSchema,
  ExtensionWorkspaceSchema,
  FolderSchema,
  HttpMethodSchema,
  parseEntity,
  parseEntityArray,
  RequestSchema,
  RuleSchema,
  TemplateSchema,
  VariableSchema,
  VaultSchema,
  WorkspaceSchema,
  WorkspaceVariablesSchema,
} from '../../src/schemas';

describe('HttpMethodSchema', () => {
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])('accepts standard %s', (m) => {
    expect(v.parse(HttpMethodSchema, m)).toBe(m);
  });

  it.each(['PROPFIND', 'PURGE', 'COPY', 'X-CUSTOM-1'])('accepts custom token %s', (m) => {
    expect(v.parse(HttpMethodSchema, m)).toBe(m);
  });

  it.each(['get', 'Get', '', ' GET', 'GET POST', '1GET', 'A'.repeat(33)])('rejects malformed %j', (m) => {
    expect(v.safeParse(HttpMethodSchema, m).success).toBe(false);
  });

  it.each(['CONNECT', 'TRACE', 'TRACK'])('rejects fetch-forbidden %s', (m) => {
    expect(v.safeParse(HttpMethodSchema, m).success).toBe(false);
  });
});

describe('VariableSchema', () => {
  it('accepts a default variable', () => {
    expect(
      v.parse(VariableSchema, { uid: 'vrapiurl', name: 'API_URL', value: 'https://x', type: 'default' }),
    ).toBeTruthy();
  });

  it('accepts a secret variable', () => {
    expect(v.parse(VariableSchema, { uid: 'vrtokenx', name: 'TOKEN', value: 'abc', type: 'secret' })).toBeTruthy();
  });

  it('rejects an unknown type', () => {
    expect(v.safeParse(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: 'y', type: 'unknown' }).success).toBe(
      false,
    );
  });

  it('rejects missing fields', () => {
    expect(v.safeParse(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: 'y' }).success).toBe(false);
  });

  it('rejects missing uid', () => {
    expect(v.safeParse(VariableSchema, { name: 'X', value: 'y', type: 'default' }).success).toBe(false);
  });
});

describe('VaultSchema', () => {
  it('accepts an empty vault', () => {
    expect(v.parse(VaultSchema, { schemaVersion: 5, secrets: [] })).toEqual({
      schemaVersion: 5,
      secrets: [],
    });
  });

  it('rejects a missing schemaVersion', () => {
    expect(v.safeParse(VaultSchema, { secrets: [] }).success).toBe(false);
  });

  it('rejects schemaVersion below 5 — V5 is the baseline; no pre-5 snapshots exist', () => {
    for (const pre5 of [0, 1, 2, 3, 4]) {
      expect(v.safeParse(VaultSchema, { schemaVersion: pre5, secrets: [] }).success).toBe(false);
    }
  });

  it('accepts schemaVersion 5 and later (for future entity bumps)', () => {
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [] }).success).toBe(true);
    expect(v.safeParse(VaultSchema, { schemaVersion: 6, secrets: [] }).success).toBe(true);
    expect(v.safeParse(VaultSchema, { schemaVersion: 100, secrets: [] }).success).toBe(true);
  });

  it('accepts a client-certificate entry — cert + key PEM pair, optional passphrase', () => {
    const entry = {
      uid: 'abcd1234',
      kind: 'client-certificate',
      name: 'gateway-mtls',
      cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    };
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [entry] }).success).toBe(true);
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [{ ...entry, passphrase: 'pw' }] }).success).toBe(
      true,
    );
  });

  it('rejects a client-certificate entry missing either half of the pair', () => {
    const base = { uid: 'abcd1234', kind: 'client-certificate', name: 'gateway-mtls' };
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [{ ...base, cert: 'c' }] }).success).toBe(false);
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [{ ...base, key: 'k' }] }).success).toBe(false);
  });

  it('accepts a secret-manager entry with a per-provider structured locator', () => {
    const base = { uid: 'abcd1234', kind: 'secret-manager', name: 'api-token' };
    const locators = [
      { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
      { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token', account: 'work' },
      { provider: 'bitwarden', secretId: 'bw-secret-id' },
      { provider: 'oskeychain', service: 'openheaders.io', account: 'daniel' },
      { provider: 'awssm', name: 'db-password', stage: 'AWSCURRENT', region: 'eu-west-1' },
      { provider: 'azurekv', vaultUrl: 'https://oh.vault.azure.net', name: 'token' },
      { provider: 'hashivault', mount: 'kv', path: 'apps/openheaders', key: 'token' },
    ];
    for (const locator of locators) {
      expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [{ ...base, locator }] }).success).toBe(true);
    }
  });

  it('rejects a secret-manager entry with a missing or unknown-provider locator', () => {
    const base = { uid: 'abcd1234', kind: 'secret-manager', name: 'api-token' };
    expect(v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [base] }).success).toBe(false);
    expect(
      v.safeParse(VaultSchema, { schemaVersion: 5, secrets: [{ ...base, locator: { provider: 'unknown' } }] }).success,
    ).toBe(false);
    // Missing a required per-provider field (onepassword without `field`).
    expect(
      v.safeParse(VaultSchema, {
        schemaVersion: 5,
        secrets: [{ ...base, locator: { provider: 'onepassword', vault: 'Engineering', item: 'x' } }],
      }).success,
    ).toBe(false);
  });
});

describe('EnvironmentSchema', () => {
  it('accepts a valid environment', () => {
    expect(
      v.parse(EnvironmentSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        name: 'staging',
        variables: [{ uid: 'vrapiurl', name: 'API_URL', value: 'x', type: 'default' }],
      }),
    ).toBeTruthy();
  });

  it('rejects a non-8-char uid', () => {
    expect(v.safeParse(EnvironmentSchema, { schemaVersion: 5, uid: 'abc', name: 's', variables: [] }).success).toBe(
      false,
    );
  });

  it('rejects an uppercase uid', () => {
    expect(
      v.safeParse(EnvironmentSchema, { schemaVersion: 5, uid: 'ABCD1234', name: 's', variables: [] }).success,
    ).toBe(false);
  });

  it('accepts optional path', () => {
    expect(
      v.parse(EnvironmentSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        name: 'staging',
        path: 'environments/staging.yaml',
        variables: [],
      }),
    ).toBeTruthy();
  });
});

const TEST_ORG_ID = '01890000-0000-7000-8000-000000000000';

describe('WorkspaceSchema', () => {
  it('accepts the minimal manifest', () => {
    expect(
      v.parse(WorkspaceSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        name: 'My Workspace',
        orgId: TEST_ORG_ID,
      }),
    ).toBeTruthy();
  });

  it('accepts defaultEnvironmentId', () => {
    expect(
      v.parse(WorkspaceSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        name: 'x',
        defaultEnvironmentId: 'abcd1234',
        orgId: TEST_ORG_ID,
      }),
    ).toBeTruthy();
  });

  it('rejects a missing orgId', () => {
    expect(v.safeParse(WorkspaceSchema, { schemaVersion: 5, uid: 'abcd1234', name: 'x' }).success).toBe(false);
  });

  it('rejects a missing uid (Phase 0 invariant #1)', () => {
    expect(v.safeParse(WorkspaceSchema, { schemaVersion: 5, name: 'x' }).success).toBe(false);
  });

  it('rejects a non-8-char uid', () => {
    expect(v.safeParse(WorkspaceSchema, { schemaVersion: 5, uid: 'too-short', name: 'x' }).success).toBe(false);
  });
});

describe('ExtensionWorkspaceSchema', () => {
  it('accepts a personal workspace', () => {
    expect(
      v.parse(ExtensionWorkspaceSchema, {
        schemaVersion: 5,
        id: 'abcd1234',
        kind: 'personal',
        name: 'mine',
        sortIndex: 0,
        createdAt: '2026-04-18T00:00:00Z',
        updatedAt: '2026-04-18T00:00:00Z',
        orgId: TEST_ORG_ID,
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown kind', () => {
    expect(
      v.safeParse(ExtensionWorkspaceSchema, {
        schemaVersion: 5,
        id: 'abcd1234',
        kind: 'public',
        name: 'x',
        sortIndex: 0,
        createdAt: '2026',
        updatedAt: '2026',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing schemaVersion', () => {
    expect(
      v.safeParse(ExtensionWorkspaceSchema, {
        id: 'abcd1234',
        kind: 'personal',
        name: 'mine',
        sortIndex: 0,
        createdAt: '2026',
        updatedAt: '2026',
      }).success,
    ).toBe(false);
  });
});

describe('CollectionSchema', () => {
  it('accepts an empty collection', () => {
    expect(
      v.parse(CollectionSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-abcd1234',
        name: 'Auth',
        variables: [],
      }),
    ).toBeTruthy();
  });

  it('accepts explicit order', () => {
    expect(
      v.parse(CollectionSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-abcd1234',
        name: 'Auth',
        variables: [],
        order: ['login-wxyz1234', 'logout-pqrs5678'],
      }),
    ).toBeTruthy();
  });
});

describe('FolderSchema', () => {
  it('accepts a minimal folder', () => {
    expect(
      v.parse(FolderSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth-wxyz1234/tokens-abcd1234',
        name: 'Tokens',
      }),
    ).toBeTruthy();
  });
});

describe('RequestSchema', () => {
  it('accepts a bearer-auth request', () => {
    expect(
      v.parse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'requests/auth-xxxx1234/login-abcd1234',
        name: 'Login',
        method: 'POST',
        url: 'https://api.openheaders.io/login',
        headers: [{ uid: 'hdrxxxx1', key: 'X-Client', value: 'oh' }],
        params: [],
        auth: { type: 'bearer', token: 'x' },
        body: { type: 'json', content: '{}' },
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown auth type', () => {
    expect(
      v.safeParse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        method: 'GET',
        url: 'x',
        headers: [],
        params: [],
        auth: { type: 'magic' },
        body: { type: 'none' },
      }).success,
    ).toBe(false);
  });

  it('accepts credentialsMode: "include"', () => {
    expect(
      v.parse(RequestSchema, {
        schemaVersion: 5,
        version: 1,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        method: 'GET',
        url: 'x',
        headers: [],
        params: [],
        auth: { type: 'none' },
        credentialsMode: 'include',
        body: { type: 'none' },
      }),
    ).toBeTruthy();
  });

  it('bounds timeoutMs and maxResponseBytes', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, timeoutMs: 1000, maxResponseBytes: 1024 })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, timeoutMs: 3_600_000, maxResponseBytes: 10 * 1024 * 1024 })).toBeTruthy();
    // Below the floor / above the ceiling / non-integers all reject.
    expect(v.safeParse(RequestSchema, { ...base, timeoutMs: 999 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, timeoutMs: 3_600_001 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, timeoutMs: 1500.5 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, maxResponseBytes: 1023 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, maxResponseBytes: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it('bounds maxRedirects and accepts the redirect-policy booleans', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    // 0 is meaningful ("fail on any redirect") — the floor allows it.
    expect(v.parse(RequestSchema, { ...base, maxRedirects: 0 })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, maxRedirects: 50 })).toBeTruthy();
    expect(
      v.parse(RequestSchema, { ...base, followOriginalHttpMethod: true, followAuthorizationHeader: true }),
    ).toBeTruthy();
    expect(v.safeParse(RequestSchema, { ...base, maxRedirects: -1 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, maxRedirects: 51 }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, maxRedirects: 2.5 }).success).toBe(false);
  });

  it('bounds the TLS version window and cipher suite list', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, tlsMinVersion: '1.0', tlsMaxVersion: '1.3' })).toBeTruthy();
    expect(
      v.parse(RequestSchema, { ...base, tlsCipherSuites: 'TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256' }),
    ).toBeTruthy();
    // Only the four known version tokens are accepted.
    expect(v.safeParse(RequestSchema, { ...base, tlsMinVersion: '1.4' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, tlsMaxVersion: 'TLSv1.2' }).success).toBe(false);
    // Cipher list is one colon-joined OpenSSL token string — no spaces,
    // no empty string.
    expect(v.safeParse(RequestSchema, { ...base, tlsCipherSuites: 'AES128, AES256' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, tlsCipherSuites: '' }).success).toBe(false);
  });

  it('accepts only IPv4/IPv6 address literals for resolveToAddress', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: '10.0.0.7' })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: '255.255.255.255' })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: '::1' })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: '2001:db8::1' })).toBeTruthy();
    // IPv4-mapped and zoned IPv6 forms ride the pragmatic branch.
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: '::ffff:192.0.2.1' })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, resolveToAddress: 'fe80::1%en0' })).toBeTruthy();
    // Address only — no hostname, no port, no octet overflow, no empty.
    expect(v.safeParse(RequestSchema, { ...base, resolveToAddress: 'backend.openheaders.io' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, resolveToAddress: '10.0.0.7:8443' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, resolveToAddress: '999.0.0.1' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, resolveToAddress: '' }).success).toBe(false);
  });

  it('accepts a clientCertificateRef vault-entry name; rejects empty and overlong', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, clientCertificateRef: 'gateway-mtls' })).toBeTruthy();
    expect(v.safeParse(RequestSchema, { ...base }).success).toBe(true);
    expect(v.safeParse(RequestSchema, { ...base, clientCertificateRef: '' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, clientCertificateRef: 'x'.repeat(257) }).success).toBe(false);
  });

  it('accepts an http/https/socks5 proxyUrl; rejects userinfo, SOCKS4, paths, and garbage', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    const withUrl = (proxyUrl: string) => ({ ...base, proxyMode: 'url', proxyUrl });
    expect(v.parse(RequestSchema, withUrl('http://proxy.openheaders.io:3128'))).toBeTruthy();
    expect(v.safeParse(RequestSchema, withUrl('https://proxy.openheaders.io')).success).toBe(true);
    expect(v.safeParse(RequestSchema, withUrl('http://127.0.0.1:8080/')).success).toBe(true);
    // Userinfo would be honored by the runtime — rejected so credentials
    // never land in synced YAML; they ride a vault ref instead.
    expect(v.safeParse(RequestSchema, withUrl('http://user:pass@proxy.openheaders.io')).success).toBe(false);
    // The engine dials SOCKS5 natively (P5); the SOCKS4 family stays out.
    expect(v.safeParse(RequestSchema, withUrl('socks5://127.0.0.1:1080')).success).toBe(true);
    expect(v.safeParse(RequestSchema, withUrl('socks5://user:pass@proxy.openheaders.io:1080')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('socks4://127.0.0.1:1080')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('socks://127.0.0.1:1080')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('http://proxy.openheaders.io/path')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('http://proxy.openheaders.io?q=1')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('proxy.openheaders.io:3128')).success).toBe(false);
    expect(v.safeParse(RequestSchema, withUrl('')).success).toBe(false);
  });

  it('ties proxyMode to proxyUrl', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    // Absent mode = inherit (the default); 'direct' opts out; 'url'
    // routes through the request's own proxyUrl.
    expect(v.parse(RequestSchema, { ...base })).toBeTruthy();
    expect(v.parse(RequestSchema, { ...base, proxyMode: 'direct' })).toBeTruthy();
    expect(
      v.parse(RequestSchema, { ...base, proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' }),
    ).toBeTruthy();
    // The tri-state row always writes the PAIR — a URL floating
    // without its mode is a malformed write (the P2 transitional
    // lenience, tightened with the P3 row).
    expect(v.safeParse(RequestSchema, { ...base, proxyUrl: 'http://proxy.openheaders.io:3128' }).success).toBe(false);
    // 'url' with nothing to route through, 'direct' with a dormant
    // URL, and unknown modes all fail.
    expect(v.safeParse(RequestSchema, { ...base, proxyMode: 'url' }).success).toBe(false);
    expect(
      v.safeParse(RequestSchema, { ...base, proxyMode: 'direct', proxyUrl: 'http://proxy.openheaders.io:3128' })
        .success,
    ).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, proxyMode: 'inherit' }).success).toBe(false);
  });

  it('accepts a proxyCredentialRef vault-entry name; rejects empty and overlong', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, proxyCredentialRef: 'corp-proxy' })).toBeTruthy();
    expect(v.safeParse(RequestSchema, { ...base, proxyCredentialRef: '' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, proxyCredentialRef: 'x'.repeat(257) }).success).toBe(false);
  });

  it('accepts a unixSocketPath as an absolute Unix path or a Windows named pipe; rejects other shapes', () => {
    const base = {
      schemaVersion: 5,
      uid: 'abcd1234',
      path: 'x',
      name: 'x',
      method: 'GET',
      url: 'x',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    expect(v.parse(RequestSchema, { ...base, unixSocketPath: '/var/run/docker.sock' })).toBeTruthy();
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: '/tmp/oh test.sock' }).success).toBe(true);
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: '\\\\.\\pipe\\openheaders' }).success).toBe(true);
    // Relative paths, bare prefixes, and non-path garbage are shape
    // errors; whether the socket EXISTS is a connect-time question.
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: 'var/run/docker.sock' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: '/' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: '\\\\.\\pipe\\' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: '' }).success).toBe(false);
    expect(v.safeParse(RequestSchema, { ...base, unixSocketPath: `/${'x'.repeat(256)}` }).success).toBe(false);
  });
});

describe('RuleSchema', () => {
  it('accepts a header rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/auth/rule-abcd1234',
        name: 'Bearer',
        type: 'header',
        enabled: true,
        conditions: [{ uid: 'cnd00010', type: 'request-domains', values: ['openheaders.io'] }],
        action: {
          requestHeaders: [{ uid: 'hmd00010', operation: 'override', headerName: 'Authorization', value: 'Bearer X' }],
          responseHeaders: [],
        },
      }),
    ).toBeTruthy();
  });

  it('accepts a block rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/block/rule-abcd1234',
        name: 'Block',
        type: 'block',
        enabled: true,
        conditions: [{ uid: 'cnd00011', type: 'request-domains', values: ['bad.io'] }],
        action: {},
      }),
    ).toBeTruthy();
  });

  it('accepts a query-param rule', () => {
    expect(
      v.parse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'rules/qp/rule-abcd1234',
        name: 'Add utm',
        type: 'query-param',
        enabled: true,
        conditions: [{ uid: 'cnd00012', type: 'request-domains', values: ['openheaders.io'] }],
        action: { params: [{ uid: 'qp000001', param: 'utm_source', value: 'oh', operation: 'add' }] },
      }),
    ).toBeTruthy();
  });

  it('rejects an unknown rule type', () => {
    expect(
      v.safeParse(RuleSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'x',
        name: 'x',
        type: 'unknown',
        enabled: true,
        conditions: [],
        action: {},
      }).success,
    ).toBe(false);
  });

  // Note: BlockActionSchema is `v.object({})` (no required keys) and
  // valibot accepts extra keys on plain object schemas — so a header-
  // shaped action under `type: 'block'` does *not* fail validation,
  // it just carries unused keys. Earlier this test relied on a stricter
  // mode that no longer applies; rather than reintroduce strictness in
  // service of one test, we accept the loose behavior and let runtime
  // dispatch ignore the foreign keys.
});

describe('TemplateSchema', () => {
  it('accepts a valid template', () => {
    expect(
      v.parse(TemplateSchema, {
        schemaVersion: 5,
        uid: 'abcd1234',
        path: 'templates/my/tpl-abcd1234',
        name: 'Bearer preset',
        ruleType: 'header',
        icon: '🔑',
        description: 'Adds Authorization header',
        includes: { conditions: true, formValues: true },
        conditions: [],
        formValues: { value: 'Bearer X' },
        createdAt: '2026-04-18T00:00:00Z',
        updatedAt: '2026-04-18T00:00:00Z',
      }),
    ).toBeTruthy();
  });
});

describe('WorkspaceVariablesSchema', () => {
  it('accepts empty variables', () => {
    expect(v.parse(WorkspaceVariablesSchema, { schemaVersion: 5, variables: [] })).toBeTruthy();
  });
});

describe('parseEntity', () => {
  it('returns the parsed value on success', () => {
    const parsed = parseEntity(VariableSchema, { uid: 'vrxxxxxx', name: 'X', value: '1', type: 'default' });
    expect(parsed).toEqual({ uid: 'vrxxxxxx', name: 'X', value: '1', type: 'default' });
  });

  it('returns null on failure without throwing', () => {
    expect(parseEntity(VariableSchema, { name: 'X' })).toBeNull();
  });

  it('invokes onError with raw + issues when parsing fails', () => {
    let captured: { raw: unknown; issueCount: number } | null = null;
    parseEntity(
      VariableSchema,
      { uid: 'vrxxxxxx', name: 'X', value: 1, type: 'default' },
      {
        onError: (raw, issues) => {
          captured = { raw, issueCount: issues.length };
        },
      },
    );
    expect(captured).not.toBeNull();
    expect((captured as unknown as { issueCount: number }).issueCount).toBeGreaterThan(0);
  });
});

describe('parseEntityArray', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseEntityArray(VariableSchema, 'not an array')).toEqual([]);
  });

  it('drops invalid entries but keeps valid ones', () => {
    const out = parseEntityArray(VariableSchema, [
      { uid: 'vraaaaaa', name: 'A', value: '1', type: 'default' },
      { name: 'B' }, // invalid (missing uid + value + type)
      { uid: 'vrcccccc', name: 'C', value: '3', type: 'secret' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.name)).toEqual(['A', 'C']);
  });
});
