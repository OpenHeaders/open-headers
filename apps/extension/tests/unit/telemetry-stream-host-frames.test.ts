/**
 * Telemetry stream host — the frames a watch leaves as. Asserts:
 *   - a replay larger than one frame's budget crosses as several
 *     frames, `ready` first, the rows in store order
 *   - a replay longer than any message count crosses whole (the count
 *     cap that used to restart the replay from inside itself is gone)
 *   - a row whose body cannot fit the host's limit crosses without the
 *     content and says so — on a replay and live
 *   - the frame is the text the wire carries, in the batch envelope
 */

import '@openheaders/ui/workbench/settings/schema';
import {
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleWireMessage, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetForTests as resetTabTelemetry } from '@/background/modules/tab-telemetry';
import { startTelemetryStreamHost } from '@/background/telemetry-stream-host';
import { FRAME_BUDGET_CHARS } from '@/background/telemetry-stream-host/frame-batcher';

const TAB_ID = 7;
const TICK_MS = 25;

function makeLifecycle(requestId: string, overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: TAB_ID,
    requestId,
    url: `https://api.openheaders.io/v2/${requestId}`,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function makeBody(content: string) {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v2/report',
    startedDateTime: '2026-11-24T00:00:00.000Z',
    content,
    encoding: '',
  };
}

interface Rig {
  store: RequestLifecycleStore;
  /** Every batch frame, as the text handed to the wire. */
  frames: string[];
  messages(): LifecycleWireMessage[];
  subscribe(consumerId: string): Promise<void>;
  detach(consumerId: string): Promise<void>;
}

function rig(maxFrameBytes = 8 * 1024 * 1024): Rig {
  const store = new RequestLifecycleStore();
  const hub = new RequestLifecycleHub({ store });
  const frames: string[] = [];
  let inbound: InboundFrameHandler | null = null;
  const wire: BackendWireHandle = {
    backendId: 'b1',
    record: () => {
      throw new Error('record() not used by the telemetry host');
    },
    isLoopback: () => true,
    isConnected: () => true,
    send: () => true,
  };
  startTelemetryStreamHost({
    hub,
    send: () => true,
    sendSerialized: (_backendId, frame) => {
      frames.push(frame);
      return true;
    },
    maxFrameBytes: () => maxFrameBytes,
    registerInbound: (handler) => {
      inbound = handler;
      return () => undefined;
    },
    subscribeClose: () => () => undefined,
    listWires: () => [],
    queryTabs: async () => [],
  });
  const deliver = async (frame: unknown): Promise<void> => {
    if (!inbound) throw new Error('inbound handler not registered');
    await (inbound as InboundFrameHandler)(frame, wire);
  };
  return {
    store,
    frames,
    messages: () => frames.flatMap((frame) => (JSON.parse(frame) as { messages: LifecycleWireMessage[] }).messages),
    subscribe: (consumerId) =>
      deliver({ type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId: TAB_ID, consumerId, message: { kind: 'subscribe' } }),
    detach: (consumerId) => deliver({ type: TELEMETRY_LIFECYCLE_DETACH_TYPE, tabId: TAB_ID, consumerId }),
  };
}

/** Watch once so the tab's session floor is set, then leave. */
async function establishFloor(r: Rig): Promise<void> {
  await r.subscribe('c1');
  vi.advanceTimersByTime(TICK_MS);
  await r.detach('c1');
  r.frames.length = 0;
}

function startedIds(messages: LifecycleWireMessage[]): string[] {
  return messages.flatMap((m) =>
    m.kind === 'lifecycle-update' && m.update.kind === 'started' ? [m.update.lifecycle.requestId] : [],
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  resetTabTelemetry();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startTelemetryStreamHost — frames', () => {
  it('a replay larger than one frame crosses as several, ready first, rows in order', async () => {
    const r = rig();
    await establishFloor(r);
    const rows = 60;
    for (let i = 0; i < rows; i++) {
      r.store.apply({
        kind: 'started',
        lifecycle: makeLifecycle(`r${i}`, { url: `https://api.openheaders.io/v2/r${i}?pad=${'p'.repeat(60_000)}` }),
      });
    }

    await r.subscribe('c2');
    vi.advanceTimersByTime(TICK_MS);

    expect(r.frames.length).toBeGreaterThan(1);
    for (const frame of r.frames) {
      expect(frame.length).toBeLessThanOrEqual(FRAME_BUDGET_CHARS + 200);
      expect(JSON.parse(frame)).toMatchObject({
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: TAB_ID,
        consumerId: 'c2',
      });
    }
    const messages = r.messages();
    expect(messages[0]).toEqual({ kind: 'ready', tabId: TAB_ID, watermarkMs: 1000 });
    expect(startedIds(messages)).toEqual(Array.from({ length: rows }, (_, i) => `r${i}`));
  });

  it('a replay of more rows than any message count crosses whole', async () => {
    const r = rig();
    await establishFloor(r);
    const rows = 4_100;
    for (let i = 0; i < rows; i++) r.store.apply({ kind: 'started', lifecycle: makeLifecycle(`r${i}`) });

    await r.subscribe('c2');
    vi.advanceTimersByTime(TICK_MS);

    const messages = r.messages();
    expect(messages.filter((m) => m.kind === 'ready')).toHaveLength(1);
    expect(startedIds(messages)).toHaveLength(rows);
    expect(startedIds(messages)[rows - 1]).toBe(`r${rows - 1}`);
  });

  it('a replayed row whose body cannot fit the limit crosses without the content', async () => {
    const r = rig(4_000);
    await establishFloor(r);
    r.store.apply({ kind: 'started', lifecycle: makeLifecycle('small') });
    r.store.apply({ kind: 'started', lifecycle: makeLifecycle('big', { statusCode: 200 }) });
    r.store.apply({
      kind: 'body-attached',
      tabId: TAB_ID,
      requestId: 'big',
      hopIndex: 0,
      body: makeBody('x'.repeat(5_000)),
    });

    await r.subscribe('c2');
    vi.advanceTimersByTime(TICK_MS);

    const rowsById = new Map(
      r
        .messages()
        .flatMap((m) => (m.kind === 'lifecycle-update' && m.update.kind === 'started' ? [m.update.lifecycle] : []))
        .map((lifecycle) => [lifecycle.requestId, lifecycle]),
    );
    expect(rowsById.get('small')?.harBodyByHop).toEqual([]);
    expect(rowsById.get('big')?.statusCode).toBe(200);
    expect(rowsById.get('big')?.harBodyByHop).toEqual([{ ...makeBody(''), omitted: 'too-large' }]);
    for (const frame of r.frames) expect(frame.length).toBeLessThanOrEqual(4_000);
  });

  it('a live body over the limit crosses as the same update without its content', async () => {
    const r = rig(4_000);
    await r.subscribe('c1');
    vi.advanceTimersByTime(TICK_MS);
    r.store.apply({ kind: 'started', lifecycle: makeLifecycle('big') });
    vi.advanceTimersByTime(TICK_MS);
    r.frames.length = 0;

    r.store.apply({
      kind: 'body-attached',
      tabId: TAB_ID,
      requestId: 'big',
      hopIndex: 0,
      body: makeBody('x'.repeat(5_000)),
    });
    vi.advanceTimersByTime(TICK_MS);

    expect(r.messages()).toEqual([
      {
        kind: 'lifecycle-update',
        update: {
          kind: 'body-attached',
          tabId: TAB_ID,
          requestId: 'big',
          hopIndex: 0,
          body: { ...makeBody(''), omitted: 'too-large' },
        },
      },
    ]);
  });

  it('a body that fits crosses whole', async () => {
    const r = rig(4_000);
    await r.subscribe('c1');
    vi.advanceTimersByTime(TICK_MS);
    r.store.apply({ kind: 'started', lifecycle: makeLifecycle('ok') });
    vi.advanceTimersByTime(TICK_MS);
    r.frames.length = 0;

    r.store.apply({
      kind: 'body-attached',
      tabId: TAB_ID,
      requestId: 'ok',
      hopIndex: 0,
      body: makeBody('x'.repeat(500)),
    });
    vi.advanceTimersByTime(TICK_MS);

    expect(r.messages()).toEqual([
      {
        kind: 'lifecycle-update',
        update: { kind: 'body-attached', tabId: TAB_ID, requestId: 'ok', hopIndex: 0, body: makeBody('x'.repeat(500)) },
      },
    ]);
  });
});
