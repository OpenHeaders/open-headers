/**
 * Console-stream port host — chrome adapter wires `chrome.runtime.onConnect`
 * to `ConsoleStreamHub.attach`. Sibling of `page-port-host.test.ts`.
 */

import {
  CONSOLE_STREAM_PORT_PREFIX,
  consoleStreamPortName,
  parseConsoleStreamPortName,
} from '@openheaders/core/console-stream';
import { ConsoleStreamHub } from '@openheaders/oracle/console-stream-hub';
import { describe, expect, it, vi } from 'vitest';

import { acceptConsoleStreamPort } from '@/background/console-stream-port-host/accept-port';
import { createPortSink } from '@/background/console-stream-port-host/port-sink';

interface FakePort {
  name: string;
  sender: { url: string };
  posted: unknown[];
  disconnectListeners: Array<() => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function fakePort(name: string, postImpl?: (msg: unknown) => void): FakePort {
  const port: FakePort = {
    name,
    sender: { url: 'chrome-extension://test-id/panel.html' },
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

describe('parseConsoleStreamPortName', () => {
  it('parses oh-console:<tabId>', () => {
    expect(parseConsoleStreamPortName('oh-console:42')).toBe(42);
    expect(parseConsoleStreamPortName('oh-console:0')).toBe(0);
  });

  it('rejects siblings + malformed', () => {
    expect(parseConsoleStreamPortName('oh-fires:1')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:nope')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:-1')).toBeNull();
  });

  it('roundtrips with consoleStreamPortName', () => {
    expect(parseConsoleStreamPortName(consoleStreamPortName(7))).toBe(7);
    expect(CONSOLE_STREAM_PORT_PREFIX).toBe('oh-console:');
  });
});

describe('createPortSink', () => {
  it('posts ready + console-update envelopes', () => {
    const port = fakePort(consoleStreamPortName(1));
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverReady(1);
    sink.deliverUpdate({ kind: 'tab-cleared', tabId: 1 });
    expect(port.posted).toEqual([
      { kind: 'ready', tabId: 1 },
      { kind: 'console-update', update: { kind: 'tab-cleared', tabId: 1 } },
    ]);
  });

  it('swallows postMessage throws (dead port)', () => {
    const port = fakePort(consoleStreamPortName(1), () => {
      throw new Error('dead');
    });
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    expect(() => sink.deliverReady(1)).not.toThrow();
  });

  it('close() disconnects + swallows errors', () => {
    const port = fakePort(consoleStreamPortName(1));
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.close();
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    port.disconnect = vi.fn(() => {
      throw new Error('gone');
    });
    expect(() => sink.close()).not.toThrow();
  });
});

describe('acceptConsoleStreamPort', () => {
  it('rejects ports with the wrong prefix', () => {
    const hub = new ConsoleStreamHub();
    const port = fakePort('oh-fires:1');
    expect(acceptConsoleStreamPort(hub, port as unknown as chrome.runtime.Port)).toBe(false);
  });

  it('attaches matching port; ready + replay delivered synchronously', () => {
    const hub = new ConsoleStreamHub();
    hub.recordEntry(5, { source: 'console-api', level: 'log', args: [{ type: 'string', text: 'hi' }], timestamp: 1 });
    const port = fakePort(consoleStreamPortName(5));
    expect(acceptConsoleStreamPort(hub, port as unknown as chrome.runtime.Port)).toBe(true);
    expect(port.posted[0]).toEqual({ kind: 'ready', tabId: 5 });
    expect(port.posted).toHaveLength(2);
    expect((port.posted[1] as { kind: string }).kind).toBe('console-update');
  });

  it('onDisconnect detaches: subsequent updates do not reach the port', () => {
    const hub = new ConsoleStreamHub();
    const port = fakePort(consoleStreamPortName(9));
    acceptConsoleStreamPort(hub, port as unknown as chrome.runtime.Port);
    for (const fn of port.disconnectListeners) fn();
    const before = port.posted.length;
    hub.recordEntry(9, { source: 'console-api', level: 'log', args: [], timestamp: 1 });
    expect(port.posted.length).toBe(before);
  });
});
