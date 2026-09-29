/**
 * The delegated gRPC leg's wire shapes: a context's unary request
 * rides with its message base64 and comes out the seam's request at
 * the place (the message decoded, the cap clamped to the place's
 * bound); a run that does not decode and a frame missing its id
 * refuse structurally, naming the path; the streaming open carries
 * the dial alone; the place's response rides with its body base64
 * and decodes back to the seam's; the answer narrows by its stamp.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeDelegatedGrpcResponse,
  encodeDelegatedGrpcRequest,
  encodeDelegatedGrpcResponse,
  encodeDelegatedGrpcStreamRequest,
  isDelegatedGrpcInvokeResult,
  parseDelegatedGrpcInvokeFrame,
  parseDelegatedGrpcOpenFrame,
} from '../../../src/live/grpc-exec/delegated-wire';
import type { GrpcTransportRequest, GrpcTransportResponse } from '../../../src/live/grpc-exec/transport';
import { DELEGATED_MAX_BODY_BYTES } from '../../../src/live/request-exec/delegated-wire';

const REQUEST: GrpcTransportRequest = {
  authority: 'grpc.openheaders.io:443',
  tls: true,
  sslVerification: false,
  path: '/books.Books/GetBook',
  metadata: [{ key: 'authorization', value: 'Bearer resolved' }],
  message: new Uint8Array([10, 2, 104, 105]),
  timeoutMs: 5000,
  keepaliveIntervalMs: 10_000,
  maxBodyBytes: 4096,
};

const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

describe('the unary invoke frame', () => {
  it('encodes the message base64 and parses back to the seam request, the cap clamped', () => {
    const wire = encodeDelegatedGrpcRequest({ ...REQUEST, maxBodyBytes: DELEGATED_MAX_BODY_BYTES * 4 });
    expect(wire).not.toHaveProperty('message');
    expect(wire.messageBase64).toBe('CgJoaQ==');
    const parsed = parseDelegatedGrpcInvokeFrame({
      type: 'delegateGrpcInvoke',
      sendId: 'send-1',
      workspaceId: 'ws-1',
      request: wire,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.frame.sendId).toBe('send-1');
    expect(parsed.frame.workspaceId).toBe('ws-1');
    expect(parsed.frame.request).not.toHaveProperty('messageBase64');
    expect(Array.from(parsed.frame.request.message)).toEqual([10, 2, 104, 105]);
    expect(parsed.frame.request.maxBodyBytes).toBe(DELEGATED_MAX_BODY_BYTES);
    expect(parsed.frame.request).toMatchObject({
      authority: REQUEST.authority,
      tls: true,
      sslVerification: false,
      path: REQUEST.path,
      metadata: REQUEST.metadata,
      timeoutMs: 5000,
      keepaliveIntervalMs: 10_000,
    });
  });

  it('refuses a message that is not base64, naming the field', () => {
    const parsed = parseDelegatedGrpcInvokeFrame({
      type: 'delegateGrpcInvoke',
      sendId: 'send-1',
      workspaceId: 'ws-1',
      request: { ...encodeDelegatedGrpcRequest(REQUEST), messageBase64: '!!not base64!!' },
    });
    expect(parsed).toEqual({
      ok: false,
      error: 'Malformed delegated gRPC invoke frame at request.messageBase64: message bytes are not base64',
    });
  });

  it('refuses a frame missing its id or its path', () => {
    const base = { type: 'delegateGrpcInvoke', workspaceId: 'ws-1', request: encodeDelegatedGrpcRequest(REQUEST) };
    const noId = parseDelegatedGrpcInvokeFrame(base);
    expect(noId.ok).toBe(false);
    if (!noId.ok) expect(noId.error).toMatch(/^Malformed delegated gRPC invoke frame at sendId/);
    const noPath = parseDelegatedGrpcInvokeFrame({
      ...base,
      sendId: 'send-1',
      request: { ...base.request, path: '' },
    });
    expect(noPath.ok).toBe(false);
    if (!noPath.ok) expect(noPath.error).toMatch(/^Malformed delegated gRPC invoke frame at request\.path/);
  });
});

describe('the streaming open frame', () => {
  it('carries the dial alone and parses back to the seam stream request', () => {
    const { message: _message, maxBodyBytes: _cap, ...stream } = REQUEST;
    const wire = encodeDelegatedGrpcStreamRequest(stream);
    const parsed = parseDelegatedGrpcOpenFrame({
      type: 'delegateGrpcOpen',
      socketId: 'sock-1',
      workspaceId: 'ws-1',
      request: wire,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.frame).toEqual({ socketId: 'sock-1', workspaceId: 'ws-1', request: stream });
  });

  it('refuses an open naming no socket', () => {
    const parsed = parseDelegatedGrpcOpenFrame({ type: 'delegateGrpcOpen', workspaceId: 'ws-1', request: {} });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/^Malformed delegated gRPC open frame at socketId/);
  });
});

describe('the unary response', () => {
  const RESPONSE: GrpcTransportResponse = {
    httpStatus: 200,
    headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
    trailers: [{ key: 'grpc-status', value: '0' }],
    body: new Uint8Array([0, 0, 0, 0, 2, 8, 1]),
    bodyTruncated: false,
    proxyRoute: { plane: 'system', proxyUrl: 'http://proxy.openheaders.io:3128' },
  };

  it('rides with its body base64 and decodes back to the seam response', () => {
    const wire = encodeDelegatedGrpcResponse(RESPONSE);
    expect(wire).not.toHaveProperty('body');
    expect(wire.bodyBase64).toBe('AAAAAAIIAQ==');
    const decoded = decodeDelegatedGrpcResponse(wire);
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded?.body ?? [])).toEqual([0, 0, 0, 0, 2, 8, 1]);
    expect(decoded).toMatchObject({
      httpStatus: 200,
      headers: RESPONSE.headers,
      trailers: RESPONSE.trailers,
      bodyTruncated: false,
      proxyRoute: RESPONSE.proxyRoute,
    });
    expect(decoded).not.toHaveProperty('bodyBase64');
  });

  it('answers null for a body that does not decode', () => {
    expect(decodeDelegatedGrpcResponse({ ...encodeDelegatedGrpcResponse(RESPONSE), bodyBase64: '!!' })).toBeNull();
  });

  it('narrows the answer by its stamp and shape', () => {
    const wire = encodeDelegatedGrpcResponse(RESPONSE);
    expect(isDelegatedGrpcInvokeResult({ success: true, response: wire, executedOn: EXECUTED_ON })).toBe(true);
    expect(isDelegatedGrpcInvokeResult({ success: true, response: wire })).toBe(false);
    expect(isDelegatedGrpcInvokeResult({ success: false, error: 'refused', executedOn: EXECUTED_ON })).toBe(true);
    expect(isDelegatedGrpcInvokeResult({ success: false, error: 'refused' })).toBe(false);
    expect(isDelegatedGrpcInvokeResult(null)).toBe(false);
    expect(isDelegatedGrpcInvokeResult({ ok: true })).toBe(false);
  });
});
