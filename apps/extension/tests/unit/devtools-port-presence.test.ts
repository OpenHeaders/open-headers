/**
 * `devtools-port-presence` — the fifth cohabiting consumer of the
 * `devtools-har-source:<tabId>` port. Reads no frames; translates raw
 * connect/disconnect into ref-counted 0→1 / 1→0 presence edges feeding the
 * CDP attach reconciler.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startDevtoolsPortPresence } from '@/background/correlator-host/devtools-port-presence';

interface FakePort {
  name: string;
  sender: { url: string };
  disconnectListeners: Array<() => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  disconnect: () => void;
}

function fakePort(name: string): FakePort {
  const port: FakePort = {
    name,
    sender: { url: 'chrome-extension://test-id/panel.html' },
    disconnectListeners: [],
    onDisconnect: { addListener: (fn) => port.disconnectListeners.push(fn) },
    disconnect: () => {
      for (const fn of port.disconnectListeners) fn();
    },
  };
  return port;
}

let connectListener: ((port: chrome.runtime.Port) => void) | null;

beforeEach(() => {
  connectListener = null;
  const onConnect = chrome.runtime.onConnect as unknown as {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  onConnect.addListener = vi.fn((fn: (port: chrome.runtime.Port) => void) => {
    connectListener = fn;
  });
  onConnect.removeListener = vi.fn();
});

function connect(port: FakePort): void {
  connectListener?.(port as unknown as chrome.runtime.Port);
}

describe('startDevtoolsPortPresence', () => {
  it('a har-source port connect fires onConnected with the tabId', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    startDevtoolsPortPresence({ onConnected, onDisconnected });

    connect(fakePort('devtools-har-source:5'));

    expect(onConnected).toHaveBeenCalledWith(5);
    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it('disconnect fires onDisconnected with the tabId', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    startDevtoolsPortPresence({ onConnected, onDisconnected });

    const port = fakePort('devtools-har-source:5');
    connect(port);
    port.disconnect();

    expect(onDisconnected).toHaveBeenCalledWith(5);
  });

  it('ignores ports that are not a har-source port', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    startDevtoolsPortPresence({ onConnected, onDisconnected });

    connect(fakePort('oh-rt:5'));

    expect(onConnected).not.toHaveBeenCalled();
  });

  it('ref-counts per tab — overlapping ports are a single sustained presence', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    startDevtoolsPortPresence({ onConnected, onDisconnected });

    // Two concurrent ports for the same tab (e.g. an SW-wake reconnect
    // racing the old port's disconnect).
    const first = fakePort('devtools-har-source:5');
    const second = fakePort('devtools-har-source:5');
    connect(first);
    connect(second);
    expect(onConnected).toHaveBeenCalledTimes(1); // only the 0→1 edge

    first.disconnect();
    expect(onDisconnected).not.toHaveBeenCalled(); // still one live port

    second.disconnect();
    expect(onDisconnected).toHaveBeenCalledTimes(1); // the 1→0 edge
    expect(onDisconnected).toHaveBeenCalledWith(5);
  });

  it('tracks distinct tabs independently', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    startDevtoolsPortPresence({ onConnected, onDisconnected });

    const tab5 = fakePort('devtools-har-source:5');
    const tab8 = fakePort('devtools-har-source:8');
    connect(tab5);
    connect(tab8);
    tab5.disconnect();

    expect(onConnected.mock.calls.map((c) => c[0]).sort()).toEqual([5, 8]);
    expect(onDisconnected).toHaveBeenCalledWith(5);
    expect(onDisconnected).not.toHaveBeenCalledWith(8);
  });

  it('dispose() removes the onConnect listener', () => {
    const presence = startDevtoolsPortPresence({ onConnected: vi.fn(), onDisconnected: vi.fn() });
    const onConnect = chrome.runtime.onConnect as unknown as { removeListener: ReturnType<typeof vi.fn> };
    presence.dispose();
    expect(onConnect.removeListener).toHaveBeenCalledTimes(1);
  });
});
