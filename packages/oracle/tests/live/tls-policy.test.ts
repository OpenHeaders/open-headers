/**
 * The session TLS policy composer — the one place the WebSocket, gRPC
 * and MQTT executors mint the transport-facing policy from a request:
 * only set knobs ride, the certificate ref resolves against the vault
 * (bare without one), the SNI override resolves through the session's
 * template scope and trims away to nothing.
 */

import type { Vault } from '@openheaders/core/types';
import { pickSessionTlsPolicy, resolveClientCertificate, sessionTlsPolicy } from '@openheaders/oracle/live/tls-policy';
import { describe, expect, it } from 'vitest';

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [
    {
      uid: 'cert0001',
      kind: 'client-certificate',
      name: 'gateway-mtls',
      cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      passphrase: 'pw',
    },
  ],
};

const resolve = (template: string): string => template.replace('{{team}}', 'alpha');

describe('resolveClientCertificate', () => {
  it('attaches the PEM pair when the named entry exists', () => {
    expect(resolveClientCertificate('gateway-mtls', VAULT)).toEqual({
      clientCertificateRef: 'gateway-mtls',
      clientCertificatePem: VAULT.secrets[0]?.kind === 'client-certificate' ? VAULT.secrets[0].cert : '',
      clientCertificateKeyPem: VAULT.secrets[0]?.kind === 'client-certificate' ? VAULT.secrets[0].key : '',
      clientCertificatePassphrase: 'pw',
    });
  });

  it('passes the ref through bare when the entry is missing or there is no vault', () => {
    expect(resolveClientCertificate('other', VAULT)).toEqual({ clientCertificateRef: 'other' });
    expect(resolveClientCertificate('gateway-mtls', undefined)).toEqual({ clientCertificateRef: 'gateway-mtls' });
    expect(resolveClientCertificate(undefined, VAULT)).toEqual({});
  });
});

describe('sessionTlsPolicy', () => {
  it('a default request composes an empty policy — the dial keeps its runtime defaults', () => {
    expect(sessionTlsPolicy({ request: {}, trustedRootsPem: undefined, vault: undefined, resolve })).toEqual({});
  });

  it('rides every set knob, resolves the certificate and the SNI template', () => {
    expect(
      sessionTlsPolicy({
        request: {
          sslVerification: false,
          clientCertificateRef: 'gateway-mtls',
          tlsMinVersion: '1.1',
          tlsMaxVersion: '1.2',
          tlsCipherSuites: 'AES128-SHA',
          sniServerName: ' edge-{{team}}.openheaders.io ',
        },
        trustedRootsPem: ['ROOT'],
        vault: VAULT,
        resolve,
      }),
    ).toEqual({
      sslVerification: false,
      trustedRootsPem: ['ROOT'],
      clientCertificateRef: 'gateway-mtls',
      clientCertificatePem: expect.stringContaining('BEGIN CERTIFICATE'),
      clientCertificateKeyPem: expect.stringContaining('BEGIN PRIVATE KEY'),
      clientCertificatePassphrase: 'pw',
      tlsMinVersion: '1.1',
      tlsMaxVersion: '1.2',
      tlsCipherSuites: 'AES128-SHA',
      sniServerName: 'edge-alpha.openheaders.io',
    });
  });

  it('a blank SNI resolution is no override', () => {
    expect(
      sessionTlsPolicy({ request: { sniServerName: '   ' }, trustedRootsPem: undefined, vault: undefined, resolve }),
    ).toEqual({});
  });

  it('pickSessionTlsPolicy lifts only the defined policy keys off a wider params object', () => {
    expect(
      pickSessionTlsPolicy({ sslVerification: false, sniServerName: 'edge.openheaders.io', tlsMinVersion: undefined }),
    ).toEqual({ sslVerification: false, sniServerName: 'edge.openheaders.io' });
  });
});
