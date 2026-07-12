/**
 * executeOverTransport — the host-neutral wire layer: normalizes a
 * ResolvedRequest into a data-only TransportRequest, hands it to the
 * injected transport, and maps the response back with the byte cap.
 * Exercised with a fake transport that captures what it was handed.
 */

import type { RequestBody } from '@openheaders/core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeOverTransport } from '../../../src/live/request-exec/execute';
import type { ResolvedRequest } from '../../../src/live/request-exec/resolve-request';
import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
} from '../../../src/live/request-exec/transport';

const getFileBlobMock = vi.fn();
vi.mock('../../../src/entity/files-store', () => ({
  getFileBlob: (...args: unknown[]) => getFileBlobMock(...args),
}));

afterEach(() => {
  getFileBlobMock.mockReset();
});

function makeResolved(overrides: Partial<ResolvedRequest> = {}): ResolvedRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    body: { type: 'none' },
    credentialsMode: 'omit',
    ...overrides,
  };
}

/** A transport that records the request it was handed and returns a
 *  canned response (overridable). */
function captureTransport(response?: Partial<TransportResponse>): {
  transport: RequestTransport;
  sent: () => TransportRequest;
} {
  let captured: TransportRequest | undefined;
  const transport: RequestTransport = {
    async send(req) {
      captured = req;
      const body = response?.body ?? '{"ok":true}';
      const base: TransportResponse = {
        status: 200,
        statusText: 'OK',
        url: req.url,
        headers: [{ key: 'content-type', value: 'application/json' }],
        body,
        bodyTruncated: false,
        bodyBytes: new TextEncoder().encode(body).byteLength,
      };
      return { ...base, ...response };
    },
  };
  return {
    transport,
    sent: () => {
      if (!captured) throw new Error('transport.send was not called');
      return captured;
    },
  };
}

describe('executeOverTransport', () => {
  it('normalizes the URL scheme and passes method + headers through', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({ url: 'api.openheaders.io/v1/ping', method: 'POST', headers: [{ key: 'X-A', value: '1' }] }),
      transport,
    );
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(sent().url).toBe('https://api.openheaders.io/v1/ping');
    expect(sent().method).toBe('POST');
    expect(sent().headers).toEqual([{ key: 'X-A', value: '1' }]);
  });

  it('maps redirect + credentials policy', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ followRedirects: false, credentialsMode: 'include' }), transport);
    expect(sent().redirect).toBe('manual');
    expect(sent().credentials).toBe('include');
  });

  it('passes the SSL verification policy through to the transport', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ sslVerification: false }), transport);
    expect(sent().sslVerification).toBe(false);
  });

  it('marks a verification-off run on the snapshot — success and failure alike', async () => {
    const { transport } = captureTransport();
    const ok = await executeOverTransport(makeResolved({ sslVerification: false }), transport);
    expect(ok.sslVerificationDisabled).toBe(true);

    const failing: RequestTransport = {
      async send() {
        throw new TransportError('Connection refused by api.openheaders.io.');
      },
    };
    const failed = await executeOverTransport(makeResolved({ sslVerification: false }), failing);
    expect(failed.error).toBe('Connection refused by api.openheaders.io.');
    expect(failed.sslVerificationDisabled).toBe(true);
  });

  it('leaves a verified run unmarked', async () => {
    const { transport } = captureTransport();
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.sslVerificationDisabled).toBeUndefined();
    const explicit = await executeOverTransport(makeResolved({ sslVerification: true }), transport);
    expect(explicit.sslVerificationDisabled).toBeUndefined();
  });

  it('passes the TLS version window + cipher list through to the transport', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(
      makeResolved({ tlsMinVersion: '1.1', tlsMaxVersion: '1.2', tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }),
      transport,
    );
    expect(sent().tlsMinVersion).toBe('1.1');
    expect(sent().tlsMaxVersion).toBe('1.2');
    expect(sent().tlsCipherSuites).toBe('TLS_AES_128_GCM_SHA256');

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().tlsMinVersion).toBeUndefined();
    expect(bare.sent().tlsMaxVersion).toBeUndefined();
    expect(bare.sent().tlsCipherSuites).toBeUndefined();
  });

  it('passes allowHttp2 through to the transport without marking the snapshot', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(makeResolved({ allowHttp2: true }), transport);
    expect(sent().allowHttp2).toBe(true);
    // Offering h2 is not trust-relaxing — no snapshot marker of any kind.
    expect('allowHttp2' in snap).toBe(false);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().allowHttp2).toBeUndefined();
  });

  it('passes resolveToAddress through to the transport without marking the snapshot', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(makeResolved({ resolveToAddress: '10.0.0.7' }), transport);
    expect(sent().resolveToAddress).toBe('10.0.0.7');
    // Pinning an address with cert verification intact is not
    // trust-relaxing — no snapshot marker of any kind.
    expect('resolveToAddress' in snap).toBe(false);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().resolveToAddress).toBeUndefined();
  });

  it('passes the client-certificate seam fields through without marking the snapshot', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        clientCertificateRef: 'gateway-mtls',
        clientCertificatePem: 'CERT-PEM',
        clientCertificateKeyPem: 'KEY-PEM',
        clientCertificatePassphrase: 'pw',
      }),
      transport,
    );
    expect(sent().clientCertificateRef).toBe('gateway-mtls');
    expect(sent().clientCertificatePem).toBe('CERT-PEM');
    expect(sent().clientCertificateKeyPem).toBe('KEY-PEM');
    expect(sent().clientCertificatePassphrase).toBe('pw');
    // Presenting a client certificate does not weaken server
    // verification — not trust-relaxing, no snapshot marker.
    expect('clientCertificateRef' in snap).toBe(false);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().clientCertificateRef).toBeUndefined();
    expect(bare.sent().clientCertificatePem).toBeUndefined();
  });

  it('passes the proxy seam fields through without marking the snapshot', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        proxyUrl: 'http://proxy.openheaders.io:3128',
        proxyCredentialRef: 'corp-proxy',
        proxyCredential: 'user:secret',
      }),
      transport,
    );
    expect(sent().proxyUrl).toBe('http://proxy.openheaders.io:3128');
    expect(sent().proxyCredentialRef).toBe('corp-proxy');
    expect(sent().proxyCredential).toBe('user:secret');
    // CONNECT tunneling keeps end-to-end TLS and verification runs
    // against the target — not trust-relaxing, no snapshot marker.
    expect('proxyUrl' in snap).toBe(false);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().proxyUrl).toBeUndefined();
    expect(bare.sent().proxyCredentialRef).toBeUndefined();
    expect(bare.sent().proxyCredential).toBeUndefined();
  });

  it('marks a lowered-floor run on the snapshot — success and failure alike', async () => {
    const { transport } = captureTransport();
    const ok = await executeOverTransport(makeResolved({ tlsMinVersion: '1.0' }), transport);
    expect(ok.tlsFloorLowered).toBe(true);

    const failing: RequestTransport = {
      async send() {
        throw new TransportError('Connection refused by api.openheaders.io.');
      },
    };
    const failed = await executeOverTransport(makeResolved({ tlsMinVersion: '1.1' }), failing);
    expect(failed.error).toBe('Connection refused by api.openheaders.io.');
    expect(failed.tlsFloorLowered).toBe(true);
  });

  it('leaves a default-or-raised-floor run unmarked', async () => {
    const { transport } = captureTransport();
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.tlsFloorLowered).toBeUndefined();
    // Keeping or raising the floor is not trust-relaxing — no marker.
    const raised = await executeOverTransport(makeResolved({ tlsMinVersion: '1.3' }), transport);
    expect(raised.tlsFloorLowered).toBeUndefined();
    const kept = await executeOverTransport(makeResolved({ tlsMinVersion: '1.2' }), transport);
    expect(kept.tlsFloorLowered).toBeUndefined();
  });

  it('serializes a json body as raw content', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ body: { type: 'json', content: '{"a":1}' } }), transport);
    expect(sent().body).toEqual({ kind: 'raw', content: '{"a":1}' });
  });

  it('builds a graphql body into the {query,variables} wire shape', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(
      makeResolved({ body: { type: 'graphql', content: 'query{x}', graphqlVariables: '{"v":1}' } }),
      transport,
    );
    expect(sent().body).toEqual({ kind: 'raw', content: JSON.stringify({ query: 'query{x}', variables: { v: 1 } }) });
  });

  it('omits invalid graphql variables rather than sending a malformed body', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(
      makeResolved({ body: { type: 'graphql', content: 'query{x}', graphqlVariables: 'not json' } }),
      transport,
    );
    expect(sent().body).toEqual({ kind: 'raw', content: JSON.stringify({ query: 'query{x}' }) });
  });

  it('builds urlencoded fields and skips disabled form rows', async () => {
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'form',
      formParts: [
        { uid: 'f1', key: 'a', value: '1' },
        { uid: 'f2', key: 'skip', value: 'x', enabled: false },
        { uid: 'f3', key: 'b', value: '2' },
      ],
    };
    await executeOverTransport(makeResolved({ method: 'POST', body }), transport);
    expect(sent().body).toEqual({
      kind: 'urlencoded',
      fields: [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ],
    });
  });

  it('strips a user-set multipart Content-Type so the host sets the boundary', async () => {
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'multipart',
      multipartParts: [{ kind: 'text', uid: 'p1', name: 'field', value: 'v' }],
    };
    await executeOverTransport(
      makeResolved({
        method: 'POST',
        body,
        headers: [
          { key: 'Content-Type', value: 'multipart/form-data; boundary=xxx' },
          { key: 'X-Keep', value: 'yes' },
        ],
      }),
      transport,
    );
    expect(sent().headers).toEqual([{ key: 'X-Keep', value: 'yes' }]);
    expect(sent().body).toEqual({ kind: 'multipart', parts: [{ kind: 'text', name: 'field', value: 'v' }] });
  });

  it('reads file-part bytes from the blob store for multipart file parts', async () => {
    getFileBlobMock.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }));
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'multipart',
      multipartParts: [
        {
          kind: 'file',
          uid: 'p1',
          name: 'upload',
          fileRefs: [{ fileId: 'file-1', hash: 'h1', size: 3, filename: 'doc.pdf', mimeType: 'application/pdf' }],
        },
      ],
    };
    await executeOverTransport(makeResolved({ method: 'POST', body }), transport);
    const part = sent().body;
    expect(part.kind).toBe('multipart');
    if (part.kind !== 'multipart') throw new Error('expected multipart');
    expect(part.parts).toHaveLength(1);
    const filePart = part.parts[0];
    expect(filePart.kind).toBe('file');
    if (filePart.kind !== 'file') throw new Error('expected file part');
    expect(filePart.filename).toBe('doc.pdf');
    expect(filePart.mimeType).toBe('application/pdf');
    expect([...filePart.bytes]).toEqual([1, 2, 3]);
  });

  it('forwards its byte cap to the transport so the read is streamed + bounded', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved(), transport);
    expect(sent().maxBodyBytes).toBe(2 * 1024 * 1024);
  });

  it('lets a per-request maxResponseBytes override the default byte cap', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ maxResponseBytes: 4096 }), transport);
    expect(sent().maxBodyBytes).toBe(4096);
  });

  it("maps the request's own timeoutMs into the transport request", async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ timeoutMs: 15000 }), transport);
    expect(sent().timeoutMs).toBe(15000);
  });

  it('prefers the step-level timeout option over the request value', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ timeoutMs: 15000 }), transport, { timeoutMs: 5000 });
    expect(sent().timeoutMs).toBe(5000);
  });

  it('leaves the transport timeout unset when neither request nor step set one', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved(), transport);
    expect(sent().timeoutMs).toBeUndefined();
  });

  it('maps the redirect-policy trio into the transport request', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(
      makeResolved({ maxRedirects: 5, followOriginalHttpMethod: true, followAuthorizationHeader: true }),
      transport,
    );
    expect(sent().maxRedirects).toBe(5);
    expect(sent().followOriginalHttpMethod).toBe(true);
    expect(sent().followAuthorizationHeader).toBe(true);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().maxRedirects).toBeUndefined();
    expect(bare.sent().followOriginalHttpMethod).toBeUndefined();
    expect(bare.sent().followAuthorizationHeader).toBeUndefined();
  });

  it('stamps authorizationForwarded only when the transport reports an actual re-send', async () => {
    const forwarded = captureTransport({ authorizationForwarded: true });
    const marked = await executeOverTransport(makeResolved({ followAuthorizationHeader: true }), forwarded.transport);
    expect(marked.authorizationForwarded).toBe(true);

    // Knob on but the chain never crossed origin — the transport reports
    // nothing, so the snapshot carries no marker.
    const quiet = captureTransport();
    const unmarked = await executeOverTransport(makeResolved({ followAuthorizationHeader: true }), quiet.transport);
    expect(unmarked.authorizationForwarded).toBeUndefined();
  });

  it('surfaces the transport-reported truncation + byte count verbatim (no re-slice)', async () => {
    // Capping moved into the transport (only it can stream + abort the
    // read); execute passes the already-capped result straight through.
    const { transport } = captureTransport({
      body: 'capped-prefix',
      bodyTruncated: true,
      bodyBytes: 2 * 1024 * 1024,
    });
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.bodyTruncated).toBe(true);
    expect(snap.bodyBytes).toBe(2 * 1024 * 1024);
    expect(snap.body).toBe('capped-prefix');
  });

  it('stamps the cap in force on a truncated snapshot — default and per-request alike', async () => {
    const truncated = { body: 'capped', bodyTruncated: true, bodyBytes: 4096 };
    const viaDefault = captureTransport(truncated);
    const snapDefault = await executeOverTransport(makeResolved(), viaDefault.transport);
    expect(snapDefault.bodyCapBytes).toBe(2 * 1024 * 1024);

    const viaKnob = captureTransport(truncated);
    const snapKnob = await executeOverTransport(makeResolved({ maxResponseBytes: 4096 }), viaKnob.transport);
    expect(snapKnob.bodyCapBytes).toBe(4096);

    const { transport } = captureTransport();
    const untruncated = await executeOverTransport(makeResolved(), transport);
    expect(untruncated.bodyCapBytes).toBeUndefined();
  });

  it('surfaces a TransportError as a structured error snapshot', async () => {
    const transport: RequestTransport = {
      async send() {
        throw new TransportError('Connection refused by api.openheaders.io.');
      },
    };
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.status).toBe(0);
    expect(snap.error).toBe('Connection refused by api.openheaders.io.');
  });

  it('rejects an empty URL before touching the transport', async () => {
    const send = vi.fn();
    const snap = await executeOverTransport(makeResolved({ url: '   ' }), { send });
    expect(snap.error).toBe('URL is empty');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a URL with no host', async () => {
    const send = vi.fn();
    const snap = await executeOverTransport(makeResolved({ url: 'http://' }), { send });
    expect(snap.error).toMatch(/Invalid URL/);
    expect(send).not.toHaveBeenCalled();
  });

  it('does NOT throw on a 4xx/5xx — extractors may read error bodies', async () => {
    const { transport } = captureTransport({ status: 500, statusText: 'Server Error', body: 'boom' });
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(500);
    expect(snap.body).toBe('boom');
  });
});
