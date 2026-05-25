/**
 * Page port host — chrome adapter wires `chrome.runtime.onConnect` to
 * `PageStreamHub.attach`. Sibling of `lifecycle-port-host.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  PAGE_PORT_PREFIX,
  PageStreamHub,
  pagePortName,
  parsePagePortName,
} from '@openheaders/oracle/page-stream-hub';

import { acceptPagePort } from '@/background/page-port-host/accept-port';
import { createPortSink } from '@/background/page-port-host/port-sink';

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

describe('parsePagePortName', () => {
  it('parses oh-page:<tabId>', () => {
    expect(parsePagePortName('oh-page:42')).toBe(42);
    expect(parsePagePortName('oh-page:0')).toBe(0);
  });

  it('rejects siblings + malformed', () => {
    expect(parsePagePortName('oh-lifecycle:1')).toBeNull();
    expect(parsePagePortName('oh-page:')).toBeNull();
    expect(parsePagePortName('oh-page:nope')).toBeNull();
    expect(parsePagePortName('oh-page:-1')).toBeNull();
  });

  it('roundtrips with pagePortName', () => {
    expect(parsePagePortName(pagePortName(7))).toBe(7);
    expect(PAGE_PORT_PREFIX).toBe('oh-page:');
  });
});

describe('createPortSink', () => {
  it('posts ready + page-update envelopes', () => {
    const port = fakePort(pagePortName(1));
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverReady(1);
    sink.deliverUpdate({ kind: 'tab-cleared', tabId: 1 });
    expect(port.posted).toEqual([
      { kind: 'ready', tabId: 1 },
      { kind: 'page-update', update: { kind: 'tab-cleared', tabId: 1 } },
    ]);
  });

  it('swallows postMessage throws (dead port)', () => {
    const port = fakePort(pagePortName(1), () => {
      throw new Error('dead');
    });
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    expect(() => sink.deliverReady(1)).not.toThrow();
  });

  it('close() disconnects + swallows errors', () => {
    const port = fakePort(pagePortName(1));
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.close();
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    port.disconnect = vi.fn(() => {
      throw new Error('gone');
    });
    expect(() => sink.close()).not.toThrow();
  });
});

describe('acceptPagePort', () => {
  it('rejects ports with the wrong prefix', () => {
    const hub = new PageStreamHub();
    const port = fakePort('oh-lifecycle:1');
    expect(acceptPagePort(hub, port as unknown as chrome.runtime.Port)).toBe(false);
  });

  it('attaches matching port; ready + replay delivered synchronously', () => {
    const hub = new PageStreamHub();
    hub.notifyNavStarted(5, 100, 'https://openheaders.io/a');
    const port = fakePort(pagePortName(5));
    expect(acceptPagePort(hub, port as unknown as chrome.runtime.Port)).toBe(true);
    expect(port.posted[0]).toEqual({ kind: 'ready', tabId: 5 });
    expect(port.posted).toHaveLength(2);
    expect((port.posted[1] as { kind: string }).kind).toBe('page-update');
  });

  it('onDisconnect detaches: subsequent updates do not reach the port', () => {
    const hub = new PageStreamHub();
    const port = fakePort(pagePortName(9));
    acceptPagePort(hub, port as unknown as chrome.runtime.Port);
    for (const fn of port.disconnectListeners) fn();
    const before = port.posted.length;
    hub.notifyNavStarted(9, 1, 'https://openheaders.io');
    expect(port.posted.length).toBe(before);
  });
});
