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
