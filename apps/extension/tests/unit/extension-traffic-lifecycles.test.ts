/**
 * `extension-traffic-lifecycles` — the extension-self traffic plane: the
 * webRequest channel's tab-less own-origin events (SW telemetry beacons,
 * request-editor sends) become lifecycle rows re-keyed to every tab whose
 * main frame lives on the extension's own origin. Drives the captured
 * `tabs` listeners + the channel to prove ownership transitions (bootstrap,
 * created, navigated in/out, discard-swap, closed) and the re-key fanout
 * (one row per owner partition, none without owners).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tabsMock, runtimeMock, setCurrentTabs } = vi.hoisted(() => {
  function makeEvent<A extends unknown[]>() {
    const listeners = new Set<(...a: A) => void>();
    return {
      addListener: (l: (...a: A) => void): void => void listeners.add(l),
      removeListener: (l: (...a: A) => void): void => void listeners.delete(l),
      emit: (...a: A): void => {
        for (const l of [...listeners]) l(...a);
      },
    };
  }
  let current: chrome.tabs.Tab[] = [];
  return {
    setCurrentTabs: (t: chrome.tabs.Tab[]): void => {
      current = t;
    },
    tabsMock: {
      query: (_opts: chrome.tabs.QueryInfo, cb: (t: chrome.tabs.Tab[]) => void): void => cb(current),
      onCreated: makeEvent<[chrome.tabs.Tab]>(),
      onUpdated: makeEvent<[number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab]>(),
      onReplaced: makeEvent<[number, number]>(),
      onRemoved: makeEvent<[number]>(),
    },
    runtimeMock: {
      getURL: (path: string): string => `chrome-extension://ohtestid/${path}`,
    },
  };
});

vi.mock('@utils/browser-api.js', () => ({ tabs: tabsMock, runtime: runtimeMock }));
vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';
import { startExtensionTrafficLifecycles } from '@/background/correlator-host/extension-traffic-lifecycles';

const OWN_ORIGIN = 'chrome-extension://ohtestid';
const WORKBENCH_URL = `${OWN_ORIGIN}/workbench.html#/ws/1`;
const TELEMETRY_URL = 'https://telemetry.openheaders.io/v1/events';

function extensionTab(id: number, url: string = WORKBENCH_URL): chrome.tabs.Tab {
  return { id, url } as chrome.tabs.Tab;
}

/** A complete tab-less self-traffic exchange, as the channel delivers it. */
function exchange(requestId: string, atMs: number): WebRequestEvent[] {
  const base = {
    tabId: -1,
    requestId,
    url: TELEMETRY_URL,
    method: 'POST',
    type: 'xmlhttprequest',
    initiator: OWN_ORIGIN,
    frameId: 0,
  };
  return [
    { ...base, method_kind: 'onBeforeRequest', timeStamp: atMs },
    { ...base, method_kind: 'onSendHeaders', timeStamp: atMs + 1, requestHeaders: [] },
    {
      ...base,
      method_kind: 'onHeadersReceived',
      timeStamp: atMs + 5,
      statusCode: 202,
      statusLine: 'HTTP/1.1 202 Accepted',
      responseHeaders: [],
    },
    {
      ...base,
      method_kind: 'onCompleted',
      timeStamp: atMs + 6,
      statusCode: 202,
      statusLine: 'HTTP/1.1 202 Accepted',
      fromCache: false,
    },
  ];
}

describe('startExtensionTrafficLifecycles', () => {
  let channel: Set<(event: WebRequestEvent) => void>;
  let applied: RequestLifecycleUpdate[];
  let disposers: Array<() => void>;

  const start = () =>
    startExtensionTrafficLifecycles({
      subscribeExtensionTraffic: (listener) => {
        channel.add(listener);
        return () => channel.delete(listener);
      },
      apply: (update) => applied.push(update),
    });

  const feed = (events: WebRequestEvent[]): void => {
    for (const event of events) {
      for (const listener of [...channel]) listener(event);
    }
  };

  const startedTabs = (): number[] => applied.filter((u) => u.kind === 'started').map((u) => u.lifecycle.tabId);

  beforeEach(() => {
    channel = new Set();
    applied = [];
    disposers = [];
    setCurrentTabs([]);
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
  });

  it('produces no rows while no extension-origin tab is open', () => {
    disposers.push(start().dispose);
    feed(exchange('1001', 10_000));
    expect(applied).toEqual([]);
  });

  it('bootstraps owners from already-open extension pages and mints re-keyed rows', () => {
    setCurrentTabs([extensionTab(7)]);
    disposers.push(start().dispose);
    feed(exchange('1002', 20_000));

    expect(startedTabs()).toEqual([7]);
    const started = applied.find((u) => u.kind === 'started');
    expect(started?.kind === 'started' && started.lifecycle.requestId).toBe('1002');
    expect(started?.kind === 'started' && started.lifecycle.url).toBe(TELEMETRY_URL);
    const terminal = applied.filter((u) => u.kind === 'phase').at(-1);
    expect(terminal?.kind === 'phase' && terminal.patch.phase).toBe('completed');
    expect(terminal?.kind === 'phase' && terminal.tabId).toBe(7);
  });

  it('fans one exchange to every owner tab partition', () => {
    setCurrentTabs([extensionTab(3), extensionTab(4)]);
    disposers.push(start().dispose);
    feed(exchange('1003', 30_000));
    expect(startedTabs().sort()).toEqual([3, 4]);
  });

  it('stamps issuedByWorker on every started mint — the gear-glyph provenance', () => {
    setCurrentTabs([extensionTab(5)]);
    disposers.push(start().dispose);
    feed(exchange('1010', 25_000));

    const started = applied.find((u) => u.kind === 'started');
    expect(started?.kind === 'started' && started.lifecycle.issuedByWorker).toBe('service-worker');
  });

  it('synthesizes a status-less terminal for own-bundle loads at onSendHeaders', () => {
    setCurrentTabs([extensionTab(6), extensionTab(8)]);
    disposers.push(start().dispose);
    const url = `${OWN_ORIGIN}/assets/editor.worker.js`;
    const base = {
      tabId: -1,
      requestId: '1011',
      url,
      method: 'GET',
      type: 'script',
      initiator: OWN_ORIGIN,
      frameId: 0,
    };
    feed([
      { ...base, method_kind: 'onBeforeRequest', timeStamp: 35_000 },
      { ...base, method_kind: 'onSendHeaders', timeStamp: 35_001, requestHeaders: [{ name: 'Accept', value: '*/*' }] },
    ]);

    const terminals = applied.filter((u) => u.kind === 'phase' && u.patch.phase === 'completed');
    expect(terminals.map((u) => (u.kind === 'phase' ? u.tabId : -1)).sort()).toEqual([6, 8]);
    for (const terminal of terminals) {
      expect(terminal.kind === 'phase' && terminal.patch.statusCode).toBeUndefined();
      expect(terminal.kind === 'phase' && terminal.patch.completedAtMs).toBe(35_001);
    }
  });

  it('never synthesizes a terminal for network URLs — their own onCompleted resolves them', () => {
    setCurrentTabs([extensionTab(12)]);
    disposers.push(start().dispose);
    const [before, send] = exchange('1012', 45_000);
    feed([before, send]);

    expect(applied.some((u) => u.kind === 'phase' && u.patch.phase === 'completed')).toBe(false);
  });

  it('adopts a tab that navigates into the extension origin and releases one that leaves', () => {
    disposers.push(start().dispose);
    tabsMock.onUpdated.emit(9, { url: WORKBENCH_URL } as chrome.tabs.OnUpdatedInfo, extensionTab(9));
    feed(exchange('1004', 40_000));
    expect(startedTabs()).toEqual([9]);

    applied = [];
    tabsMock.onUpdated.emit(
      9,
      { url: 'https://openheaders.io/' } as chrome.tabs.OnUpdatedInfo,
      extensionTab(9, 'https://openheaders.io/'),
    );
    feed(exchange('1005', 50_000));
    expect(applied).toEqual([]);
  });

  it('adopts a freshly created tab via its pendingUrl', () => {
    disposers.push(start().dispose);
    tabsMock.onCreated.emit({ id: 11, pendingUrl: WORKBENCH_URL } as chrome.tabs.Tab);
    feed(exchange('1006', 60_000));
    expect(startedTabs()).toEqual([11]);
  });

  it('transfers ownership across a discard swap and drops it on close', () => {
    setCurrentTabs([extensionTab(20)]);
    disposers.push(start().dispose);
    tabsMock.onReplaced.emit(21, 20);
    feed(exchange('1007', 70_000));
    expect(startedTabs()).toEqual([21]);

    applied = [];
    tabsMock.onRemoved.emit(21);
    feed(exchange('1008', 80_000));
    expect(applied).toEqual([]);
  });

  it('dispose stops row production and detaches listeners', () => {
    setCurrentTabs([extensionTab(30)]);
    const handle = start();
    handle.dispose();
    feed(exchange('1009', 90_000));
    expect(applied).toEqual([]);
    expect(channel.size).toBe(0);
  });
});
