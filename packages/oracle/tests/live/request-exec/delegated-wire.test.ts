/**
 * The delegated family's wire shapes: a context encodes the seam's
 * request JSON-safe (file bytes base64, the jar key dropped), the
 * place parses a frame structurally and gets the seam's request back —
 * bytes decoded, the body cap clamped to the place's bound — and a
 * malformed frame is refused with the path that was wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  DELEGATED_MAX_BODY_BYTES,
  encodeDelegatedRequest,
  parseDelegatedRequestFrame,
} from '../../../src/live/request-exec/delegated-wire';
import type { TransportRequest } from '../../../src/live/request-exec/transport';

const BASE: TransportRequest = {
  method: 'POST',
  url: 'https://api.openheaders.io/upload',
  headers: [{ key: 'Authorization', value: 'Bearer resolved-token' }],
  body: { kind: 'raw', content: '{"a":1}' },
  redirect: 'follow',
  credentials: 'omit',
  maxBodyBytes: 1024,
};

function frameOf(request: ReturnType<typeof encodeDelegatedRequest>): Record<string, unknown> {
  return { type: 'delegateRequest', sendId: 'send-1', workspaceId: 'ws-1', request };
}

describe('encodeDelegatedRequest', () => {
  it('carries the seam request verbatim with every knob, minus the context jar key', () => {
    const wire = encodeDelegatedRequest({
      ...BASE,
      cookieJarKey: 'ws-1',
      sslVerification: false,
      httpVersion: '2',
      timeoutMs: 5000,
      digestAuth: { username: 'u', password: 'p' },
    });
    expect(wire).not.toHaveProperty('cookieJarKey');
    expect(wire.sslVerification).toBe(false);
    expect(wire.httpVersion).toBe('2');
    expect(wire.timeoutMs).toBe(5000);
    expect(wire.digestAuth).toEqual({ username: 'u', password: 'p' });
    expect(wire.headers).toEqual(BASE.headers);
    expect(wire.body).toEqual({ kind: 'raw', content: '{"a":1}' });
  });

  it('base64-encodes multipart file bytes and keeps text parts as they are', () => {
    const wire = encodeDelegatedRequest({
      ...BASE,
      body: {
        kind: 'multipart',
        parts: [
          { kind: 'text', name: 'note', value: 'hello' },
          {
            kind: 'file',
            name: 'doc',
            filename: 'a.bin',
            mimeType: 'application/octet-stream',
            bytes: new Uint8Array([1, 2, 3]),
          },
        ],
      },
    });
    expect(wire.body).toEqual({
      kind: 'multipart',
      parts: [
        { kind: 'text', name: 'note', value: 'hello' },
        { kind: 'file', name: 'doc', filename: 'a.bin', mimeType: 'application/octet-stream', bytesBase64: 'AQID' },
      ],
    });
  });
});

describe('parseDelegatedRequestFrame', () => {
  it('round-trips a frame onto the seam, file bytes decoded', () => {
    const wire = encodeDelegatedRequest({
      ...BASE,
      body: {
        kind: 'multipart',
        parts: [
          { kind: 'file', name: 'doc', filename: 'a.bin', mimeType: 'text/plain', bytes: new Uint8Array([104, 105]) },
        ],
      },
      trustedRootsPem: ['-----BEGIN CERTIFICATE-----'],
      dpop: {
        key: {
          algorithm: 'ES256',
          privateKeyPkcs8: 'pk',
          publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
          jkt: 'j',
        },
        accessToken: 'at',
      },
    });
    const parsed = parseDelegatedRequestFrame(frameOf(wire));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.frame.sendId).toBe('send-1');
    expect(parsed.frame.workspaceId).toBe('ws-1');
    const { request } = parsed.frame;
    expect(request.url).toBe(BASE.url);
    expect(request.trustedRootsPem).toEqual(['-----BEGIN CERTIFICATE-----']);
    expect(request.dpop?.key.publicJwk).toEqual({ kty: 'EC', crv: 'P-256', x: 'x', y: 'y' });
    expect(request.body.kind).toBe('multipart');
    if (request.body.kind !== 'multipart') return;
    const part = request.body.parts[0];
    expect(part.kind).toBe('file');
    if (part.kind !== 'file') return;
    expect(Array.from(part.bytes)).toEqual([104, 105]);
    expect(part).not.toHaveProperty('bytesBase64');
  });

  it('clamps the body cap to the place bound whatever the frame asks', () => {
    const parsed = parseDelegatedRequestFrame(
      frameOf(encodeDelegatedRequest({ ...BASE, maxBodyBytes: DELEGATED_MAX_BODY_BYTES * 50 })),
    );
    expect(parsed.ok && parsed.frame.request.maxBodyBytes).toBe(DELEGATED_MAX_BODY_BYTES);
    const small = parseDelegatedRequestFrame(frameOf(encodeDelegatedRequest({ ...BASE, maxBodyBytes: 10 })));
    expect(small.ok && small.frame.request.maxBodyBytes).toBe(10);
  });

  it('never lets a jar key through, even when a frame smuggles one', () => {
    const parsed = parseDelegatedRequestFrame(
      frameOf({ ...encodeDelegatedRequest(BASE), cookieJarKey: 'ws-1' } as ReturnType<typeof encodeDelegatedRequest>),
    );
    expect(parsed.ok && parsed.frame.request).not.toHaveProperty('cookieJarKey');
  });

  it('refuses a frame naming the wrong field shape, with its path', () => {
    const wire = encodeDelegatedRequest(BASE);
    const parsed = parseDelegatedRequestFrame(
      frameOf({ ...wire, redirect: 'sometimes' } as unknown as ReturnType<typeof encodeDelegatedRequest>),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/^Malformed delegated send frame at request\.redirect: /);
  });

  it('refuses a file part whose bytes are not base64 rather than sending empty bytes', () => {
    const wire = encodeDelegatedRequest(BASE);
    const parsed = parseDelegatedRequestFrame(
      frameOf({
        ...wire,
        body: {
          kind: 'multipart',
          parts: [{ kind: 'file', name: 'f', filename: 'f', mimeType: 'x/y', bytesBase64: '!!!' }],
        },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('request.body.parts.0.bytesBase64');
    expect(parsed.error).toContain('not base64');
  });

  it('refuses an empty sendId or workspaceId and a foreign channel type', () => {
    const wire = encodeDelegatedRequest(BASE);
    expect(parseDelegatedRequestFrame({ ...frameOf(wire), sendId: '' }).ok).toBe(false);
    expect(parseDelegatedRequestFrame({ ...frameOf(wire), workspaceId: '' }).ok).toBe(false);
    expect(parseDelegatedRequestFrame({ ...frameOf(wire), type: 'executeRequest' }).ok).toBe(false);
  });
});
