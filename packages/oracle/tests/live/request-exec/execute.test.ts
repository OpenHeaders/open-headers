/**
 * executeOverTransport — the host-neutral wire layer: normalizes a
 * ResolvedRequest into a data-only TransportRequest, hands it to the
 * injected transport, and maps the response back with the byte cap.
 * Exercised with a fake transport that captures what it was handed.
 */

import { type OAuth1Credentials, sha256Hex, signAwsSigV4, signOAuth1 } from '@openheaders/core/auth-signing';
import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import type { RequestBody } from '@openheaders/core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeOverTransport } from '../../../src/live/request-exec/execute';
import type { ResolvedRequest } from '../../../src/live/request-exec/resolve-request';
import { stopActiveSend } from '../../../src/live/request-exec/send-stream';
import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamObserver,
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

  it('passes unixSocketPath through without marking the snapshot', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({ unixSocketPath: '/var/run/openheaders/api.sock' }),
      transport,
    );
    expect(sent().unixSocketPath).toBe('/var/run/openheaders/api.sock');
    // No TLS relaxation — verification still runs against the URL's
    // hostname on an https-over-socket send. No snapshot marker.
    expect('unixSocketPath' in snap).toBe(false);

    const bare = captureTransport();
    await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().unixSocketPath).toBeUndefined();
  });

  it('passes cookieJarKey through and stamps the transport-reported jar activity', async () => {
    const { transport, sent } = captureTransport({
      cookieHeaderAttached: 'session=abc123',
      cookiesCaptured: ['session', 'theme'],
    });
    const snap = await executeOverTransport(makeResolved({ cookieJarKey: 'ws-a' }), transport);
    expect(sent().cookieJarKey).toBe('ws-a');
    // Attribution, not a trust marker: the snapshot records what the
    // jar did so the run stays reproducible after the jar changes.
    expect(snap.cookieHeaderAttached).toBe('session=abc123');
    expect(snap.cookiesCaptured).toEqual(['session', 'theme']);

    const bare = captureTransport();
    const quiet = await executeOverTransport(makeResolved(), bare.transport);
    expect(bare.sent().cookieJarKey).toBeUndefined();
    expect(quiet.cookieHeaderAttached).toBeUndefined();
    expect(quiet.cookiesCaptured).toBeUndefined();
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

  it('surfaces transport-reported trailers verbatim, omitted when none arrived', async () => {
    // gRPC's status channel — only hosts whose network stack exposes
    // trailers report them; the snapshot records what arrived.
    const withTrailers = captureTransport({
      trailers: [
        { key: 'grpc-status', value: '0' },
        { key: 'grpc-message', value: 'OK' },
      ],
    });
    const marked = await executeOverTransport(makeResolved(), withTrailers.transport);
    expect(marked.trailers).toEqual([
      { key: 'grpc-status', value: '0' },
      { key: 'grpc-message', value: 'OK' },
    ]);

    const quiet = captureTransport();
    const unmarked = await executeOverTransport(makeResolved(), quiet.transport);
    expect(unmarked.trailers).toBeUndefined();
  });

  it('surfaces the transport-reported redirect chain verbatim, omitted when none was followed', async () => {
    // Per-hop attribution only a transport owning its redirect
    // follower can record — the snapshot carries what the send did.
    const hop = {
      url: 'https://api.openheaders.io/v1/ping',
      method: 'POST',
      status: 303,
      statusText: 'See Other',
      location: '/v1/status',
      methodChangedTo: 'GET',
    };
    const withChain = captureTransport({ redirectChain: [hop] });
    const marked = await executeOverTransport(makeResolved({ method: 'POST' }), withChain.transport);
    expect(marked.redirectChain).toEqual([hop]);

    const quiet = captureTransport();
    const unmarked = await executeOverTransport(makeResolved(), quiet.transport);
    expect(unmarked.redirectChain).toBeUndefined();
  });

  it('surfaces the transport-reported phase timings verbatim, omitted when the host has none', async () => {
    const withMarks = captureTransport({ phaseTimings: { redirectMs: 12.5, waitingMs: 88.1, downloadMs: 5 } });
    const marked = await executeOverTransport(makeResolved(), withMarks.transport);
    expect(marked.phaseTimings).toEqual({ redirectMs: 12.5, waitingMs: 88.1, downloadMs: 5 });

    const quiet = captureTransport();
    const unmarked = await executeOverTransport(makeResolved(), quiet.transport);
    expect(unmarked.phaseTimings).toBeUndefined();
  });

  it('surfaces the transport-reported network facts verbatim, omitted when the host has none', async () => {
    const facts = {
      httpVersion: 'h2',
      localAddress: '192.168.1.20',
      localPort: 52344,
      remoteAddress: '203.0.113.7',
      remotePort: 443,
    };
    const withFacts = captureTransport({ network: facts });
    const marked = await executeOverTransport(makeResolved(), withFacts.transport);
    expect(marked.network).toEqual(facts);

    const quiet = captureTransport();
    const unmarked = await executeOverTransport(makeResolved(), quiet.transport);
    expect(unmarked.network).toBeUndefined();
  });

  it('opts interactive sends into the transport network capture; buffered sends stay pooled', async () => {
    const interactive = captureTransport();
    await executeOverTransport(makeResolved(), interactive.transport, {
      stream: { sendId: 'send-cap', emitFrame: () => undefined },
    });
    expect(interactive.sent().captureNetwork).toBe(true);

    const buffered = captureTransport();
    await executeOverTransport(makeResolved(), buffered.transport);
    expect(buffered.sent().captureNetwork).toBeUndefined();
  });

  it('stamps the wire bytes this executor serialized for the request', async () => {
    const { transport } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        method: 'POST',
        headers: [{ key: 'X-A', value: '1' }],
        body: { type: 'json', content: '{"q":"books"}' } as RequestBody,
      }),
      transport,
    );
    // Raw bodies auto-stamp a Content-Type header alongside the user
    // rows — count what actually went on the seam.
    const sentHeaders = snap.requestSize;
    expect(sentHeaders).toBeDefined();
    expect(sentHeaders?.bodyBytes).toBe('{"q":"books"}'.length);
    expect(sentHeaders?.headersBytes).toBeGreaterThanOrEqual('X-A: 1\r\n'.length);
    expect(sentHeaders?.bodyApproximate).toBeUndefined();
  });

  it('flags a multipart request body size as approximate (boundary unobservable)', async () => {
    const { transport } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        method: 'POST',
        body: {
          type: 'multipart',
          multipartParts: [{ kind: 'text', name: 'note', value: 'hello', enabled: true }],
        } as RequestBody,
      }),
      transport,
    );
    expect(snap.requestSize?.bodyApproximate).toBe(true);
    expect(snap.requestSize?.bodyBytes).toBe('hello'.length);
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

describe('executeOverTransport — AWS SigV4 signing', () => {
  const credentials = {
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    service: 'execute-api',
    region: 'us-east-1',
  };

  function amzDateToDate(amzDate: string): Date {
    return new Date(
      `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T` +
        `${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`,
    );
  }

  it('signs the final wire shape and replaces a user Authorization header', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        awsSigV4: credentials,
        headers: [{ key: 'Authorization', value: 'Bearer stale-user-token' }],
      }),
      transport,
    );
    expect(snap.error).toBeNull();
    const headers = new Map(sent().headers.map((h) => [h.key.toLowerCase(), h.value]));
    const amzDate = headers.get('x-amz-date');
    expect(amzDate).toMatch(/^\d{8}T\d{6}Z$/);
    const auth = headers.get('authorization') ?? '';
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(auth).toContain('/us-east-1/execute-api/aws4_request');
    expect(auth).toContain('SignedHeaders=host;x-amz-date');
    expect(auth).not.toContain('stale-user-token');
    expect(sent().headers.filter((h) => h.key.toLowerCase() === 'authorization')).toHaveLength(1);

    // The signature must equal an independent signer call over the same
    // wire shape at the timestamp the send stamped.
    const expected = await signAwsSigV4(credentials, {
      method: 'GET',
      url: sent().url,
      headers: [],
      payloadHash: await sha256Hex(''),
      now: amzDateToDate(amzDate ?? ''),
    });
    expect(auth).toBe(expected.find((h) => h.key === 'Authorization')?.value);
  });

  it('hashes the urlencoded payload exactly as the transport serializes it', async () => {
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'form',
      formParts: [{ uid: 'ffield01', key: 'grant type', value: 'client&credentials' }],
    };
    await executeOverTransport(makeResolved({ method: 'POST', awsSigV4: credentials, body, headers: [] }), transport);
    const headers = new Map(sent().headers.map((h) => [h.key.toLowerCase(), h.value]));
    const amzDate = headers.get('x-amz-date') ?? '';
    const wireBytes = new URLSearchParams([['grant type', 'client&credentials']]).toString();
    const expected = await signAwsSigV4(credentials, {
      method: 'POST',
      url: sent().url,
      headers: [],
      payloadHash: await sha256Hex(wireBytes),
      now: amzDateToDate(amzDate),
    });
    expect(headers.get('authorization')).toBe(expected.find((h) => h.key === 'Authorization')?.value);
  });

  it('signs multipart bodies as UNSIGNED-PAYLOAD with the s3 content header', async () => {
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'multipart',
      multipartParts: [{ kind: 'text', uid: 'mpart001', name: 'label', value: 'report' }],
    };
    await executeOverTransport(
      makeResolved({ method: 'POST', awsSigV4: { ...credentials, service: 's3' }, body }),
      transport,
    );
    const headers = new Map(sent().headers.map((h) => [h.key.toLowerCase(), h.value]));
    expect(headers.get('x-amz-content-sha256')).toBe('UNSIGNED-PAYLOAD');
    expect(headers.get('authorization')).toContain('x-amz-content-sha256');
  });

  it('signs + ships the session token for temporary credentials', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(
      makeResolved({ awsSigV4: { ...credentials, sessionToken: 'FQoGZXIvYXdzEXAMPLE' } }),
      transport,
    );
    const headers = new Map(sent().headers.map((h) => [h.key.toLowerCase(), h.value]));
    expect(headers.get('x-amz-security-token')).toBe('FQoGZXIvYXdzEXAMPLE');
    expect(headers.get('authorization')).toContain('x-amz-security-token');
  });

  it('leaves unsigned requests untouched', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ headers: [{ key: 'X-A', value: '1' }] }), transport);
    expect(sent().headers).toEqual([{ key: 'X-A', value: '1' }]);
  });
});

describe('executeOverTransport — OAuth1 signing', () => {
  const credentials: OAuth1Credentials = {
    consumerKey: 'ck_openheaders',
    consumerSecret: 'cs_openheaders',
    token: 'tok_openheaders',
    tokenSecret: 'ts_openheaders',
    signatureMethod: 'HMAC-SHA1',
    paramsLocation: 'header',
  };

  function oauthHeaderParams(authorization: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const part of authorization.slice('OAuth '.length).split(', ')) {
      const eq = part.indexOf('=');
      out.set(part.slice(0, eq), decodeURIComponent(part.slice(eq + 1).replace(/^"|"$/g, '')));
    }
    return out;
  }

  it('signs the final wire shape and replaces a user Authorization header', async () => {
    const { transport, sent } = captureTransport();
    const snap = await executeOverTransport(
      makeResolved({
        url: 'https://api.openheaders.io/v1/items?page=2',
        oauth1: credentials,
        headers: [{ key: 'Authorization', value: 'Bearer stale-user-token' }],
      }),
      transport,
    );
    expect(snap.error).toBeNull();
    const rows = sent().headers.filter((h) => h.key.toLowerCase() === 'authorization');
    expect(rows).toHaveLength(1);
    expect(rows[0].value.startsWith('OAuth ')).toBe(true);
    expect(rows[0].value).not.toContain('stale-user-token');
    const params = oauthHeaderParams(rows[0].value);
    expect(params.get('oauth_consumer_key')).toBe('ck_openheaders');
    expect(params.get('oauth_token')).toBe('tok_openheaders');

    // The signature must equal an independent signer call over the same
    // wire shape at the nonce + timestamp the send stamped.
    const expected = await signOAuth1(credentials, {
      method: 'GET',
      url: sent().url,
      timestampSec: Number(params.get('oauth_timestamp')),
      nonce: params.get('oauth_nonce') ?? '',
    });
    expect(rows[0].value).toBe(expected.headers[0].value);
  });

  it('folds the urlencoded body fields into the signature', async () => {
    const { transport, sent } = captureTransport();
    const body: RequestBody = {
      type: 'form',
      formParts: [{ uid: 'ffield01', key: 'status', value: 'openheaders release' }],
    };
    await executeOverTransport(makeResolved({ method: 'POST', oauth1: credentials, body, headers: [] }), transport);
    const auth = sent().headers.find((h) => h.key.toLowerCase() === 'authorization')?.value ?? '';
    const params = oauthHeaderParams(auth);
    const expected = await signOAuth1(credentials, {
      method: 'POST',
      url: sent().url,
      bodyParams: [{ name: 'status', value: 'openheaders release' }],
      timestampSec: Number(params.get('oauth_timestamp')),
      nonce: params.get('oauth_nonce') ?? '',
    });
    expect(auth).toBe(expected.headers[0].value);
  });

  it('appends the oauth_* params to the URL in query mode', async () => {
    const { transport, sent } = captureTransport();
    const creds: OAuth1Credentials = { ...credentials, paramsLocation: 'query' };
    await executeOverTransport(
      makeResolved({ url: 'https://api.openheaders.io/v1/items?page=2', oauth1: creds }),
      transport,
    );
    const url = new URL(sent().url);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('oauth_consumer_key')).toBe('ck_openheaders');
    expect(url.searchParams.get('oauth_signature')).toBeTruthy();
    expect(sent().headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(false);
  });
});

describe('executeOverTransport — digest carry', () => {
  it('forwards digest credentials onto the transport seam untouched', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved({ digest: { username: 'cam-admin', password: 'pw' } }), transport);
    expect(sent().digestAuth).toEqual({ username: 'cam-admin', password: 'pw' });
  });

  it('leaves digestAuth absent when the request carries no digest config', async () => {
    const { transport, sent } = captureTransport();
    await executeOverTransport(makeResolved(), transport);
    expect('digestAuth' in sent()).toBe(false);
  });
});

describe('executeOverTransport — streaming capture mode (F1)', () => {
  const encoder = new TextEncoder();
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  interface FrameLog {
    frames: RequestStreamEventWire[];
    ofKind(kind: RequestStreamEventWire['kind']): RequestStreamEventWire[];
  }

  function frameLog(): FrameLog {
    const frames: RequestStreamEventWire[] = [];
    return {
      frames,
      ofKind: (kind) => frames.filter((f) => f.kind === kind),
    };
  }

  function baseResponse(url: string, body: string, extra?: Partial<TransportResponse>): TransportResponse {
    return {
      status: 200,
      statusText: 'OK',
      url,
      headers: [{ key: 'content-type', value: 'text/event-stream' }],
      body,
      bodyTruncated: false,
      bodyBytes: encoder.encode(body).byteLength,
      ...extra,
    };
  }

  /** A transport whose streaming leg is scripted by the test. `send`
   *  throws, so a test proves the streaming leg was actually taken. */
  function streamingTransport(
    run: (
      observer: TransportStreamObserver,
      signal: AbortSignal | undefined,
      url: string,
    ) => Promise<TransportResponse>,
  ): RequestTransport {
    return {
      async send() {
        throw new Error('unexpected buffered send — the streaming leg should have been taken');
      },
      async sendStreaming(request, observer, signal) {
        return run(observer, signal, request.url);
      },
    };
  }

  it('ordinary response: head + done frames only, no chunk frames, no rider', async () => {
    const log = frameLog();
    const transport = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({
        status: 200,
        statusText: 'OK',
        url,
        headers: [{ key: 'content-type', value: 'application/json' }],
      });
      observer.onChunk(encoder.encode('{"ok":true}'), 11);
      return baseResponse(url, '{"ok":true}');
    });
    const snap = await executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-ordinary', emitFrame: (e) => log.frames.push(e) },
    });
    expect(snap.error).toBeNull();
    expect(snap.body).toBe('{"ok":true}');
    expect(snap.streamedCapture).toBeUndefined();
    expect(log.ofKind('head')).toHaveLength(1);
    expect(log.ofKind('head')[0]).toMatchObject({ sendId: 'send-ordinary', head: { status: 200 } });
    // The body completed inside the first flush window — no chunk frame.
    expect(log.ofKind('chunk')).toHaveLength(0);
    expect(log.ofKind('done')).toHaveLength(1);
  });

  it('live stream: flush-batched chunk frames, endedBy "end", monotonic seq', async () => {
    const log = frameLog();
    const transport = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('data: one\n\n'), 11);
      // Past the 100ms flush window so the live phase engages.
      await sleep(150);
      observer.onChunk(encoder.encode('data: two\n\n'), 22);
      return baseResponse(url, 'data: one\n\ndata: two\n\n');
    });
    const snap = await executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-live', emitFrame: (e) => log.frames.push(e) },
    });
    expect(snap.error).toBeNull();
    expect(snap.streamedCapture).toEqual({ endedBy: 'end' });
    expect(log.ofKind('chunk').length).toBeGreaterThanOrEqual(1);
    const seqs = log.frames.map((f) => f.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('Stop mid-stream: partial materialization with endedBy "stop", registry unregisters on settle', async () => {
    const log = frameLog();
    const transport = streamingTransport(async (observer, signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('data: partial\n\n'), 15);
      await new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => resolve());
      });
      return baseResponse(url, 'data: partial\n\n', { streamEndedEarly: { reason: 'aborted' } });
    });
    const pending = executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-stop', emitFrame: (e) => log.frames.push(e) },
    });
    await sleep(20);
    expect(stopActiveSend('send-stop')).toBe(true);
    const snap = await pending;
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('data: partial\n\n');
    expect(snap.bodyTruncated).toBe(false);
    expect(snap.streamedCapture).toEqual({ endedBy: 'stop' });
    expect(log.ofKind('done')).toHaveLength(1);
    // Settled sends leave the registry — a second Stop finds nothing.
    expect(stopActiveSend('send-stop')).toBe(false);
  });

  it('deadline abort without a Stop maps to endedBy "timeout"', async () => {
    const transport = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('tick 1\n'), 7);
      return baseResponse(url, 'tick 1\n', { streamEndedEarly: { reason: 'aborted' } });
    });
    const snap = await executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-timeout', emitFrame: () => undefined },
    });
    expect(snap.error).toBeNull();
    expect(snap.streamedCapture).toEqual({ endedBy: 'timeout' });
  });

  it('mid-body connection failure maps to endedBy "error" with the message', async () => {
    const transport = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('partial payload'), 15);
      return baseResponse(url, 'partial payload', {
        streamEndedEarly: { reason: 'error', message: 'connection reset' },
      });
    });
    const snap = await executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-err', emitFrame: () => undefined },
    });
    expect(snap.error).toBeNull();
    expect(snap.streamedCapture).toEqual({ endedBy: 'error', message: 'connection reset' });
  });

  it('cap truncation stamps endedBy "cap" only when the live phase engaged', async () => {
    // Engaged: a chunk frame went out before the cap tripped.
    const engaged = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('x'.repeat(64)), 64);
      await sleep(150);
      return baseResponse(url, 'x'.repeat(64), { bodyTruncated: true });
    });
    const withFrames = await executeOverTransport(makeResolved(), engaged, {
      stream: { sendId: 'send-cap-live', emitFrame: () => undefined },
    });
    expect(withFrames.streamedCapture).toEqual({ endedBy: 'cap' });
    expect(withFrames.bodyTruncated).toBe(true);

    // Not engaged: everything arrived inside the first flush window —
    // the cap abort is ordinary truncation, not a live-stream fact.
    const quiet = streamingTransport(async (observer, _signal, url) => {
      observer.onHead({ status: 200, statusText: 'OK', url, headers: [] });
      observer.onChunk(encoder.encode('x'.repeat(64)), 64);
      return baseResponse(url, 'x'.repeat(64), { bodyTruncated: true });
    });
    const noFrames = await executeOverTransport(makeResolved(), quiet, {
      stream: { sendId: 'send-cap-quiet', emitFrame: () => undefined },
    });
    expect(noFrames.streamedCapture).toBeUndefined();
    expect(noFrames.bodyTruncated).toBe(true);
  });

  it('Stop before any response head yields an error snapshot with the canonical message', async () => {
    const log = frameLog();
    const transport = streamingTransport(async (_observer, signal) => {
      await new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => resolve());
      });
      throw new TransportError('This operation was aborted.');
    });
    const pending = executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-prehead', emitFrame: (e) => log.frames.push(e) },
    });
    await sleep(20);
    expect(stopActiveSend('send-prehead')).toBe(true);
    const snap = await pending;
    expect(snap.status).toBe(0);
    expect(snap.error).toBe('Request stopped before a response arrived.');
    expect(snap.streamedCapture).toBeUndefined();
    // Nothing arrived — the feed never opened, so no frames at all.
    expect(log.frames).toHaveLength(0);
  });

  it('falls back to buffered send when the transport has no streaming leg — no frames, no rider', async () => {
    const log = frameLog();
    const { transport } = captureTransport();
    const snap = await executeOverTransport(makeResolved(), transport, {
      stream: { sendId: 'send-fallback', emitFrame: (e) => log.frames.push(e) },
    });
    expect(snap.error).toBeNull();
    expect(snap.streamedCapture).toBeUndefined();
    expect(log.frames).toHaveLength(0);
    // No streaming leg means no Stop hook either.
    expect(stopActiveSend('send-fallback')).toBe(false);
  });

  it('never takes the streaming leg without the stream option', async () => {
    let streamingCalled = false;
    const transport: RequestTransport = {
      async send(request) {
        return baseResponse(request.url, 'buffered');
      },
      async sendStreaming(request) {
        streamingCalled = true;
        return baseResponse(request.url, 'streamed');
      },
    };
    const snap = await executeOverTransport(makeResolved(), transport);
    expect(snap.body).toBe('buffered');
    expect(streamingCalled).toBe(false);
  });
});
