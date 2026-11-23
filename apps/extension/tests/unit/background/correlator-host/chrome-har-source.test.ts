/**
 * `ChromeHarEventSource` — the `har-feed-absent` frame: a host whose
 * devtools page has no finished-request feed declares it per tab.
 */

import type { HarSourceMessage } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChromeHarEventSource } from '@/background/correlator-host/chrome-har-source';

interface FakePort {
  name: string;
  sender: { url: string };
  messageListeners: Array<(msg: HarSourceMessage) => void>;
  onMessage: { addListener: (fn: (msg: HarSourceMessage) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
  post: (msg: HarSourceMessage) => void;
}

function fakePort(name: string, senderUrl = 'chrome-extension://test-id/devtools.html'): FakePort {
  const port: FakePort = {
    name,
    sender: { url: senderUrl },
    messageListeners: [],
    onMessage: { addListener: (fn) => port.messageListeners.push(fn) },
    onDisconnect: { addListener: () => {} },
    post: (msg) => {
      for (const fn of port.messageListeners) fn(msg);
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

describe('ChromeHarEventSource — har-feed-absent', () => {
  it('fans the declaring tab to feed-absent subscribers and emits no HAR event for it', () => {
    const source = new ChromeHarEventSource();
    const onFeedAbsent = vi.fn();
    const onHar = vi.fn();
    source.subscribeFeedAbsent(onFeedAbsent);
    source.subscribe(onHar);

    const port = fakePort('devtools-har-source:5');
    connect(port);
    port.post({ type: 'session', token: 't-1', openedAtWallMs: 1_700_000_000_000 });
    expect(onFeedAbsent).not.toHaveBeenCalled();

    port.post({ type: 'har-feed-absent' });
    expect(onFeedAbsent).toHaveBeenCalledTimes(1);
    expect(onFeedAbsent).toHaveBeenCalledWith(5);
    expect(onHar).not.toHaveBeenCalled();
  });

  it('a port that never posts the frame declares nothing', () => {
    const source = new ChromeHarEventSource();
    const onFeedAbsent = vi.fn();
    source.subscribeFeedAbsent(onFeedAbsent);

    const port = fakePort('devtools-har-source:5');
    connect(port);
    port.post({ type: 'session', token: 't-1', openedAtWallMs: 1_700_000_000_000 });
    port.post({ type: 'nav', url: 'https://openheaders.io/' });

    expect(onFeedAbsent).not.toHaveBeenCalled();
  });

  it('refuses the frame from a sender outside the extension', () => {
    const source = new ChromeHarEventSource();
    const onFeedAbsent = vi.fn();
    source.subscribeFeedAbsent(onFeedAbsent);

    const port = fakePort('devtools-har-source:5', 'https://openheaders.io/');
    connect(port);
    port.post({ type: 'har-feed-absent' });

    expect(onFeedAbsent).not.toHaveBeenCalled();
  });

  it('unsubscribing stops the fan', () => {
    const source = new ChromeHarEventSource();
    const onFeedAbsent = vi.fn();
    const unsubscribe = source.subscribeFeedAbsent(onFeedAbsent);
    unsubscribe();

    const port = fakePort('devtools-har-source:5');
    connect(port);
    port.post({ type: 'har-feed-absent' });

    expect(onFeedAbsent).not.toHaveBeenCalled();
  });
});
