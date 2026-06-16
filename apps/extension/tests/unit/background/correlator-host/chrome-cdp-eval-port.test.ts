/**
 * `ChromeCdpEvalPort` — the chrome adapter that runs a dynamic rule's user JS
 * in a per-frame isolated world (D2b-2a). Verifies the
 * `Page.createIsolatedWorld` + `Runtime.callFunctionOn` mapping, the per-frame
 * context cache, the stale-context recreate-and-retry, and the
 * fault-→-`{ok:false}` discipline (a fault never throws into the interceptor).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CdpSessionSender } from '@/background/correlator-host/cdp-session-sender';
import { ChromeCdpEvalPort } from '@/background/correlator-host/chrome-cdp-eval-port';

const TARGET = { tabId: 7, sessionId: 'page' };

interface SentCall {
  tabId: number;
  sessionId: string;
  method: string;
  params?: Record<string, unknown>;
}

function fakeSender(handler: (call: SentCall) => unknown) {
  const calls: SentCall[] = [];
  const sender: CdpSessionSender = {
    cdpAvailable: true,
    async sendOnSession(tabId, sessionId, method, params) {
      const call: SentCall = { tabId, sessionId, method, params };
      calls.push(call);
      return handler(call);
    },
  };
  return { sender, calls };
}

afterEach(() => vi.useRealTimers());

describe('ChromeCdpEvalPort', () => {
  it('reports available from the sender', () => {
    expect(new ChromeCdpEvalPort({ cdpAvailable: false, sendOnSession: async () => ({}) }).available).toBe(false);
  });

  it('creates an isolated world in the frame and calls the fn on it, returning the value', async () => {
    const { sender, calls } = fakeSender((call) =>
      call.method === 'Page.createIsolatedWorld' ? { executionContextId: 42 } : { result: { value: '{"ok":1}' } },
    );
    const port = new ChromeCdpEvalPort(sender);

    const outcome = await port.callInIsolatedWorld(TARGET, 'frame-1', 'function(a){return "x"}', { url: 'u' });

    expect(outcome).toEqual({ ok: true, value: '{"ok":1}' });
    expect(calls[0]).toEqual({
      tabId: 7,
      sessionId: 'page',
      method: 'Page.createIsolatedWorld',
      params: { frameId: 'frame-1', worldName: 'OpenHeadersDebug' },
    });
    expect(calls[1]).toEqual({
      tabId: 7,
      sessionId: 'page',
      method: 'Runtime.callFunctionOn',
      params: {
        functionDeclaration: 'function(a){return "x"}',
        executionContextId: 42,
        arguments: [{ value: { url: 'u' } }],
        awaitPromise: true,
        returnByValue: true,
      },
    });
  });

  it('reuses the cached isolated world across calls in the same frame', async () => {
    let worlds = 0;
    const { sender, calls } = fakeSender((call) => {
      if (call.method === 'Page.createIsolatedWorld') {
        worlds += 1;
        return { executionContextId: 5 };
      }
      return { result: { value: 'v' } };
    });
    const port = new ChromeCdpEvalPort(sender);

    await port.callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});
    await port.callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});

    expect(worlds).toBe(1);
    expect(calls.filter((c) => c.method === 'Runtime.callFunctionOn')).toHaveLength(2);
  });

  it('maps a thrown user fn (exceptionDetails) to ok:false', async () => {
    const { sender } = fakeSender((call) =>
      call.method === 'Page.createIsolatedWorld'
        ? { executionContextId: 1 }
        : { exceptionDetails: { exception: { description: 'TypeError: boom' } } },
    );

    const outcome = await new ChromeCdpEvalPort(sender).callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('boom');
  });

  it('maps a non-string result to ok:false', async () => {
    const { sender } = fakeSender((call) =>
      call.method === 'Page.createIsolatedWorld' ? { executionContextId: 1 } : { result: { value: 123 } },
    );

    const outcome = await new ChromeCdpEvalPort(sender).callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});

    expect(outcome.ok).toBe(false);
  });

  it('returns ok:false when the isolated world cannot be created', async () => {
    const { sender } = fakeSender((call) =>
      call.method === 'Page.createIsolatedWorld' ? {} : { result: { value: 'x' } },
    );

    const outcome = await new ChromeCdpEvalPort(sender).callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});

    expect(outcome.ok).toBe(false);
  });

  it('recreates the isolated world and retries once when the cached context is stale', async () => {
    let worlds = 0;
    let firstCallOn = true;
    const { sender } = fakeSender((call) => {
      if (call.method === 'Page.createIsolatedWorld') {
        worlds += 1;
        return { executionContextId: worlds };
      }
      // The frame navigated and tore the first isolated world down.
      if (firstCallOn) {
        firstCallOn = false;
        throw new Error('Cannot find context with specified id');
      }
      return { result: { value: 'recovered' } };
    });
    const port = new ChromeCdpEvalPort(sender);

    const outcome = await port.callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});

    expect(outcome).toEqual({ ok: true, value: 'recovered' });
    expect(worlds).toBe(2); // initial world + the recreate after the stale retry
  });

  it('times out a hung eval to ok:false', async () => {
    vi.useFakeTimers();
    const { sender } = fakeSender((call) =>
      call.method === 'Page.createIsolatedWorld' ? { executionContextId: 1 } : new Promise(() => {}),
    );
    const port = new ChromeCdpEvalPort(sender);

    const pending = port.callInIsolatedWorld(TARGET, 'frame-1', 'fn', {});
    await vi.advanceTimersByTimeAsync(5000);

    expect(await pending).toEqual({ ok: false, error: 'eval timed out' });
  });
});
