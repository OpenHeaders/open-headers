/**
 * Resource-timing relay — per-tab latest-snapshot cache + fanout, plus
 * the chrome wiring that bridges the inbound `devtools-har-source` port
 * (`resource-timing` messages) and the outbound `oh-rt:<tabId>` panel
 * subscriber port.
 */

import type { ResourceTimingEntry, ResourceTimingWireMessage } from '@openheaders/core/resource-timing';
import type { HarSourceMessage } from '@openheaders/core/types';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createResourceTimingRelay, startResourceTimingRelay } from '@/background/resource-timing-relay';

function entry(name: string, overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    startTime: 0,
    duration: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    ...overrides,
  };
}

describe('createResourceTimingRelay — notify + fanout', () => {
  it('replays the cached snapshot to a sink that subscribes after the snapshot landed', () => {
    const relay = createResourceTimingRelay();
    relay.notifySnapshot(1, 1000, [entry('https://openheaders.io/a.js')]);

    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (msg) => received.push(msg));

    expect(received.map((m) => m.kind)).toEqual(['ready', 'rt-update']);
    const update = received[1];
    if (update.kind !== 'rt-update' || update.update.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(update.update.timeOriginMs).toBe(1000);
    expect(update.update.entries.map((e) => e.name)).toEqual(['https://openheaders.io/a.js']);
  });

  it('subscribing before any snapshot delivers only `ready`', () => {
    const relay = createResourceTimingRelay();
    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(2, (msg) => received.push(msg));
    expect(received.map((m) => m.kind)).toEqual(['ready']);
  });

  it('broadcasts a new snapshot to live sinks for the matching tab only', () => {
    const relay = createResourceTimingRelay();
    const tab1: ResourceTimingWireMessage[] = [];
    const tab2: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => tab1.push(m));
    relay.subscribe(2, (m) => tab2.push(m));
    tab1.length = 0;
    tab2.length = 0;

    relay.notifySnapshot(1, 500, [entry('https://openheaders.io/x')]);
    expect(tab1.map((m) => m.kind)).toEqual(['rt-update']);
    expect(tab2).toHaveLength(0);
  });

  it('accumulates one group per navigation (distinct origins) and replays all on attach', () => {
    const relay = createResourceTimingRelay();
    // Two navigations on the same tab — each a distinct time origin.
    relay.notifySnapshot(1, 100, [entry('https://github.com/app.js')]);
    relay.notifySnapshot(1, 200, [entry('https://example.com/x')]);

    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => received.push(m));
    // ready + one snapshot per navigation, in navigation order.
    expect(received.map((m) => m.kind)).toEqual(['ready', 'rt-update', 'rt-update']);
    const origins = received
      .filter((m): m is Extract<ResourceTimingWireMessage, { kind: 'rt-update' }> => m.kind === 'rt-update')
      .map((m) => (m.update.kind === 'snapshot' ? m.update.timeOriginMs : -1));
    expect(origins).toEqual([100, 200]);
  });

  it('same time origin replaces the group (the buffer grew; not a new navigation)', () => {
    const relay = createResourceTimingRelay();
    relay.notifySnapshot(1, 100, [entry('https://github.com/a.js')]);
    relay.notifySnapshot(1, 100, [entry('https://github.com/a.js'), entry('https://github.com/b.js')]);

    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => received.push(m));
    // Only one group for origin 100, carrying the latest (grown) entries.
    expect(received.map((m) => m.kind)).toEqual(['ready', 'rt-update']);
    const snap = received[1];
    if (snap.kind !== 'rt-update' || snap.update.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(snap.update.entries.map((e) => e.name)).toEqual(['https://github.com/a.js', 'https://github.com/b.js']);
  });

  it('forgetTab drops the snapshot and broadcasts tab-cleared', () => {
    const relay = createResourceTimingRelay();
    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => received.push(m));
    relay.notifySnapshot(1, 100, [entry('https://openheaders.io/a')]);
    received.length = 0;

    relay.forgetTab(1);
    expect(received).toHaveLength(1);
    const cleared = received[0];
    if (cleared.kind !== 'rt-update') throw new Error('expected rt-update');
    expect(cleared.update.kind).toBe('tab-cleared');

    // Snapshot is gone — a fresh subscriber sees only ready.
    const fresh: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => fresh.push(m));
    expect(fresh.map((m) => m.kind)).toEqual(['ready']);
  });

  it('forgetTab on an unknown tab is a silent no-op', () => {
    const relay = createResourceTimingRelay();
    const received: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => received.push(m));
    received.length = 0;
    relay.forgetTab(1);
    expect(received).toHaveLength(0);
  });

  it('detach is idempotent and stops further delivery', () => {
    const relay = createResourceTimingRelay();
    const received: ResourceTimingWireMessage[] = [];
    const detach = relay.subscribe(1, (m) => received.push(m));
    received.length = 0;
    detach();
    detach();
    relay.notifySnapshot(1, 100, [entry('https://openheaders.io/a')]);
    expect(received).toHaveLength(0);
  });

  it('clears the snapshot when the tab-lifecycle bus reports the tab forgotten', () => {
    const bus = new TabLifecycleBus();
    const relay = createResourceTimingRelay({ bus });
    relay.notifySnapshot(1, 100, [entry('https://openheaders.io/a')]);

    bus.notifyTabForgotten(1);

    const fresh: ResourceTimingWireMessage[] = [];
    relay.subscribe(1, (m) => fresh.push(m));
    expect(fresh.map((m) => m.kind)).toEqual(['ready']);
  });

  it('throws on use after dispose and unsubscribes from the bus', () => {
    const bus = new TabLifecycleBus();
    const relay = createResourceTimingRelay({ bus });
    relay.dispose();
    expect(() => relay.notifySnapshot(1, 100, [])).toThrow(/dispose/);
    expect(() => bus.notifyTabForgotten(1)).not.toThrow();
  });
});

// ── chrome wiring ───────────────────────────────────────────────────

interface FakePort {
  name: string;
  messageListeners: Array<(msg: HarSourceMessage) => void>;
  disconnectListeners: Array<() => void>;
  posted: ResourceTimingWireMessage[];
  onMessage: { addListener: (fn: (msg: HarSourceMessage) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
  postMessage: (msg: ResourceTimingWireMessage) => void;
}

function fakePort(name: string): FakePort {
  const port: FakePort = {
    name,
    messageListeners: [],
    disconnectListeners: [],
    posted: [],
    onMessage: { addListener: (fn) => port.messageListeners.push(fn) },
    onDisconnect: { addListener: (fn) => port.disconnectListeners.push(fn) },
    postMessage: (msg) => port.posted.push(msg),
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

describe('startResourceTimingRelay — chrome wiring', () => {
  it('forwards an inbound `resource-timing` message to a subscribed panel port', () => {
    startResourceTimingRelay();

    const panel = fakePort('oh-rt:5');
    connect(panel);
    panel.posted.length = 0; // drop the initial `ready`

    const source = fakePort('devtools-har-source:5');
    connect(source);
    const msg: HarSourceMessage = {
      type: 'resource-timing',
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/a.js')],
    };
    for (const fn of source.messageListeners) fn(msg);

    expect(panel.posted.map((m) => m.kind)).toEqual(['rt-update']);
    const update = panel.posted[0];
    if (update.kind !== 'rt-update' || update.update.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(update.update.entries.map((e) => e.name)).toEqual(['https://openheaders.io/a.js']);
  });

  it('ignores non-resource-timing messages on the source port', () => {
    startResourceTimingRelay();
    const panel = fakePort('oh-rt:5');
    connect(panel);
    panel.posted.length = 0;

    const source = fakePort('devtools-har-source:5');
    connect(source);
    for (const fn of source.messageListeners) fn({ type: 'nav', url: 'https://openheaders.io/' });

    expect(panel.posted).toHaveLength(0);
  });

  it('stops forwarding to a panel port after it disconnects', () => {
    startResourceTimingRelay();
    const panel = fakePort('oh-rt:5');
    connect(panel);
    panel.posted.length = 0;
    for (const fn of panel.disconnectListeners) fn();

    const source = fakePort('devtools-har-source:5');
    connect(source);
    for (const fn of source.messageListeners) fn({ type: 'resource-timing', timeOriginMs: 1, entries: [] });

    expect(panel.posted).toHaveLength(0);
  });

  it('dispose() removes the onConnect listener', () => {
    const host = startResourceTimingRelay();
    const onConnect = chrome.runtime.onConnect as unknown as { removeListener: ReturnType<typeof vi.fn> };
    host.dispose();
    expect(onConnect.removeListener).toHaveBeenCalledTimes(1);
  });
});
