/**
 * Tab-inventory watch host — the push half of the inventory plane.
 * Asserts:
 *   - a subscribe answers with an immediate snapshot push and attaches
 *     the chrome.tabs listeners (first watcher only)
 *   - tab events collapse into one debounced snapshot push per settle
 *     window, fanned to every subscribed wire
 *   - non-loopback wires are claimed and dropped (privacy gate)
 *   - detach / wire close end the watch; the last one detaches the
 *     chrome.tabs listeners (no viewer → silence)
 *   - debug onChange and consent flips push fresh snapshots
 *   - re-subscribe on an already-watched wire re-pushes (relay seeding)
 */

import '@openheaders/ui/workbench/settings/schema';
import type { BrowserTabWire, TelemetryTabsListResponsePayload } from '@openheaders/core/protocol';
import {
  TELEMETRY_TABS_DETACH_TYPE,
  TELEMETRY_TABS_PUSH_TYPE,
  TELEMETRY_TABS_SUBSCRIBE_TYPE,
} from '@openheaders/core/protocol';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryDebugSeam } from '@/background/telemetry-stream-host';
import { startTabInventoryHost, type TabInventoryHost } from '@/background/telemetry-stream-host/tab-inventory';

const DEBOUNCE_MS = 20;

const TABS: BrowserTabWire[] = [
  { tabId: 3, windowId: 1, title: 'Docs', url: 'https://openheaders.io/docs', active: true },
];

interface SentFrame {
  backendId: string;
  frame: Record<string, unknown>;
}

function makeWire(backendId: string, loopback: boolean): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the inventory host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: () => true,
  };
}

interface Harness {
  host: TabInventoryHost;
  sent: SentFrame[];
  wire: BackendWireHandle;
  wire2: BackendWireHandle;
  offWire: BackendWireHandle;
  deliver: (frame: unknown, wire: BackendWireHandle) => Promise<boolean>;
  closeWire: (wire: BackendWireHandle) => void;
}

function makeHarness(debug?: TelemetryDebugSeam): Harness {
  const sent: SentFrame[] = [];
  let inbound: InboundFrameHandler | null = null;
  const closeSubscribers: Array<(wire: BackendWireHandle) => void> = [];
  const host = startTabInventoryHost({
    send: (backendId, frame) => {
      sent.push({ backendId, frame });
      return true;
    },
    registerInbound: (handler) => {
      inbound = handler;
      return () => {
        inbound = null;
      };
    },
    subscribeClose: (cb) => {
      closeSubscribers.push(cb);
      return () => undefined;
    },
    queryTabs: async () => TABS,
    debounceMs: DEBOUNCE_MS,
    ...(debug !== undefined ? { debug } : {}),
  });
  return {
    host,
    sent,
    wire: makeWire('b1', true),
    wire2: makeWire('b2', true),
    offWire: makeWire('remote', false),
    deliver: async (frame, wire) => {
      if (!inbound) throw new Error('inbound handler not registered');
      return await inbound(frame, wire);
    },
    closeWire: (wire) => {
      for (const cb of closeSubscribers) cb(wire);
    },
  };
}

/** Snapshot pushes land after an async assembly — settle microtasks. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function pushesTo(sent: SentFrame[], backendId: string): TelemetryTabsListResponsePayload[] {
  return sent
    .filter((entry) => entry.backendId === backendId && entry.frame.type === TELEMETRY_TABS_PUSH_TYPE)
    .map((entry) => entry.frame.payload as TelemetryTabsListResponsePayload);
}

/** The chrome.tabs mock's registered listeners for one event. */
function mockListeners(event: { addListener: unknown }): Array<() => void> {
  return (event.addListener as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as () => void);
}

function fireTabsEvent(): void {
  for (const listener of mockListeners(chrome.tabs.onCreated)) listener();
}

describe('tab-inventory watch host', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    setSetting('backend.allowDesktopWatch', true);
    harness = makeHarness();
  });

  afterEach(() => {
    harness.host.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('answers a subscribe with an immediate snapshot and attaches tab listeners', async () => {
    expect(await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire)).toBe(true);
    await settle();
    const pushes = pushesTo(harness.sent, 'b1');
    expect(pushes).toHaveLength(1);
    expect(pushes[0].tabs).toEqual(TABS);
    expect(pushes[0].watchConsent).toBe(true);
    expect(pushes[0].debug.available).toBe(false);
    expect(mockListeners(chrome.tabs.onCreated)).toHaveLength(1);
  });

  it('claims and drops frames from non-loopback wires', async () => {
    expect(await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.offWire)).toBe(true);
    await settle();
    expect(harness.sent).toHaveLength(0);
    expect(mockListeners(chrome.tabs.onCreated)).toHaveLength(0);
  });

  it('collapses a burst of tab events into one debounced push per subscribed wire', async () => {
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire2);
    await settle();
    harness.sent.length = 0;
    fireTabsEvent();
    fireTabsEvent();
    fireTabsEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1);
    expect(pushesTo(harness.sent, 'b1')).toHaveLength(1);
    expect(pushesTo(harness.sent, 'b2')).toHaveLength(1);
  });

  it('re-pushes on a redundant subscribe (relay seeding a late viewer)', async () => {
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await settle();
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await settle();
    expect(pushesTo(harness.sent, 'b1')).toHaveLength(2);
    expect(mockListeners(chrome.tabs.onCreated)).toHaveLength(1);
  });

  it('detach ends the watch; the last detach silences the tab listeners', async () => {
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire2);
    await settle();
    harness.sent.length = 0;
    await harness.deliver({ type: TELEMETRY_TABS_DETACH_TYPE }, harness.wire);
    fireTabsEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1);
    expect(pushesTo(harness.sent, 'b1')).toHaveLength(0);
    expect(pushesTo(harness.sent, 'b2')).toHaveLength(1);
    const removals = (chrome.tabs.onCreated.removeListener as ReturnType<typeof vi.fn>).mock.calls;
    expect(removals).toHaveLength(0);
    await harness.deliver({ type: TELEMETRY_TABS_DETACH_TYPE }, harness.wire2);
    expect((chrome.tabs.onCreated.removeListener as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('a closed wire ends its watch', async () => {
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await settle();
    harness.sent.length = 0;
    harness.closeWire(harness.wire);
    fireTabsEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1);
    expect(harness.sent).toHaveLength(0);
    expect((chrome.tabs.onCreated.removeListener as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('pushes on debug onChange and reports the seam state', async () => {
    harness.host.dispose();
    const listeners: Array<() => void> = [];
    const debugState = { available: true, enabled: true, attachedTabs: [3], pinnedTabs: [3] };
    harness = makeHarness({
      getState: () => debugState,
      setPin: () => undefined,
      setEnabled: () => undefined,
      onChange: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    });
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await settle();
    expect(pushesTo(harness.sent, 'b1')[0].debug).toEqual(debugState);
    harness.sent.length = 0;
    for (const listener of listeners) listener();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1);
    expect(pushesTo(harness.sent, 'b1')).toHaveLength(1);
  });

  it('pushes on a consent flip with the new watchConsent value', async () => {
    await harness.deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, harness.wire);
    await settle();
    harness.sent.length = 0;
    setSetting('backend.allowDesktopWatch', false);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1);
    const pushes = pushesTo(harness.sent, 'b1');
    expect(pushes).toHaveLength(1);
    expect(pushes[0].watchConsent).toBe(false);
  });
});
