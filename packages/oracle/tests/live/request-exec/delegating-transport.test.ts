/**
 * The delegating transport over a fake wire: the seam request rides
 * the `delegateRequest` frame with the context's workspace and a
 * transport-minted send id; the place's head / chunk frames feed the
 * executor's observer (bytes decoded, `done` swallowed); the answer
 * comes back as the seam response carrying the answering host's stamp;
 * the place's classified failure and a wire rejection both surface as
 * a TransportError; the executor's abort forwards as the place's Stop;
 * the frame claim is released on every path.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { describe, expect, it, vi } from 'vitest';
import type { DelegatedRequestFrame, DelegatedRequestResult } from '../../../src/live/request-exec/delegated-wire';
import {
  createDelegatingRequestTransport,
  type DelegatedWire,
} from '../../../src/live/request-exec/delegating-transport';
import { TransportError, type TransportRequest } from '../../../src/live/request-exec/transport';

const REQUEST: TransportRequest = {
  method: 'POST',
  url: 'https://api.openheaders.io/items',
  headers: [{ key: 'Authorization', value: 'Bearer resolved' }],
  body: { kind: 'raw', content: '{"a":1}' },
  redirect: 'follow',
  credentials: 'omit',
  maxBodyBytes: 4096,
  timeoutMs: 3000,
};

const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

interface FakeWire extends DelegatedWire {
  frames: Map<string, (event: RequestStreamEventWire) => void>;
  calls: DelegatedRequestFrame[];
  aborted: string[];
}

function fakeWire(answer: (frame: DelegatedRequestFrame, wire: FakeWire) => Promise<DelegatedRequestResult>): FakeWire {
  const wire: FakeWire = {
    frames: new Map(),
    calls: [],
    aborted: [],
    call: (frame) => {
      wire.calls.push(frame);
      return answer(frame, wire);
    },
    abort: (sendId) => {
      wire.aborted.push(sendId);
    },
    subscribeFrames: (sendId, onFrame) => {
      wire.frames.set(sendId, onFrame);
      return () => {
        wire.frames.delete(sendId);
      };
    },
  };
  return wire;
}

const RESPONSE = {
  status: 201,
  statusText: 'Created',
  url: 'https://api.openheaders.io/items',
  headers: [{ key: 'content-type', value: 'application/json' }],
  body: '{"id":1}',
  bodyTruncated: false,
  bodyBytes: 8,
};

describe('createDelegatingRequestTransport', () => {
  it('rides the delegateRequest frame with the workspace and a transport-minted id, answering the stamped response', async () => {
    const wire = fakeWire(async () => ({ success: true, response: RESPONSE, executedOn: EXECUTED_ON }));
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1', mintSendId: () => 'wire-1' });
    const response = await transport.send({ ...REQUEST, cookieJarKey: 'ws-1' });
    expect(wire.calls).toHaveLength(1);
    expect(wire.calls[0]).toMatchObject({
      type: 'delegateRequest',
      sendId: 'wire-1',
      workspaceId: 'ws-1',
      request: { method: 'POST', url: REQUEST.url, timeoutMs: 3000 },
    });
    expect(wire.calls[0].request).not.toHaveProperty('cookieJarKey');
    expect(response).toEqual({ ...RESPONSE, executedOn: EXECUTED_ON });
    // The claim is released once the answer is in.
    expect(wire.frames.size).toBe(0);
  });

  it("feeds the place's head and chunk frames to the observer, bytes decoded, and swallows done", async () => {
    const wire = fakeWire(async (frame, w) => {
      const onFrame = w.frames.get(frame.sendId);
      onFrame?.({
        sendId: frame.sendId,
        seq: 0,
        kind: 'head',
        head: { status: 200, statusText: 'OK', url: 'u', headers: [] },
      });
      onFrame?.({ sendId: frame.sendId, seq: 1, kind: 'chunk', chunkBase64: 'aGk=', totalBytes: 2 });
      onFrame?.({ sendId: frame.sendId, seq: 2, kind: 'done' });
      return { success: true, response: RESPONSE, executedOn: EXECUTED_ON };
    });
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1' });
    const onHead = vi.fn();
    const onChunk = vi.fn();
    await transport.sendStreaming?.(REQUEST, { onHead, onChunk });
    expect(onHead).toHaveBeenCalledWith({ status: 200, statusText: 'OK', url: 'u', headers: [] });
    expect(onChunk).toHaveBeenCalledOnce();
    expect(Array.from(onChunk.mock.calls[0][0] as Uint8Array)).toEqual([104, 105]);
    expect(onChunk.mock.calls[0][1]).toBe(2);
  });

  it("forwards the executor's abort as the place's Stop by the wire id", async () => {
    const pendingAnswer: { settle?: (result: DelegatedRequestResult) => void } = {};
    const wire = fakeWire(
      () =>
        new Promise<DelegatedRequestResult>((resolve) => {
          pendingAnswer.settle = resolve;
        }),
    );
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1', mintSendId: () => 'wire-7' });
    const controller = new AbortController();
    const pending = transport.sendStreaming?.(REQUEST, { onHead: () => {}, onChunk: () => {} }, controller.signal);
    controller.abort();
    expect(wire.aborted).toEqual(['wire-7']);
    pendingAnswer.settle?.({
      success: true,
      response: { ...RESPONSE, streamEndedEarly: { reason: 'aborted' } },
      executedOn: EXECUTED_ON,
    });
    const response = await pending;
    expect(response?.streamEndedEarly).toEqual({ reason: 'aborted' });
  });

  it("surfaces the place's classified failure as a TransportError with its hint and stamp", async () => {
    const wire = fakeWire(async () => ({
      success: false,
      error: 'self signed certificate',
      hint: { kind: 'trust-certificate', host: 'api.openheaders.io', port: 443, code: 'DEPTH_ZERO_SELF_SIGNED_CERT' },
      executedOn: EXECUTED_ON,
    }));
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1' });
    const failure = await transport.send(REQUEST).catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(TransportError);
    if (!(failure instanceof TransportError)) return;
    expect(failure.message).toBe('self signed certificate');
    expect(failure.hint).toMatchObject({ kind: 'trust-certificate' });
    expect(failure.executedOn).toEqual(EXECUTED_ON);
    expect(wire.frames.size).toBe(0);
  });

  it("surfaces a wire rejection — a dead wire or the place's refusal — as a TransportError without a stamp", async () => {
    const wire = fakeWire(async () => {
      throw new Error('Sending requests from other connected devices is disabled on this host.');
    });
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1' });
    const failure = await transport.send(REQUEST).catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(TransportError);
    if (!(failure instanceof TransportError)) return;
    expect(failure.message).toBe('Sending requests from other connected devices is disabled on this host.');
    expect(failure.executedOn).toBeUndefined();
    expect(wire.frames.size).toBe(0);
  });
});
