/**
 * The shared TLS policy → `tls.connect` bag — the one mapping every
 * node dial spreads (HTTP dispatcher, WebSocket connector, gRPC
 * session, MQTT socket).
 */

import { createSecureContext, rootCertificates } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { tlsPolicyOptionsFor } from '../../src/live/tls-policy';

const ROOT = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';

describe('tlsPolicyOptionsFor', () => {
  it('a default policy maps to an empty bag — the dial keeps its runtime defaults', () => {
    expect(tlsPolicyOptionsFor({})).toEqual({});
  });

  it('maps every knob: verification off, roots behind the bundle, the cert pair, the version window, ciphers, SNI', () => {
    expect(
      tlsPolicyOptionsFor({
        sslVerification: false,
        trustedRootsPem: [ROOT],
        clientCertificatePem: 'CERT',
        clientCertificateKeyPem: 'KEY',
        clientCertificatePassphrase: 'pw',
        tlsMinVersion: '1.2',
        tlsMaxVersion: '1.3',
        tlsCipherSuites: 'AES128-SHA',
        sniServerName: 'edge.openheaders.io',
      }),
    ).toEqual({
      rejectUnauthorized: false,
      ca: [...rootCertificates, ROOT],
      cert: 'CERT',
      key: 'KEY',
      passphrase: 'pw',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: 'AES128-SHA',
      servername: 'edge.openheaders.io',
    });
  });

  it('a blank or padded SNI override is trimmed — blank is no override', () => {
    expect(tlsPolicyOptionsFor({ sniServerName: '  edge.openheaders.io ' }).servername).toBe('edge.openheaders.io');
    expect(tlsPolicyOptionsFor({ sniServerName: '   ' }).servername).toBeUndefined();
    expect(tlsPolicyOptionsFor({ sniServerName: '' })).toEqual({});
  });

  it('a floor lowered below 1.2 without an explicit cipher list supplies what THIS stack accepts', () => {
    let stackAccepts: string | undefined;
    try {
      createSecureContext({ ciphers: 'DEFAULT@SECLEVEL=0' });
      stackAccepts = 'DEFAULT@SECLEVEL=0';
    } catch {
      stackAccepts = undefined;
    }
    expect(tlsPolicyOptionsFor({ tlsMinVersion: '1.1' }).ciphers).toBe(stackAccepts);
    expect(tlsPolicyOptionsFor({ tlsMinVersion: '1.0' }).ciphers).toBe(stackAccepts);
    expect(tlsPolicyOptionsFor({ tlsMinVersion: '1.1', tlsCipherSuites: 'AES128-SHA' }).ciphers).toBe('AES128-SHA');
    expect(tlsPolicyOptionsFor({ tlsMinVersion: '1.2' }).ciphers).toBeUndefined();
  });

  it('an empty roots list sets no ca; the roots ride even under verification-off', () => {
    expect(tlsPolicyOptionsFor({ trustedRootsPem: [] })).toEqual({});
    expect(tlsPolicyOptionsFor({ sslVerification: false, trustedRootsPem: [ROOT] })).toEqual({
      rejectUnauthorized: false,
      ca: [...rootCertificates, ROOT],
    });
  });
});
