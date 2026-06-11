/**
 * Devtools-page nav bridge — chrome adapter forwarding `nav` /
 * `nav-timing` messages from the devtools_page port into PageStreamHub.
 */

import type { HarSourceMessage } from '@openheaders/core/types';

import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startDevtoolsPageNavBridge } from '@/background/page-port-host/devtools-page-nav-bridge';

interface FakePort {
  name: string;
  messageListeners: Array<(msg: HarSourceMessage) => void>;
  onMessage: { addListener: (fn: (msg: HarSourceMessage) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
}

function fakePort(name: string): FakePort {
  const port: FakePort = {
    name,
    messageListeners: [],
    onMessage: {
      addListener: (fn) => {
        port.messageListeners.push(fn);
      },
    },
    onDisconnect: {
      addListener: () => {},
    },
  };
  return port;
}

let connectListener: ((port: chrome.runtime.Port) => void) | null;

beforeEach(() => {
  connectListener = null;
  // Reset chrome.runtime.onConnect.addListener to capture the bridge's listener.
  const onConnect = chrome.runtime.onConnect as unknown as {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  onConnect.addListener = vi.fn((fn: (port: chrome.runtime.Port) => void) => {
    connectListener = fn;
  });
  onConnect.removeListener = vi.fn();
});

function emit(tabId: number, msg: HarSourceMessage): FakePort {
  const port = fakePort(`devtools-har-source:${tabId}`);
  connectListener?.(port as unknown as chrome.runtime.Port);
  for (const listener of port.messageListeners) listener(msg);
  return port;
}

describe('startDevtoolsPageNavBridge', () => {
  it('ignores ports with the wrong prefix', () => {
    const hub = new PageStreamHub();
    const spy = vi.spyOn(hub, 'notifyNavStarted');
    startDevtoolsPageNavBridge({ hub });
    const port = fakePort('oh-page:1');
    connectListener?.(port as unknown as chrome.runtime.Port);
    expect(port.messageListeners).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards `nav` into notifyNavStarted with the injected clock', () => {
    const hub = new PageStreamHub();
    const spy = vi.spyOn(hub, 'notifyNavStarted');
    startDevtoolsPageNavBridge({ hub, now: () => 1234 });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    expect(spy).toHaveBeenCalledWith(7, 1234, 'https://openheaders.io/');
  });

  it('forwards `nav-timing` into notifyNavTimingAttached', () => {
    const hub = new PageStreamHub();
    hub.notifyNavStarted(9, 100, 'https://openheaders.io/');
    const spy = vi.spyOn(hub, 'notifyNavTimingAttached');
    startDevtoolsPageNavBridge({ hub });
    const timing = { pageOrigin: 'https://openheaders.io', dclMs: 250, loadMs: 500 };
    emit(9, { type: 'nav-timing', timing });
    expect(spy).toHaveBeenCalledWith(9, timing);
  });

  it('drops a chrome-error nav (failed navigation — host creates no PageLoad)', () => {
    const hub = new PageStreamHub();
    const spy = vi.spyOn(hub, 'notifyNavStarted');
    startDevtoolsPageNavBridge({ hub });
    emit(7, { type: 'nav', url: 'chrome-error://chromewebdata/' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores `har` / `har-body` messages — those belong to the HAR adapter', () => {
    const hub = new PageStreamHub();
    const navSpy = vi.spyOn(hub, 'notifyNavStarted');
    const timingSpy = vi.spyOn(hub, 'notifyNavTimingAttached');
    startDevtoolsPageNavBridge({ hub });
    emit(3, { type: 'har', entry: { startedDateTime: 'x' } });
    emit(3, {
      type: 'har-body',
      method: 'GET',
      url: 'https://openheaders.io/',
      startedDateTime: 'x',
    });
    expect(navSpy).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('drops nav / nav-timing for a CDP-owned tab (the Page-domain feed owns it)', () => {
    const hub = new PageStreamHub();
    const navSpy = vi.spyOn(hub, 'notifyNavStarted');
    const timingSpy = vi.spyOn(hub, 'notifyNavTimingAttached');
    startDevtoolsPageNavBridge({ hub, isCdpOwned: (tabId) => tabId === 7 });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    emit(7, { type: 'nav-timing', timing: { pageOrigin: null, dclMs: 1 } });
    expect(navSpy).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
    // A heuristic-owned tab still flows through.
    emit(8, { type: 'nav', url: 'https://openheaders.io/other' });
    expect(navSpy).toHaveBeenCalledWith(8, expect.any(Number), 'https://openheaders.io/other');
  });

  it('resolves the committed documentId and attaches it to the minted page', async () => {
    const hub = new PageStreamHub();
    startDevtoolsPageNavBridge({
      hub,
      resolveMainFrame: async () => ({ url: 'https://openheaders.io/', documentId: 'DOC-1' }),
    });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    // The page is minted synchronously, the documentId lands a tick later.
    expect(hub.snapshotTab(7)[0].documentId).toBeUndefined();
    await vi.waitFor(() => expect(hub.snapshotTab(7)[0].documentId).toBe('DOC-1'));
  });

  it('drops a resolution whose frame URL does not match the nav (a newer commit won the race)', async () => {
    const hub = new PageStreamHub();
    startDevtoolsPageNavBridge({
      hub,
      resolveMainFrame: async () => ({ url: 'https://openheaders.io/newer', documentId: 'DOC-2' }),
    });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    await new Promise((r) => setTimeout(r, 0));
    expect(hub.snapshotTab(7)[0].documentId).toBeUndefined();
  });

  it('drops a resolution that lands after a newer page was minted', async () => {
    const hub = new PageStreamHub();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    startDevtoolsPageNavBridge({
      hub,
      resolveMainFrame: async () => {
        await gate;
        return { url: 'https://openheaders.io/', documentId: 'DOC-STALE' };
      },
    });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    hub.notifyNavStarted(7, 999, 'https://openheaders.io/second');
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(hub.snapshotTab(7)[0].documentId).toBeUndefined();
    expect(hub.snapshotTab(7)[1].documentId).toBeUndefined();
  });

  it('attaches nothing when the platform reports no documentId (Firefox)', async () => {
    const hub = new PageStreamHub();
    startDevtoolsPageNavBridge({
      hub,
      resolveMainFrame: async () => ({ url: 'https://openheaders.io/' }),
    });
    emit(7, { type: 'nav', url: 'https://openheaders.io/' });
    await new Promise((r) => setTimeout(r, 0));
    expect(hub.snapshotTab(7)[0].documentId).toBeUndefined();
  });

  it('dispose() removes the listener', () => {
    const hub = new PageStreamHub();
    const bridge = startDevtoolsPageNavBridge({ hub });
    const onConnect = chrome.runtime.onConnect as unknown as {
      removeListener: ReturnType<typeof vi.fn>;
    };
    bridge.dispose();
    expect(onConnect.removeListener).toHaveBeenCalledTimes(1);
  });
});
