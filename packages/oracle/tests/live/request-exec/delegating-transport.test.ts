/**
 * The delegating transport over a fake wire: the seam request rides
 * the `delegateRequest` frame with the context's workspace and a
 * transport-minted send id; the place's head / chunk frames feed the
 * executor's observer (bytes decoded, `done` swallowed); the answer
 * comes back as the seam response carrying the answering host's stamp;
 * the place's classified failure and a wire rejection both surface as
 * a TransportError; the executor's abort forwards as the place's Stop;
 * the frame claim is released on every path. The redirect chain is
 * the context's: every hop is its own manual exchange at the place,
 * the shared policy derives the next hop, the jar speaks on every hop,
 * the intermediate hops' frames never reach the observer.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { describe, expect, it, vi } from 'vitest';
import { CookieJar } from '../../../src/live/request-exec/cookie-jar';
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
      // The place never follows: every hop is the context's own exchange.
      request: { method: 'POST', url: REQUEST.url, timeoutMs: 3000, redirect: 'manual' },
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

describe("createDelegatingRequestTransport — the context's cookie jar", () => {
  const JAR_REQUEST: TransportRequest = { ...REQUEST, cookieJarKey: 'ws-1' };

  it('attaches the jar match before the frame leaves and captures the answered rows — the key never rides', async () => {
    const jar = new CookieJar();
    jar.store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc' }]);
    const wire = fakeWire(async () => ({
      success: true,
      response: { ...RESPONSE, headers: [...RESPONSE.headers, { key: 'set-cookie', value: 'theme=dark; Path=/' }] },
      executedOn: EXECUTED_ON,
    }));
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1', jars: () => jar });
    const response = await transport.send(JAR_REQUEST);
    const sent = wire.calls[0]?.request;
    expect(sent?.headers).toEqual([
      { key: 'Authorization', value: 'Bearer resolved' },
      { key: 'Cookie', value: 'sid=abc' },
    ]);
    expect(sent !== undefined && 'cookieJarKey' in sent).toBe(false);
    expect(response.cookieHeaderAttached).toBe('sid=abc');
    expect(response.cookiesCaptured).toEqual(['theme']);
    expect(jar.cookieHeaderFor('https://api.openheaders.io/x')).toBe('sid=abc; theme=dark');
  });

  it('leaves a send without the jar opt-in, or a context without a jar registry, untouched', async () => {
    const wire = fakeWire(async () => ({ success: true, response: RESPONSE, executedOn: EXECUTED_ON }));
    const withRegistry = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1', jars: () => new CookieJar() });
    const plain = await withRegistry.send(REQUEST);
    expect(plain.cookieHeaderAttached).toBeUndefined();
    expect(plain.cookiesCaptured).toBeUndefined();
    const browserContext = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1' });
    const browser = await browserContext.send(JAR_REQUEST);
    expect(wire.calls[1]?.request.headers).toEqual(REQUEST.headers);
    expect(browser.cookieHeaderAttached).toBeUndefined();
  });

  it('follows a redirect chain itself — each hop a manual exchange at the place, the jar speaking on every hop', async () => {
    const jar = new CookieJar();
    const wire = fakeWire(async (frame) => {
      if (frame.request.url.endsWith('/login')) {
        return {
          success: true,
          response: {
            ...RESPONSE,
            status: 302,
            statusText: 'Found',
            url: frame.request.url,
            headers: [
              { key: 'location', value: '/me' },
              { key: 'set-cookie', value: 'session=live123; Path=/' },
            ],
            body: '',
            bodyBytes: 0,
          },
          executedOn: EXECUTED_ON,
        };
      }
      return {
        success: true,
        response: { ...RESPONSE, status: 200, statusText: 'OK', url: frame.request.url, body: 'me', bodyBytes: 2 },
        executedOn: EXECUTED_ON,
      };
    });
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1', jars: () => jar });
    const response = await transport.send({
      ...JAR_REQUEST,
      method: 'POST',
      url: 'https://api.openheaders.io/login',
    });
    expect(wire.calls.map((c) => c.request.url)).toEqual([
      'https://api.openheaders.io/login',
      'https://api.openheaders.io/me',
    ]);
    expect(wire.calls.every((c) => c.request.redirect === 'manual')).toBe(true);
    // The cookie the first hop set rides the second — the spec's 302
    // POST→GET demotion applied, the body headers dropped with it.
    expect(wire.calls[1]?.request.method).toBe('GET');
    expect(wire.calls[1]?.request.headers).toEqual([
      { key: 'Authorization', value: 'Bearer resolved' },
      { key: 'Cookie', value: 'session=live123' },
    ]);
    expect(response.status).toBe(200);
    expect(response.url).toBe('https://api.openheaders.io/me');
    expect(response.cookiesCaptured).toEqual(['session']);
    expect(response.cookieHeaderAttached).toBeUndefined();
    expect(response.redirectChain).toEqual([
      {
        url: 'https://api.openheaders.io/login',
        method: 'POST',
        status: 302,
        statusText: 'Found',
        location: '/me',
        methodChangedTo: 'GET',
      },
    ]);
    expect(wire.frames.size).toBe(0);
  });

  it("feeds the observer the final hop alone — an intermediate hop's head and chunks are the loop's", async () => {
    const wire = fakeWire(async (frame, w) => {
      const onFrame = w.frames.get(frame.sendId);
      const first = frame.request.url.endsWith('/items');
      const head = first
        ? {
            status: 307,
            statusText: 'Temporary Redirect',
            url: frame.request.url,
            headers: [{ key: 'location', value: '/items-v2' }],
          }
        : { status: 201, statusText: 'Created', url: frame.request.url, headers: [] };
      onFrame?.({ sendId: frame.sendId, seq: 0, kind: 'head', head });
      onFrame?.({ sendId: frame.sendId, seq: 1, kind: 'chunk', chunkBase64: first ? 'eA==' : 'aGk=', totalBytes: 2 });
      return {
        success: true,
        response: { ...RESPONSE, ...head, body: first ? 'x' : 'hi', bodyBytes: first ? 1 : 2 },
        executedOn: EXECUTED_ON,
      };
    });
    const transport = createDelegatingRequestTransport({ wire, workspaceId: 'ws-1' });
    if (transport.sendStreaming === undefined) throw new Error('the delegating transport streams');
    const heads: number[] = [];
    const chunks: string[] = [];
    const response = await transport.sendStreaming(
      REQUEST,
      { onHead: (head) => heads.push(head.status), onChunk: (bytes) => chunks.push(new TextDecoder().decode(bytes)) },
      undefined,
    );
    expect(heads).toEqual([201]);
    expect(chunks).toEqual(['hi']);
    // 307 keeps the method and the body.
    expect(wire.calls[1]?.request.method).toBe('POST');
    expect(response.redirectChain).toHaveLength(1);
  });

  it("stops at the request's redirect limit, and surfaces the first response verbatim under manual", async () => {
    const redirecting = fakeWire(async (frame) => ({
      success: true,
      response: {
        ...RESPONSE,
        status: 302,
        statusText: 'Found',
        url: frame.request.url,
        headers: [{ key: 'location', value: '/again' }],
      },
      executedOn: EXECUTED_ON,
    }));
    const transport = createDelegatingRequestTransport({ wire: redirecting, workspaceId: 'ws-1' });
    await expect(transport.send({ ...REQUEST, maxRedirects: 1 })).rejects.toThrow(
      "Stopped after 1 redirects — the request's redirect limit.",
    );
    expect(redirecting.calls).toHaveLength(2);

    const manual = await transport.send({ ...REQUEST, redirect: 'manual' });
    expect(manual.status).toBe(302);
    expect(manual.redirectChain).toBeUndefined();
    expect(redirecting.calls).toHaveLength(3);
  });
});
