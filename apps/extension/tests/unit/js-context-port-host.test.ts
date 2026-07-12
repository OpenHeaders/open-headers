/**
 * JS-contexts port host — chrome adapter wires `chrome.runtime.onConnect`
 * to `JsContextHub.attach`. Sibling of `console-stream-port-host.test.ts`.
 */

import type { JsContext } from '@openheaders/core/js-contexts';
import { JsContextHub } from '@openheaders/oracle/js-context-hub';
import { describe, expect, it, vi } from 'vitest';

import { acceptJsContextsPort } from '@/background/js-context-port-host/accept-port';
import { createPortSink } from '@/background/js-context-port-host/port-sink';

interface FakePort {
  name: string;
  posted: unknown[];
  disconnectListeners: Array<() => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function fakePort(name: string, postImpl?: (msg: unknown) => void): FakePort {
  const port: FakePort = {
    name,
    posted: [],
    disconnectListeners: [],
    onDisconnect: {
      addListener: (fn) => {
        port.disconnectListeners.push(fn);
      },
    },
    postMessage: vi.fn((msg: unknown) => {
      if (postImpl) postImpl(msg);
      else port.posted.push(msg);
    }),
    disconnect: vi.fn(),
  };
  return port;
}

function context(contextKey: string): JsContext {
  return {
    contextKey,
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
  };
}

describe('createPortSink', () => {
  it('posts ready + contexts-update envelopes', () => {
    const port = fakePort('oh-contexts:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverReady(1);
    sink.deliverUpdate({ kind: 'tab-cleared', tabId: 1 });
    expect(port.posted).toEqual([
      { kind: 'ready', tabId: 1 },
      { kind: 'contexts-update', update: { kind: 'tab-cleared', tabId: 1 } },
    ]);
  });

  it('swallows postMessage throws (dead port)', () => {
    const port = fakePort('oh-contexts:1', () => {
      throw new Error('dead');
    });
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    expect(() => sink.deliverReady(1)).not.toThrow();
  });

  it('close() disconnects + swallows errors', () => {
    const port = fakePort('oh-contexts:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.close();
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    port.disconnect = vi.fn(() => {
      throw new Error('gone');
    });
    expect(() => sink.close()).not.toThrow();
  });
});

describe('acceptJsContextsPort', () => {
  it('rejects ports with the wrong prefix', () => {
    const hub = new JsContextHub();
    const port = fakePort('oh-console:1');
    expect(acceptJsContextsPort(hub, port as unknown as chrome.runtime.Port)).toBe(false);
  });

  it('attaches matching port; ready + live-set replay delivered synchronously', () => {
    const hub = new JsContextHub();
    hub.recordCreated(5, context('page::1'));
    const port = fakePort('oh-contexts:5');
    expect(acceptJsContextsPort(hub, port as unknown as chrome.runtime.Port)).toBe(true);
    expect(port.posted[0]).toEqual({ kind: 'ready', tabId: 5 });
    expect(port.posted).toHaveLength(2);
    expect(port.posted[1]).toEqual({
      kind: 'contexts-update',
      update: { kind: 'context-added', tabId: 5, context: context('page::1') },
    });
  });

  it('onDisconnect detaches: subsequent updates do not reach the port', () => {
    const hub = new JsContextHub();
    const port = fakePort('oh-contexts:9');
    acceptJsContextsPort(hub, port as unknown as chrome.runtime.Port);
    for (const fn of port.disconnectListeners) fn();
    const before = port.posted.length;
    hub.recordCreated(9, context('page::1'));
    expect(port.posted.length).toBe(before);
  });
});
