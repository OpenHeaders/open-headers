/**
 * The session dial policy composer — the one place the WebSocket, gRPC
 * and MQTT executors mint the transport-facing dial policy from a
 * request: only set knobs ride, the proxy credential resolves against
 * the vault (bare without one).
 */

import type { Vault } from '@openheaders/core/types';
import { pickSessionDialPolicy, resolveProxyCredential, sessionDialPolicy } from '@openheaders/oracle/live/dial-policy';
import { describe, expect, it } from 'vitest';

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'str00001', kind: 'string', name: 'corp-proxy', value: 'corp:secret' },
    {
      uid: 'cert0001',
      kind: 'client-certificate',
      name: 'corp-cert',
      cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    },
  ],
};

describe('resolveProxyCredential', () => {
  it('attaches the user:password value when the named string entry exists', () => {
    expect(resolveProxyCredential('corp-proxy', VAULT)).toEqual({
      proxyCredentialRef: 'corp-proxy',
      proxyCredential: 'corp:secret',
    });
  });

  it('passes the ref through bare when the entry is missing, of another kind, or there is no vault', () => {
    expect(resolveProxyCredential('other', VAULT)).toEqual({ proxyCredentialRef: 'other' });
    expect(resolveProxyCredential('corp-cert', VAULT)).toEqual({ proxyCredentialRef: 'corp-cert' });
    expect(resolveProxyCredential('corp-proxy', undefined)).toEqual({ proxyCredentialRef: 'corp-proxy' });
    expect(resolveProxyCredential(undefined, VAULT)).toEqual({});
  });
});

describe('sessionDialPolicy', () => {
  it('a default request composes an empty policy', () => {
    expect(sessionDialPolicy({}, VAULT)).toEqual({});
  });

  it('carries every set knob with the credential resolved', () => {
    expect(
      sessionDialPolicy(
        {
          resolveToAddress: '10.0.0.12',
          proxyMode: 'url',
          proxyUrl: 'http://proxy.openheaders.io:8080',
          proxyCredentialRef: 'corp-proxy',
        },
        VAULT,
      ),
    ).toEqual({
      resolveToAddress: '10.0.0.12',
      proxyMode: 'url',
      proxyUrl: 'http://proxy.openheaders.io:8080',
      proxyCredentialRef: 'corp-proxy',
      proxyCredential: 'corp:secret',
    });
    expect(sessionDialPolicy({ proxyMode: 'direct' }, undefined)).toEqual({ proxyMode: 'direct' });
  });
});

describe('pickSessionDialPolicy', () => {
  it('picks the defined policy keys off a wider params object', () => {
    expect(
      pickSessionDialPolicy({
        resolveToAddress: '10.0.0.12',
        proxyUrl: 'http://proxy.openheaders.io:8080',
        proxyCredential: undefined,
        ...({ path: '/x', metadata: [] } as object),
      }),
    ).toEqual({ resolveToAddress: '10.0.0.12', proxyUrl: 'http://proxy.openheaders.io:8080' });
  });
});
