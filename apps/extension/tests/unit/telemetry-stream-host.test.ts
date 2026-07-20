/**
 * Telemetry stream host — the extension side of the browser live-
 * telemetry plane. Asserts:
 *   - a forwarded subscribe raises the tab-telemetry tracking ref and
 *     streams ready + replay + live updates as tick-batched frames
 *   - non-loopback wires are claimed and dropped (privacy gate)
 *   - the detach frame releases the ref and stops streaming
 *   - a wire close tears down every session it carried
 *   - the tabs-list request answers on the `<type>:response` channel
 */

import {
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isTracked, __resetForTests as resetTabTelemetry } from '@/background/modules/tab-telemetry';
import { startTelemetryStreamHost, type TelemetryStreamHost } from '@/background/telemetry-stream-host';

const TAB_ID = 7;

function startedUpdate(requestId: string, url: string) {
  return {
    kind: 'started' as const,
    lifecycle: {
      tabId: TAB_ID,
      requestId,
      url,
      method: 'GET',
      resourceType: 'other' as const,
      phase: 'pending' as const,
      redirectHopCount: 0,
      redirectHops: [],
      startedAtMs: 1000,
      hopStartedAtMs: 1000,
      requestHeaders: [],
      requestHeadersProvisional: false,
      har: [],
      harBodyByHop: [],
    },
  };
}

interface SentFrame {
  backendId: string;
  frame: Record<string, unknown>;
}

interface Harness {
  host: TelemetryStreamHost;
  store: RequestLifecycleStore;
  sent: SentFrame[];
  wireSent: Record<string, unknown>[];
  wire: BackendWireHandle;
  offWire: BackendWireHandle;
  deliver: (frame: unknown, wire: BackendWireHandle) => Promise<boolean>;
  closeWire: (wire: BackendWireHandle) => void;
}

function makeWire(backendId: string, loopback: boolean, wireSent: Record<string, unknown>[]): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the telemetry host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: (data) => {
      wireSent.push(data);
      return true;
    },
  };
}

function makeHarness(): Harness {
  const store = new RequestLifecycleStore();
  const hub = new RequestLifecycleHub({ store });
  const sent: SentFrame[] = [];
  const wireSent: Record<string, unknown>[] = [];
  let inbound: InboundFrameHandler | null = null;
  const closeSubscribers: Array<(wire: BackendWireHandle) => void> = [];
  const host = startTelemetryStreamHost({
    hub,
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
    queryTabs: async () => [
      { tabId: TAB_ID, windowId: 1, title: 'Docs', url: 'https://openheaders.io/docs', active: true },
    ],
  });
  return {
    host,
    store,
    sent,
    wireSent,
    wire: makeWire('b1', true, wireSent),
    offWire: makeWire('b2', false, wireSent),
    deliver: async (frame, wire) => {
      if (!inbound) throw new Error('inbound handler not registered');
      return await inbound(frame, wire);
    },
    closeWire: (wire) => {
      for (const cb of closeSubscribers) cb(wire);
    },
  };
}

function batchMessages(sent: SentFrame[]): LifecycleWireMessage[] {
  return sent
    .filter((s) => s.frame.type === TELEMETRY_LIFECYCLE_BATCH_TYPE)
    .flatMap((s) => s.frame.messages as LifecycleWireMessage[]);
}

beforeEach(() => {
  vi.useFakeTimers();
  resetTabTelemetry();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startTelemetryStreamHost', () => {
  it('subscribe raises tracking, streams ready + replay + live updates in batches', async () => {
    const h = makeHarness();
    expect(isTracked(TAB_ID)).toBe(false);

    const claimed = await h.deliver(
      { type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId: TAB_ID, message: { kind: 'subscribe' } },
      h.wire,
    );
    expect(claimed).toBe(true);
    expect(isTracked(TAB_ID)).toBe(true);

    h.store.apply(startedUpdate('a', 'https://openheaders.io/a'));
    await vi.advanceTimersByTimeAsync(50);

    const messages = batchMessages(h.sent);
    expect(messages[0]?.kind).toBe('ready');
    expect(messages.filter((m) => m.kind === 'lifecycle-update')).toHaveLength(1);
    expect(h.sent.every((s) => s.backendId === 'b1')).toBe(true);

    h.host.dispose();
    expect(isTracked(TAB_ID)).toBe(false);
  });

  it('claims and drops frames from non-loopback wires', async () => {
    const h = makeHarness();
    const claimed = await h.deliver(
      { type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId: TAB_ID, message: { kind: 'subscribe' } },
      h.offWire,
    );
    expect(claimed).toBe(true);
    expect(isTracked(TAB_ID)).toBe(false);
    expect(h.sent).toHaveLength(0);
    h.host.dispose();
  });

  it('detach releases the ref and stops streaming', async () => {
    const h = makeHarness();
    await h.deliver({ type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId: TAB_ID, message: { kind: 'subscribe' } }, h.wire);
    await vi.advanceTimersByTimeAsync(50);
    await h.deliver({ type: TELEMETRY_LIFECYCLE_DETACH_TYPE, tabId: TAB_ID }, h.wire);
    expect(isTracked(TAB_ID)).toBe(false);

    const before = batchMessages(h.sent).length;
    h.store.apply(startedUpdate('b', 'https://openheaders.io/b'));
    await vi.advanceTimersByTimeAsync(50);
    expect(batchMessages(h.sent)).toHaveLength(before);
    h.host.dispose();
  });

  it('a wire close tears down its sessions', async () => {
    const h = makeHarness();
    await h.deliver({ type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId: TAB_ID, message: { kind: 'subscribe' } }, h.wire);
    expect(isTracked(TAB_ID)).toBe(true);
    h.closeWire(h.wire);
    expect(isTracked(TAB_ID)).toBe(false);
    h.host.dispose();
  });

  it('answers the tabs-list request on the response channel', async () => {
    const h = makeHarness();
    await h.deliver({ type: TELEMETRY_TABS_LIST_TYPE }, h.wire);
    await vi.advanceTimersByTimeAsync(10);
    const reply = h.wireSent.find((f) => f.type === `${TELEMETRY_TABS_LIST_TYPE}:response`);
    expect(reply).toBeDefined();
    const payload = reply?.payload as { tabs: Array<{ url: string }> };
    expect(payload.tabs[0].url).toBe('https://openheaders.io/docs');
    h.host.dispose();
  });
});
