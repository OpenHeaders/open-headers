/**
 * Per-request connection policy → dispatcher selection: agent reuse per
 * option tuple (TLS window/ciphers, httpVersion, resolve-to-address
 * pin, client certificate, proxy, Unix socket), the connect-option bag
 * mapping, and the classification of failures each knob can cause.
 */

import { createSecureContext } from 'node:tls';
import { TransportError } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, ProxyAgent, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { connectOptionsFor } from '../../../src/live/node-request-transport';
import { fetchError, makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

describe('createNodeRequestTransport — per-request TLS policy', () => {
  it('rides the ONE shared default agent when no TLS-affecting option is set', async () => {
    // Every direct send carries a dispatcher now — the always-on
    // negotiated-protocol report needs a connector seat undici's
    // global default dispatcher doesn't offer. Default-tuple sends
    // still share a single agent across sends and transports.
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ sslVerification: true }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('routes a verification-off send through a dedicated agent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ sslVerification: false }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
  });

  it('reuses ONE shared agent across verification-off sends and transports', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ sslVerification: false }));
    await transport().send(makeRequest({ sslVerification: false }));
    const first = callInit(0).dispatcher;
    const second = callInit(1).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(second).toBe(first);
  });

  it('routes a TLS version / cipher tuple through a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = { tlsMinVersion: '1.0' as const, tlsMaxVersion: '1.2' as const };
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest(tuple));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('distinct TLS tuples get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ tlsMinVersion: '1.0' }));
    await transport().send(makeRequest({ tlsMaxVersion: '1.2' }));
    await transport().send(makeRequest({ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(3);
  });

  it('combines verification-off with version/cipher options on ONE shared agent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = {
      sslVerification: false,
      tlsMinVersion: '1.1' as const,
      tlsCipherSuites: 'ECDHE-RSA-AES128-GCM-SHA256',
    };
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest({ sslVerification: false }));
    const combined = callInit(0).dispatcher;
    expect(combined).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(combined);
    // Insecure-only is a DIFFERENT tuple — different agent.
    expect(callInit(2).dispatcher).not.toBe(combined);
  });

  it('the per-tuple dispatcher rides EVERY hop of a redirect chain', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ tlsMinVersion: '1.0' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('evicts the oldest agent past the cache cap; a re-request mints a fresh one', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = { tlsCipherSuites: 'EVICTION-PROBE' };
    await transport().send(makeRequest(tuple));
    const original = callInit(0).dispatcher;
    expect(original).toBeInstanceOf(Agent);
    // Flood the cache with more distinct tuples than the 32-entry cap
    // holds — the probe tuple's agent must age out.
    for (let i = 0; i < 35; i++) {
      await transport().send(makeRequest({ tlsCipherSuites: `FLOOD-${i}` }));
    }
    await transport().send(makeRequest(tuple));
    const remade = callInit(36).dispatcher;
    expect(remade).toBeInstanceOf(Agent);
    expect(remade).not.toBe(original);
  });

  it('a floor lowered below 1.2 without an explicit cipher list supplies what THIS stack accepts', () => {
    // The override is runtime-probed by design: OpenSSL 3 blocks
    // TLS < 1.2 signature algorithms at its default security level and
    // needs `@SECLEVEL=0`; BoringSSL (the Electron test runner) rejects
    // that syntax and needs nothing. Mirror the probe so the assertion
    // is exact on either stack.
    let stackAccepts: string | undefined;
    try {
      createSecureContext({ ciphers: 'DEFAULT@SECLEVEL=0' });
      stackAccepts = 'DEFAULT@SECLEVEL=0';
    } catch {
      stackAccepts = undefined;
    }
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.1' })).ciphers).toBe(stackAccepts);
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.0' })).ciphers).toBe(stackAccepts);
  });

  it('an explicit cipher list wins verbatim over the lowered-floor default', () => {
    const bag = connectOptionsFor(makeRequest({ tlsMinVersion: '1.1', tlsCipherSuites: 'AES128-SHA' }));
    expect(bag.ciphers).toBe('AES128-SHA');
  });

  it('a 1.2+ floor (or none) supplies no cipher override', () => {
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.2' })).ciphers).toBeUndefined();
    expect(connectOptionsFor(makeRequest()).ciphers).toBeUndefined();
  });

  it('classifies a no-usable-cipher failure naming the cipher setting', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_NO_CIPHER_MATCH'));
    await expect(transport().send(makeRequest({ tlsCipherSuites: 'BOGUS-SUITE' }))).rejects.toThrow(
      /"TLS cipher suites" setting/,
    );
  });

  it('classifies a handshake failure pointing at the TLS settings when they are tuned', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION'));
    await expect(transport().send(makeRequest({ tlsMinVersion: '1.0', tlsMaxVersion: '1.1' }))).rejects.toThrow(
      /TLS version and cipher suite settings/,
    );
  });

  it('classifies a handshake failure WITHOUT naming settings when none are tuned', async () => {
    fetchMock.mockRejectedValue(fetchError('EPROTO'));
    const attempt = transport().send(makeRequest());
    await expect(attempt).rejects.toThrow(/TLS handshake with api\.openheaders\.io failed \(EPROTO\)\.$/);
  });
});

describe('createNodeRequestTransport — per-request HTTP version', () => {
  it('a pinned-h2 tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    await transport().send(makeRequest({ httpVersion: '2' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it("'auto' and absent share the default tuple; '1.1' mints its own", async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ httpVersion: 'auto' }));
    await transport().send(makeRequest({ httpVersion: '1.1' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
    expect(callInit(2).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(2).dispatcher).not.toBe(first);
  });

  it('httpVersion combines with TLS options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    await transport().send(makeRequest({ httpVersion: '2', tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(3);
  });

  it('the redirect loop is protocol-blind: the pinned dispatcher rides every hop', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it("fails honestly BEFORE the wire on '3' when no helper binary is available", async () => {
    // No injected client and no OPENHEADERS_H3_HELPER override — the
    // pin must fail naming HTTP/3, never quietly ride another protocol.
    const previous = process.env.OPENHEADERS_H3_HELPER;
    delete process.env.OPENHEADERS_H3_HELPER;
    try {
      const attempt = transport().send(makeRequest({ httpVersion: '3' }));
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/HTTP\/3/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previous !== undefined) process.env.OPENHEADERS_H3_HELPER = previous;
    }
  });

  it("fails honestly BEFORE the wire when '3' targets plain http:// (QUIC has TLS built in)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3', url: 'http://api.openheaders.io/v1/ping' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/https:\/\//);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire when '3' routes through a proxy (no CONNECT seat for UDP)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3', proxyUrl: 'http://proxy.openheaders.io:3128' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/can't carry QUIC/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire when '3' targets a Unix socket (QUIC is UDP)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3', unixSocketPath: '/tmp/openheaders.sock' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/Unix socket/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire when '3' carries a sub-1.3 TLS ceiling (QUIC is TLS 1.3-only)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3', tlsMaxVersion: '1.2' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/TLS 1\.3-only/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire when '3' sets an OpenSSL cipher list (no rustls mapping)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3', tlsCipherSuites: 'ECDHE-RSA-AES128-GCM-SHA256' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/cipher/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a pinned '2' tuple through a proxy rides the hand-rolled tunnel dial, never ProxyAgent", async () => {
    // ProxyAgent's connector would own the ALPN offer and demote the
    // pin to an unenforced preference — the pinned tuple gets a plain
    // Agent over the CONNECT-tunnel dial connector instead.
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2', proxyUrl: 'http://proxy.openheaders.io:3128' }));
    const dispatcher = callInit(0).dispatcher;
    expect(dispatcher).toBeInstanceOf(Agent);
    expect(dispatcher).not.toBeInstanceOf(ProxyAgent);
  });

  it('classifies the pinned dial guard failure naming the HTTP version setting', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('api.openheaders.io:443 negotiated http/1.1 instead of the pinned HTTP/2.'), {
          code: 'OH_ERR_H2_NOT_NEGOTIATED',
        }),
      }),
    );
    await expect(transport().send(makeRequest({ httpVersion: '2' }))).rejects.toThrow(
      /negotiated http\/1\.1 instead of the pinned HTTP\/2.*"HTTP version" setting/,
    );
  });

  it('classifies a no-application-protocol alert as the server refusing the h2-only offer', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV1_ALERT_NO_APPLICATION_PROTOCOL'));
    await expect(transport().send(makeRequest({ httpVersion: '2' }))).rejects.toThrow(
      /rejected the HTTP\/2-only offer.*doesn't speak HTTP\/2/,
    );
  });
});

describe('createNodeRequestTransport — per-request resolve-to-address pin', () => {
  it('a pin-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent pin rides the shared default agent, not a pin tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct pinned addresses get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.8' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the pin combines with TLS and h2 options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7', tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7', httpVersion: '1.1' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher, callInit(3).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(4);
  });

  it('the pinned dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('classifies a refused connection naming the resolve-to-address setting when pinned', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }))).rejects.toThrow(
      /resolve-to-address setting points api\.openheaders\.io there/,
    );
  });

  it('classifies an unreachable pinned address naming the setting', async () => {
    fetchMock.mockRejectedValue(fetchError('EHOSTUNREACH'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.255.0.1' }))).rejects.toThrow(
      /No route to 10\.255\.0\.1 \(EHOSTUNREACH\) — the request's resolve-to-address setting/,
    );
  });

  it('classifies a connect timeout naming the pinned address', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }))).rejects.toThrow(
      /timed out — the request's resolve-to-address setting points it at 10\.0\.0\.7/,
    );
  });

  it('does NOT name the setting on an unpinned refused connection', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
});

// Throwaway placeholder material — dispatcher IDENTITY is what these
// tests assert; a real handshake is the live pass.
const CERT_FIELDS = {
  clientCertificateRef: 'gateway-mtls',
  clientCertificatePem: '-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----',
  clientCertificateKeyPem: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
};

describe('createNodeRequestTransport — per-request client certificate', () => {
  it('a certificate-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent ref rides the shared default agent, not a certificate tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct refs get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, clientCertificateRef: 'other-gateway' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the SAME ref with rotated material mints a fresh agent (content-hash key segment)', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(
      makeRequest({
        ...CERT_FIELDS,
        clientCertificatePem: '-----BEGIN CERTIFICATE-----\nrotated-cert\n-----END CERTIFICATE-----',
      }),
    );
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('a passphrase change also rotates the tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, clientCertificatePassphrase: 'swordfish' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    expect(new Set(agents).size).toBe(2);
  });

  it('the certificate combines with TLS and pin options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ ...CERT_FIELDS, resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher, callInit(3).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(4);
  });

  it('the certificate-bearing dispatcher rides EVERY hop of a redirect chain', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the ref did not resolve to vault material', async () => {
    const attempt = transport().send(makeRequest({ clientCertificateRef: 'gateway-mtls' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/vault entry "gateway-mtls", which doesn't exist on this device/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies certificate_required naming the configured vault entry', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /requires a client certificate and rejected the handshake .* vault entry "gateway-mtls"/,
    );
  });

  it('classifies certificate_required pointing at the setting when NO certificate is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /requires a client certificate .* Pick one in the request's "Client certificate" setting/,
    );
  });

  it('classifies bad_certificate naming the vault entry when configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /rejected the presented client certificate .* vault entry "gateway-mtls"/,
    );
  });

  it('classifies a mid-handshake close naming the setting ONLY when a certificate is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_SOCKET'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /closed the connection during the exchange\..*client-certificate setting/,
    );
  });

  it('keeps the generic message on a socket close with no certificate configured', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_SOCKET'));
    await expect(transport().send(makeRequest())).rejects.toThrow(/^Could not reach api\.openheaders\.io/);
  });

  it('classifies unloadable PEM material naming the vault entry', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_OSSL_PEM_NO_START_LINE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /client certificate from vault entry "gateway-mtls" could not be loaded \(ERR_OSSL_PEM_NO_START_LINE\)/,
    );
  });

  it('a TLS 1.2 handshake_failure names the client certificate when one is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /TLS handshake with api\.openheaders\.io failed .* vault entry "gateway-mtls"/,
    );
  });
});

const PROXY_URL = 'http://proxy.openheaders.io:3128';

const PROXY_CRED_FIELDS = {
  proxyUrl: PROXY_URL,
  proxyCredentialRef: 'corp-proxy',
  proxyCredential: 'user:secret',
};

/** Build the REAL shape of a rejected proxy CONNECT (verified against a
 *  live CONNECT proxy): the first cause carries a NUMERIC `code: 0` and
 *  only its own cause holds the status-bearing tunnel message. */
function proxyTunnelError(status: number): Error {
  const abort = Object.assign(new Error(`Proxy response (${status}) !== 200 when HTTP Tunneling`), {
    name: 'AbortError',
    code: 'UND_ERR_ABORTED',
  });
  const cancelled = Object.assign(new Error('Request was cancelled.'), { code: 0, cause: abort });
  return Object.assign(new TypeError('fetch failed'), { cause: cancelled });
}

describe('createNodeRequestTransport — per-request proxy', () => {
  it('a proxy-only tuple mints a dedicated ProxyAgent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(ProxyAgent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('distinct proxy URLs get distinct dispatchers', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: 'http://other-proxy.openheaders.io:8080' }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('the SAME credential ref with a rotated value mints a fresh dispatcher (content-hash key segment)', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS }));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS, proxyCredential: 'user:rotated' }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('an authenticated and an unauthenticated send to the same proxy are distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('the proxy combines with TLS, h2, and certificate options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, sslVerification: false }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, httpVersion: '1.1' }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, ...CERT_FIELDS }));
    await transport().send(makeRequest({ sslVerification: false }));
    const dispatchers = [
      callInit(0).dispatcher,
      callInit(1).dispatcher,
      callInit(2).dispatcher,
      callInit(3).dispatcher,
      callInit(4).dispatcher,
    ];
    for (const d of dispatchers.slice(0, 4)) expect(d).toBeInstanceOf(ProxyAgent);
    // The direct insecure send is a plain Agent, not a ProxyAgent.
    expect(dispatchers[4]).toBeInstanceOf(Agent);
    expect(new Set(dispatchers).size).toBe(5);
  });

  it('a credential ref WITHOUT a proxy URL contributes nothing — default agent, no failure', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    const res = await transport().send(makeRequest({ proxyCredentialRef: 'corp-proxy' }));
    expect(res.status).toBe(200);
    expect(callInit(1).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(callInit(0).dispatcher);
  });

  it('the proxied dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(ProxyAgent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the credential ref did not resolve to a vault value', async () => {
    const attempt = transport().send(makeRequest({ proxyUrl: PROXY_URL, proxyCredentialRef: 'corp-proxy' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/vault entry "corp-proxy", which doesn't exist on this device/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails BEFORE the wire when the request sets both a proxy and a resolve-to-address pin', async () => {
    const attempt = transport().send(makeRequest({ proxyUrl: PROXY_URL, resolveToAddress: '10.0.0.7' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/proxy resolves the hostname itself/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a refused connection naming the PROXY, not the target', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Connection refused by the proxy at proxy\.openheaders\.io:3128/,
    );
  });

  it('classifies a DNS failure naming the proxy host', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOTFOUND'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Could not resolve the proxy host proxy\.openheaders\.io:3128/,
    );
  });

  it('classifies a connect timeout naming the proxy', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Connection to the proxy at proxy\.openheaders\.io:3128 timed out/,
    );
  });

  it('classifies a 407 tunnel rejection naming the configured credential entry', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(407));
    await expect(transport().send(makeRequest({ ...PROXY_CRED_FIELDS }))).rejects.toThrow(
      /rejected the credentials \(407\).*vault entry "corp-proxy"/,
    );
  });

  it('classifies a 407 tunnel rejection pointing at the setting when NO credentials are configured', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(407));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /requires authentication \(407\)\. Set the request's proxy-credentials setting/,
    );
  });

  it('classifies a non-407 tunnel rejection as a proxy-to-target failure', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(502));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /could not open a tunnel to api\.openheaders\.io \(HTTP 502\)/,
    );
  });

  it('a target-leg certificate error through the proxy keeps its direct classification', async () => {
    fetchMock.mockRejectedValue(fetchError('DEPTH_ZERO_SELF_SIGNED_CERT'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /TLS certificate error reaching api\.openheaders\.io/,
    );
  });

  it('an unproxied send never mentions a proxy on a refused connection', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
});

const SOCKET_PATH = '/var/run/openheaders/api.sock';

describe('createNodeRequestTransport — per-request Unix socket target', () => {
  it('a socket-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent socket path rides the shared default agent, not a socket tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct socket paths get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: '/var/run/openheaders/other.sock' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the socket combines with TLS, h2, and certificate options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, sslVerification: false }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, httpVersion: '1.1' }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, ...CERT_FIELDS }));
    await transport().send(makeRequest({ sslVerification: false }));
    const agents = [
      callInit(0).dispatcher,
      callInit(1).dispatcher,
      callInit(2).dispatcher,
      callInit(3).dispatcher,
      callInit(4).dispatcher,
    ];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(5);
  });

  it('the socket-pinned dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the request sets both a Unix socket and a proxy', async () => {
    const attempt = transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, proxyUrl: PROXY_URL }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/proxy tunnel can't dial a local socket/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails BEFORE the wire when the request sets both a Unix socket and a resolve-to-address pin', async () => {
    const attempt = transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, resolveToAddress: '10.0.0.7' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/socket dial resolves no hostname/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a missing socket file naming the setting and the path', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOENT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /No socket at \/var\/run\/openheaders\/api\.sock — the request's Unix-socket setting dials it/,
    );
  });

  it('hints at the OS path-length limit when a long path fails as ENOENT', async () => {
    const longPath = `/tmp/${'x'.repeat(120)}.sock`;
    fetchMock.mockRejectedValue(fetchError('ENOENT'));
    await expect(transport().send(makeRequest({ unixSocketPath: longPath }))).rejects.toThrow(
      /Paths longer than the OS limit on socket paths/,
    );
  });

  it('classifies a non-socket file at the path', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOTSOCK'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /exists but is not a socket/,
    );
  });

  it('classifies a permission-denied socket open', async () => {
    fetchMock.mockRejectedValue(fetchError('EACCES'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Permission denied opening the socket at \/var\/run\/openheaders\/api\.sock/,
    );
  });

  it('classifies a refused socket connection (stale socket, nothing listening)', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Connection refused on the socket at \/var\/run\/openheaders\/api\.sock/,
    );
  });

  it('classifies a connect timeout naming the socket', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Connection on the socket at \/var\/run\/openheaders\/api\.sock timed out/,
    );
  });

  it('a target-leg TLS error on a socket-pinned send keeps its direct classification', async () => {
    fetchMock.mockRejectedValue(fetchError('DEPTH_ZERO_SELF_SIGNED_CERT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /TLS certificate error reaching api\.openheaders\.io/,
    );
  });

  it('an unsocketed refused connection keeps the plain host message', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
});
