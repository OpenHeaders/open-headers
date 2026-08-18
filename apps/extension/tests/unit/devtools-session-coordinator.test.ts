/**
 * DevTools session coordinator — the fourth cohabiting consumer of the
 * `devtools-har-source:<tabId>` port. Reads only `session` frames and, when
 * the hub reports a genuine reopen (token changed → `startSession` returns
 * true), drops the tab's cached Resource Timing groups via the relay. The
 * same token (an SW-eviction reconnect) resets nothing.
 */

import type { HarSourceMessage } from '@openheaders/core/types';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startDevtoolsSessionCoordinator } from '@/background/devtools-session-coordinator';
import type { ResourceTimingRelay } from '@/background/resource-timing-relay';

interface FakePort {
  name: string;
  sender: { url: string };
  messageListeners: Array<(msg: HarSourceMessage) => void>;
  onMessage: { addListener: (fn: (msg: HarSourceMessage) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
  emit: (msg: HarSourceMessage) => void;
}

function fakePort(name: string): FakePort {
  const port: FakePort = {
    name,
    sender: { url: 'chrome-extension://test-id/panel.html' },
    messageListeners: [],
    onMessage: { addListener: (fn) => port.messageListeners.push(fn) },
    onDisconnect: { addListener: () => {} },
    emit: (msg) => {
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

function makeDeps(startSessionResult: boolean) {
  const startSession = vi.fn(() => startSessionResult);
  const forgetTab = vi.fn();
  const pageForgetTab = vi.fn();
  const hub = { startSession } as unknown as RequestLifecycleHub;
  const relay = { forgetTab } as unknown as ResourceTimingRelay;
  const pageHub = { forgetTab: pageForgetTab } as unknown as PageStreamHub;
  return { hub, relay, pageHub, startSession, forgetTab, pageForgetTab };
}

describe('startDevtoolsSessionCoordinator', () => {
  it('a new token starts the session and drops the tab’s RT groups', () => {
    const { hub, relay, pageHub, startSession, forgetTab, pageForgetTab } = makeDeps(true);
    startDevtoolsSessionCoordinator({ hub, relay, pageHub });

    const source = fakePort('devtools-har-source:5');
    connect(source);
    source.emit({ type: 'session', token: 'tok-1', openedAtWallMs: 2000 });

    expect(startSession).toHaveBeenCalledWith(5, 'tok-1', 2000);
    expect(forgetTab).toHaveBeenCalledWith(5);
    expect(pageForgetTab).toHaveBeenCalledWith(5);
  });

  it('the same token resets nothing (startSession returns false)', () => {
    const { hub, relay, pageHub, startSession, forgetTab, pageForgetTab } = makeDeps(false);
    startDevtoolsSessionCoordinator({ hub, relay, pageHub });

    const source = fakePort('devtools-har-source:5');
    connect(source);
    source.emit({ type: 'session', token: 'tok-1', openedAtWallMs: 2000 });

    expect(startSession).toHaveBeenCalledWith(5, 'tok-1', 2000);
    expect(forgetTab).not.toHaveBeenCalled();
    expect(pageForgetTab).not.toHaveBeenCalled();
  });

  it('ignores non-session frames on the source port', () => {
    const { hub, relay, pageHub, startSession } = makeDeps(true);
    startDevtoolsSessionCoordinator({ hub, relay, pageHub });

    const source = fakePort('devtools-har-source:5');
    connect(source);
    source.emit({ type: 'nav', url: 'https://openheaders.io/' });
    source.emit({ type: 'resource-timing', timeOriginMs: 1, entries: [] });

    expect(startSession).not.toHaveBeenCalled();
  });

  it('ignores a malformed session frame', () => {
    const { hub, relay, pageHub, startSession } = makeDeps(true);
    startDevtoolsSessionCoordinator({ hub, relay, pageHub });

    const source = fakePort('devtools-har-source:5');
    connect(source);
    // Missing openedAtWallMs.
    source.emit({ type: 'session', token: 'tok-1' } as unknown as HarSourceMessage);

    expect(startSession).not.toHaveBeenCalled();
  });

  it('ignores ports that are not a har-source port', () => {
    const { hub, relay, pageHub, startSession } = makeDeps(true);
    startDevtoolsSessionCoordinator({ hub, relay, pageHub });

    const other = fakePort('oh-rt:5');
    connect(other);
    // No message listener was registered, so emitting reaches nobody.
    expect(other.messageListeners).toHaveLength(0);
    expect(startSession).not.toHaveBeenCalled();
  });

  it('dispose() removes the onConnect listener', () => {
    const { hub, relay, pageHub } = makeDeps(true);
    const coordinator = startDevtoolsSessionCoordinator({ hub, relay, pageHub });
    const onConnect = chrome.runtime.onConnect as unknown as { removeListener: ReturnType<typeof vi.fn> };
    coordinator.dispose();
    expect(onConnect.removeListener).toHaveBeenCalledTimes(1);
  });
});
